// api/_badge-pay-watch.js — Match Base USDC / Solana $C7 payments to open orders.
// No wallet-connect — watches on-chain transfers only.
// On match: re-scan qualify; if lost, do NOT accept payment (QUALIFY_LOST).
// If still eligible → PAID → PENDING_FOUNDER_APPROVAL (+ burn ledger for C7).

import {
  ORDER_STATUSES,
  applyExpiry,
  getOrder,
  listAwaitingPayment,
  updateOrder,
  BASE_USDC,
  BASE_TREASURY,
  C7_TREASURY
} from './_badge-order.js';
import { recordC7BurnEntry } from './_badge-burn-ledger.js';
import { qualifyFromScan } from './_badge-qualify.js';
import { getBadgeByMint, hasRevocationHistory } from './_badge-registry.js';
import { C7_MINT } from './_supply.js';

const SCAN_BASE = process.env.GUARDIAN_SCAN_URL || 'https://scan.cyre.dev';
const BASE_RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

async function fetchScan(mint) {
  const url = `${SCAN_BASE}/api/scan?address=${encodeURIComponent(mint)}`;
  const r = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'GuardianBadge/order-watch' },
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`scan HTTP ${r.status}`);
  return r.json();
}

/**
 * Re-qualify at payment time. Money must not buy a badge the scan wouldn't grant.
 * @param {object} order
 * @returns {Promise<{ ok: boolean, qualify?: object, reason?: string }>}
 */
export async function requalifyOrderMint(order) {
  const existing = await getBadgeByMint(order.mint, order.chainId || 'solana');
  if (existing && existing.status === 'VALID') {
    return { ok: false, reason: 'mint already has a Guardian Verified serial' };
  }
  try {
    const scan = await fetchScan(order.mint);
    const revokedHistory = await hasRevocationHistory(order.mint, order.chainId || 'solana');
    const qualify = qualifyFromScan(scan, { hasRevocationHistory: revokedHistory });
    if (!qualify.eligible) {
      return { ok: false, qualify, reason: qualify.reason || 'no longer qualifies' };
    }
    return { ok: true, qualify };
  } catch (e) {
    return { ok: false, reason: `re-scan failed: ${(e && e.message) || e}` };
  }
}

function padTopicAddress(addr) {
  const a = String(addr || '').toLowerCase().replace(/^0x/, '');
  return '0x' + a.padStart(64, '0');
}

/**
 * Find Base USDC Transfer logs to treasury with exact atomic amount.
 * @param {string} amountAtomic
 * @param {number} [fromBlockLookback]
 */
export async function findBaseUsdcPayment(amountAtomic, fromBlockLookback = 5000) {
  const amountHex = '0x' + BigInt(String(amountAtomic)).toString(16);
  const blockHex = await rpcBase('eth_blockNumber', []);
  const latest = parseInt(blockHex, 16);
  const fromBlock = '0x' + Math.max(0, latest - fromBlockLookback).toString(16);
  const logs = await rpcBase('eth_getLogs', [
    {
      fromBlock,
      toBlock: 'latest',
      address: BASE_USDC,
      topics: [TRANSFER_TOPIC, null, padTopicAddress(BASE_TREASURY)]
    }
  ]);
  if (!Array.isArray(logs)) return null;
  for (const log of logs) {
    const value = BigInt(log.data || '0x0');
    if (value === BigInt(String(amountAtomic))) {
      const from = '0x' + String(log.topics[1] || '').slice(-40);
      return {
        tx: log.transactionHash,
        from,
        amountAtomic: String(value),
        amountHex,
        blockNumber: log.blockNumber
      };
    }
  }
  return null;
}

async function rpcBase(method, params) {
  const r = await fetch(BASE_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || 'base rpc error');
  return j.result;
}

async function rpcSolana(method, params) {
  const r = await fetch(SOLANA_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || 'solana rpc error');
  return j.result;
}

/**
 * Match Solana Pay: signatures for reference pubkey that include C7 transfer to treasury.
 * Fallback: exact atomic amount into treasury (plain wallet transfers cannot attach a reference).
 * @param {{ reference?: string, amountAtomic: string, to?: string }} lane
 */
export async function findC7SolanaPayment(lane) {
  const amountAtomic = lane && lane.amountAtomic;
  if (!amountAtomic) return null;

  const reference = lane.reference;
  if (reference) {
    const sigs = await rpcSolana('getSignaturesForAddress', [reference, { limit: 20 }]);
    if (Array.isArray(sigs) && sigs.length) {
      for (const s of sigs) {
        const sig = s.signature;
        const tx = await rpcSolana('getTransaction', [
          sig,
          { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }
        ]);
        if (!tx || !tx.meta || tx.meta.err) continue;
        const hit = extractC7Transfer(tx, amountAtomic);
        if (hit) {
          return { tx: sig, from: hit.from, amountAtomic: hit.amountAtomic, matchMode: 'reference' };
        }
      }
    }
  }

  // Plain SPL transfer fallback — unique locked C7 amount is the matcher (same idea as USDC cents).
  return findC7ByExactAmount(amountAtomic);
}

/**
 * Scan recent C7 treasury inbound transfers for an exact atomic amount.
 * @param {string} amountAtomic
 * @param {number} [limit]
 */
export async function findC7ByExactAmount(amountAtomic, limit = 40) {
  const sigs = await rpcSolana('getSignaturesForAddress', [C7_TREASURY, { limit }]);
  if (!Array.isArray(sigs) || !sigs.length) return null;
  for (const s of sigs) {
    const sig = s.signature;
    const tx = await rpcSolana('getTransaction', [
      sig,
      { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }
    ]);
    if (!tx || !tx.meta || tx.meta.err) continue;
    const hit = extractC7Transfer(tx, amountAtomic);
    if (hit) {
      return { tx: sig, from: hit.from, amountAtomic: hit.amountAtomic, matchMode: 'exact_amount' };
    }
  }
  return null;
}

function extractC7Transfer(tx, amountAtomic) {
  const meta = tx.meta;
  const message = tx.transaction && tx.transaction.message;
  const accountKeys = (message && message.accountKeys) || [];
  const keys = accountKeys.map((k) => (typeof k === 'string' ? k : k.pubkey));

  // Prefer parsed SPL token balance changes
  const pre = meta.preTokenBalances || [];
  const post = meta.postTokenBalances || [];
  for (const postBal of post) {
    if (postBal.mint !== C7_MINT) continue;
    const owner = postBal.owner;
    if (owner !== C7_TREASURY) continue;
    const preBal = pre.find(
      (p) => p.accountIndex === postBal.accountIndex || (p.owner === owner && p.mint === C7_MINT)
    );
    const preAmt = BigInt((preBal && preBal.uiTokenAmount && preBal.uiTokenAmount.amount) || '0');
    const postAmt = BigInt((postBal.uiTokenAmount && postBal.uiTokenAmount.amount) || '0');
    const delta = postAmt - preAmt;
    if (delta === BigInt(String(amountAtomic))) {
      // Find a decreasing C7 balance as sender
      let from = null;
      for (const p of pre) {
        if (p.mint !== C7_MINT) continue;
        const q = post.find((x) => x.accountIndex === p.accountIndex);
        const preA = BigInt((p.uiTokenAmount && p.uiTokenAmount.amount) || '0');
        const postA = BigInt((q && q.uiTokenAmount && q.uiTokenAmount.amount) || '0');
        if (preA - postA === delta) {
          from = p.owner || null;
          break;
        }
      }
      return { from, amountAtomic: String(delta), keys };
    }
  }
  return null;
}

/**
 * Apply a matched payment to an order (after re-qualify).
 * @param {object} order
 * @param {{ lane: 'usdc_base'|'c7_solana', tx: string, from?: string|null, amountAtomic: string }} match
 * @param {object} qualify
 */
export async function acceptPayment(order, match, qualify) {
  let burnLedgerId = null;
  if (match.lane === 'c7_solana') {
    const entry = await recordC7BurnEntry({
      orderId: order.id,
      amountAtomic: match.amountAtomic || order.locked.c7Atomic,
      amountDisplay: order.locked.c7Amount,
      tx: match.tx,
      from: match.from || null
    });
    burnLedgerId = entry.id;
  }

  return updateOrder(order, {
    status: ORDER_STATUSES.PENDING_FOUNDER_APPROVAL,
    paidAt: new Date().toISOString(),
    paymentLane: match.lane,
    paymentTx: match.tx,
    paymentFrom: match.from || null,
    burnLedgerId,
    qualifyAtPayment: {
      path: qualify.path,
      pathLabel: qualify.pathLabel,
      pathFamily: qualify.pathFamily,
      grade: qualify.grade,
      score: qualify.score,
      lpTier: qualify.lpTier,
      reason: qualify.reason
    },
    // Keep PAID as intermediate trail in history field
    paidStatusTrail: ORDER_STATUSES.PAID,
    approval: {
      status: 'PENDING_FOUNDER_APPROVAL',
      queuedAt: new Date().toISOString()
    }
  });
}

/**
 * Watch one order or all awaiting payments.
 * @param {{ orderId?: string, inject?: { lane: string, tx: string, from?: string }|null }} opts
 * inject requires founder/test auth at the HTTP layer.
 */
export async function watchOrders(opts = {}) {
  /** @type {object[]} */
  let targets = [];
  if (opts.orderId) {
    const o = await getOrder(opts.orderId);
    if (o) targets = [o];
  } else {
    targets = await listAwaitingPayment();
  }

  const results = [];
  for (let order of targets) {
    order = applyExpiry(order);
    if (order.status === ORDER_STATUSES.EXPIRED) {
      await updateOrder(order, { status: ORDER_STATUSES.EXPIRED });
      results.push({ id: order.id, status: 'EXPIRED', matched: false });
      continue;
    }
    if (order.status !== ORDER_STATUSES.AWAITING_PAYMENT) {
      results.push({ id: order.id, status: order.status, matched: false });
      continue;
    }

    let match = null;
    if (opts.inject && opts.inject.lane && opts.inject.tx) {
      match = {
        lane: opts.inject.lane,
        tx: opts.inject.tx,
        from: opts.inject.from || null,
        amountAtomic:
          opts.inject.lane === 'c7_solana' ? order.locked.c7Atomic : order.locked.usdcAtomic
      };
    } else {
      try {
        const usdc = await findBaseUsdcPayment(order.locked.usdcAtomic);
        if (usdc) {
          match = { lane: 'usdc_base', tx: usdc.tx, from: usdc.from, amountAtomic: usdc.amountAtomic };
        }
      } catch (e) {
        results.push({ id: order.id, watchError: `base: ${(e && e.message) || e}` });
      }
      if (!match) {
        try {
          const c7 = await findC7SolanaPayment(order.payment.c7Solana);
          if (c7) {
            match = { lane: 'c7_solana', tx: c7.tx, from: c7.from, amountAtomic: c7.amountAtomic };
          }
        } catch (e) {
          results.push({ id: order.id, watchError: `solana: ${(e && e.message) || e}` });
        }
      }
    }

    if (!match) {
      results.push({ id: order.id, status: order.status, matched: false });
      continue;
    }

    const rq = await requalifyOrderMint(order);
    if (!rq.ok) {
      const lost = await updateOrder(order, {
        status: ORDER_STATUSES.QUALIFY_LOST,
        qualifyLostAt: new Date().toISOString(),
        qualifyLostReason: rq.reason,
        paymentTxSeen: match.tx,
        paymentLaneSeen: match.lane,
        refund: {
          status: 'REFUND_PENDING',
          recordedAt: new Date().toISOString(),
          note: 'Payment seen but mint no longer qualifies — founder refund path.'
        }
      });
      results.push({
        id: order.id,
        status: lost.status,
        matched: true,
        accepted: false,
        reason: rq.reason,
        paymentTx: match.tx
      });
      continue;
    }

    const accepted = await acceptPayment(order, match, rq.qualify);
    results.push({
      id: order.id,
      status: accepted.status,
      matched: true,
      accepted: true,
      paymentLane: match.lane,
      paymentTx: match.tx,
      burnLedgerId: accepted.burnLedgerId
    });
  }
  return results;
}
