// api/_badge-order.js — Paid Guardian Verified orders (USDC Base | $C7 Solana Pay).
// Comp issuance (badge-register) NEVER creates orders; paid orders NEVER look like comps.
// Status machine:
//   AWAITING_PAYMENT → (expire) EXPIRED
//   AWAITING_PAYMENT → (watcher match + re-qualify) PAID → name-screen
//     → ISSUED (AUTO_APPROVED) | PENDING_FOUNDER_APPROVAL (flagged / auto-off)
//   PENDING_FOUNDER_APPROVAL → APPROVED → ISSUED | REJECTED → REFUND_PENDING → REFUNDED
// Price lock: 30 minutes. Unique USDC cent-amount for Base matching; Solana Pay reference for C7.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { C7_MINT, C7_DECIMALS } from './_supply.js';
import { redisCommand, isDurableRedis } from './_redis.js';

const FILE_STORE = process.env.BADGE_ORDER_STORE || '/tmp/guardian-badge-orders.json';
const KEY_PREFIX = 'guardian:order:';
const INDEX_KEY = 'guardian:order:index';
const USDC_AMT_KEY = 'guardian:order:usdc-amts';
const COUNTER_KEY = 'guardian:order:counter';

export const ORDER_TTL_MS = 30 * 60 * 1000;
export const USDC_USD = 25;
export const C7_USD = 20;
/** Base USDC (6 decimals). */
export const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const BASE_TREASURY =
  process.env.BADGE_USDC_TREASURY_BASE ||
  process.env.X402_PAY_TO_BASE ||
  '0x9Ff25C4acf1DcDDf15fD2702C127A285f1dFa712';
/** Solana wallet receiving $C7 badge payments (burned weekly from burn ledger). */
export const C7_TREASURY =
  process.env.BADGE_C7_TREASURY ||
  process.env.X402_PAY_TO ||
  '9iubApKktcxphCVgBg9CPRPhSH8nkzVRSapxhYwxfCVS';

export const ORDER_STATUSES = Object.freeze({
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  EXPIRED: 'EXPIRED',
  PAID: 'PAID',
  PENDING_FOUNDER_APPROVAL: 'PENDING_FOUNDER_APPROVAL',
  APPROVED: 'APPROVED',
  ISSUED: 'ISSUED',
  REJECTED: 'REJECTED',
  REFUND_PENDING: 'REFUND_PENDING',
  REFUNDED: 'REFUNDED',
  QUALIFY_LOST: 'QUALIFY_LOST'
});

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** @param {Uint8Array|Buffer} bytes */
export function encodeBase58(bytes) {
  const buf = Buffer.from(bytes);
  let zeros = 0;
  while (zeros < buf.length && buf[zeros] === 0) zeros += 1;
  const digits = [0];
  for (let i = zeros; i < buf.length; i++) {
    let carry = buf[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = '';
  for (let i = 0; i < zeros; i++) out += '1';
  for (let i = digits.length - 1; i >= 0; i--) out += B58_ALPHABET[digits[i]];
  return out;
}

/** Fresh Solana Pay reference pubkey (32 random bytes → base58). Matching needs no private key. */
export function newSolanaPayReference() {
  return encodeBase58(crypto.randomBytes(32));
}


/** True when orders persist across serverless instances (Redis/KV configured). */
export function isDurableOrderStore() {
  return isDurableRedis();
}

function emptyFileStore() {
  return { byId: {}, openUsdcAtomic: {}, counter: 0 };
}

function readFileStore() {
  try {
    if (!fs.existsSync(FILE_STORE)) return emptyFileStore();
    const data = JSON.parse(fs.readFileSync(FILE_STORE, 'utf8'));
    if (!data || typeof data !== 'object') return emptyFileStore();
    return {
      byId: data.byId && typeof data.byId === 'object' ? data.byId : {},
      openUsdcAtomic: data.openUsdcAtomic && typeof data.openUsdcAtomic === 'object' ? data.openUsdcAtomic : {},
      counter: Number(data.counter) || 0
    };
  } catch (e) {
    console.error('badge order file read failed', e && e.message);
    return emptyFileStore();
  }
}

function writeFileStore(store) {
  try {
    const dir = path.dirname(FILE_STORE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FILE_STORE, JSON.stringify(store));
  } catch (e) {
    console.error('badge order file write failed', e && e.message);
  }
}

async function nextCounter() {
  if (isDurableRedis()) {
    const row = await redisCommand(['INCR', COUNTER_KEY]);
    return Number(row && row.result) || 1;
  }
  const store = readFileStore();
  store.counter = (Number(store.counter) || 0) + 1;
  writeFileStore(store);
  return store.counter;
}

/** Unique micro-USDC amount ≈ $25.00xx for transfer matching (6 decimals). */
export async function allocateUniqueUsdcAtomic() {
  const base = USDC_USD * 1_000_000; // 25_000_000
  for (let attempt = 0; attempt < 200; attempt++) {
    // Prefer crypto randomness so serverless instances without Redis do not collide.
    const suffix = crypto.randomInt(100, 9900); // $25.000100 .. $25.009899
    const atomic = String(base + suffix);
    if (isDurableRedis()) {
      const set = await redisCommand(['HSETNX', USDC_AMT_KEY, atomic, '1']);
      if (set && Number(set.result) === 1) return atomic;
      continue;
    }
    const store = readFileStore();
    if (store.openUsdcAtomic[atomic]) continue;
    store.openUsdcAtomic[atomic] = true;
    writeFileStore(store);
    return atomic;
  }
  throw new Error('could not allocate unique USDC amount');
}

function orderHmacSecret() {
  return (
    process.env.BADGE_ORDER_HMAC ||
    process.env.BADGE_FOUNDER_KEY ||
    process.env.X402_INTERNAL_KEY ||
    'guardian-order-dev-hmac'
  );
}

/** Signed order token — survives Vercel ephemeral /tmp when Redis is unset. */
export function signOrder(order) {
  const body = Buffer.from(JSON.stringify(order), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', orderHmacSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyOrderToken(token) {
  const raw = String(token || '').trim();
  const i = raw.lastIndexOf('.');
  if (i < 1) return null;
  const body = raw.slice(0, i);
  const sig = raw.slice(i + 1);
  const expect = crypto.createHmac('sha256', orderHmacSecret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return applyExpiry(JSON.parse(Buffer.from(body, 'base64url').toString('utf8')));
  } catch (_) {
    return null;
  }
}

/**
 * Hydrate store from a signed token without clobbering a more advanced status.
 * @param {string} token
 * @returns {Promise<object|null>}
 */
export async function hydrateOrderToken(token) {
  const fromTok = verifyOrderToken(token);
  if (!fromTok) return null;
  const existing = await getOrder(fromTok.id);
  const merged = preferOrderState(existing, fromTok);
  await saveOrder(merged);
  return merged;
}

export function formatUsdcDisplay(atomic) {
  const n = BigInt(String(atomic));
  const whole = n / 1000000n;
  const frac = String(n % 1000000n).padStart(6, '0').replace(/0+$/, '') || '0';
  return `${whole}.${frac}`;
}

/**
 * Fetch $C7 USD spot for locking $20-worth amount.
 * @returns {Promise<{ priceUsd: number, source: string }>}
 */
export async function fetchC7PriceUsd() {
  const mint = C7_MINT;
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
      headers: { accept: 'application/json', 'user-agent': 'GuardianBadge/order' },
      cache: 'no-store'
    });
    if (r.ok) {
      const j = await r.json();
      const pairs = Array.isArray(j.pairs) ? j.pairs : [];
      let best = null;
      for (const p of pairs) {
        const px = Number(p.priceUsd);
        const liq = Number(p.liquidity && p.liquidity.usd) || 0;
        if (!Number.isFinite(px) || px <= 0) continue;
        if (!best || liq > best.liq) best = { priceUsd: px, liq, source: 'dexscreener' };
      }
      if (best) return { priceUsd: best.priceUsd, source: best.source };
    }
  } catch (e) {
    console.error('c7 price dexscreener failed', e && e.message);
  }
  const fallback = Number(process.env.BADGE_C7_PRICE_USD_FALLBACK || '0');
  if (fallback > 0) return { priceUsd: fallback, source: 'env_fallback' };
  throw new Error('could not lock $C7 amount — price unavailable');
}

/**
 * @param {number} priceUsd
 * @returns {{ amountAtomic: string, amountDisplay: string, priceUsd: number }}
 */
export function lockC7Amount(priceUsd, usd = C7_USD) {
  const px = Number(priceUsd);
  if (!(px > 0)) throw new Error('invalid C7 price');
  const tokens = usd / px;
  const scale = 10 ** C7_DECIMALS;
  const atomic = BigInt(Math.ceil(tokens * scale));
  const amountDisplay = (Number(atomic) / scale).toFixed(C7_DECIMALS).replace(/\.?0+$/, '');
  return { amountAtomic: String(atomic), amountDisplay, priceUsd: px };
}

export function buildSolanaPayUrl({ recipient, amount, splToken, reference, label, message }) {
  const u = new URL(`solana:${recipient}`);
  if (amount != null) u.searchParams.set('amount', String(amount));
  if (splToken) u.searchParams.set('spl-token', splToken);
  if (reference) u.searchParams.set('reference', reference);
  if (label) u.searchParams.set('label', label);
  if (message) u.searchParams.set('message', message);
  return u.toString();
}

/**
 * EIP-681 ERC-20 transfer URI for mobile wallets (MetaMask / Rainbow / etc).
 * ethereum:<token>@<chainId>/transfer?address=<to>&uint256=<atomic>
 */
export function buildEip681Erc20Transfer({ token, chainId, to, amountAtomic }) {
  const asset = String(token || '').trim();
  const recipient = String(to || '').trim();
  const atomic = String(amountAtomic || '').trim();
  const cid = Number(chainId);
  if (!asset || !recipient || !atomic || !Number.isFinite(cid)) return null;
  return `ethereum:${asset}@${cid}/transfer?address=${recipient}&uint256=${atomic}`;
}

export async function saveOrder(order) {
  const id = String(order.id || '').trim().toUpperCase();
  const row = id && id !== order.id ? { ...order, id } : order;
  if (isDurableRedis()) {
    await redisCommand(['SET', KEY_PREFIX + id, JSON.stringify(row)]);
    await redisCommand(['ZADD', INDEX_KEY, String(Date.parse(row.createdAt) || Date.now()), id]);
    return row;
  }
  const store = readFileStore();
  store.byId[id] = row;
  writeFileStore(store);
  return row;
}

export async function getOrder(id) {
  const key = String(id || '').trim().toUpperCase();
  if (!key) return null;
  if (isDurableRedis()) {
    const row = await redisCommand(['GET', KEY_PREFIX + key]);
    if (!row || !row.result) return null;
    try {
      return applyExpiry(JSON.parse(row.result));
    } catch (e) {
      return null;
    }
  }
  const store = readFileStore();
  const order = store.byId[key] || null;
  return order ? applyExpiry(order) : null;
}

/** Resolve order from id and/or signed token (token hydrates store — never clobber newer state). */
export async function resolveOrder({ id, token } = {}) {
  let fromTok = null;
  if (token) {
    fromTok = verifyOrderToken(token);
  }
  const fromId = id ? await getOrder(id) : null;
  // When token present, also peek store by token id so we don't overwrite paid with stale EXPIRED.
  let fromStore = fromId;
  if (fromTok && !fromStore) {
    fromStore = await getOrder(fromTok.id);
  }
  const merged = preferOrderState(fromStore, fromTok);
  if (merged) {
    try {
      await saveOrder(merged);
    } catch (_) {}
    return merged;
  }
  return null;
}

/** Status rank — higher wins when merging store vs signed-token hydrate. */
const STATUS_RANK = Object.freeze({
  AWAITING_PAYMENT: 10,
  EXPIRED: 20,
  QUALIFY_LOST: 30,
  PAID: 40,
  PENDING_FOUNDER_APPROVAL: 50,
  APPROVED: 55,
  REFUND_PENDING: 60,
  REJECTED: 60,
  REFUNDED: 70,
  ISSUED: 80
});

/**
 * Prefer the more advanced order state. Never let an unpaid lock-expiry
 * (EXPIRED from AWAITING_PAYMENT) clobber a paid / pending / issued order.
 * Stale signed tokens still decode as AWAITING_PAYMENT past expiresAt → EXPIRED;
 * saving that blindly wiped PENDING_FOUNDER_APPROVAL (ORD-2026-00002).
 */
export function preferOrderState(existing, incoming) {
  if (!incoming) return existing || null;
  if (!existing) return incoming;
  if (String(existing.id).toUpperCase() !== String(incoming.id).toUpperCase()) return incoming;

  const rExist = STATUS_RANK[existing.status] || 0;
  const rIn = STATUS_RANK[incoming.status] || 0;

  // Paid-path protection: anything with paidAt / paymentTx beats unpaid EXPIRED/AWAITING.
  const existPaid = !!(existing.paidAt || existing.paymentTx || existing.paymentLane);
  const inPaid = !!(incoming.paidAt || incoming.paymentTx || incoming.paymentLane);
  if (existPaid && !inPaid) return existing;
  if (inPaid && !existPaid) return incoming;

  if (rIn > rExist) return incoming;
  if (rExist > rIn) return existing;

  // Same rank — prefer newer updatedAt / paidAt.
  const tExist = Date.parse(existing.updatedAt || existing.paidAt || existing.createdAt) || 0;
  const tIn = Date.parse(incoming.updatedAt || incoming.paidAt || incoming.createdAt) || 0;
  return tIn >= tExist ? incoming : existing;
}

/** Mark unpaid orders past lock window as EXPIRED. Never touches paid / pending / issued. */
export function applyExpiry(order) {
  if (!order || typeof order !== 'object') return order;
  // Lock protects the *price*, not the approval window.
  if (order.status !== ORDER_STATUSES.AWAITING_PAYMENT) return order;
  // If payment was already recorded, never expire (defensive).
  if (order.paidAt || order.paymentTx || order.paymentLane) return order;
  const exp = Date.parse(order.expiresAt);
  if (Number.isFinite(exp) && Date.now() > exp) {
    return { ...order, status: ORDER_STATUSES.EXPIRED, expiredAt: new Date().toISOString() };
  }
  return order;
}

export async function listOrders({ status, limit = 50 } = {}) {
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));
  /** @type {object[]} */
  let all = [];
  if (isDurableRedis()) {
    const row = await redisCommand(['ZREVRANGE', INDEX_KEY, '0', String(lim * 3 - 1)]);
    const ids = (row && row.result) || [];
    for (const id of ids) {
      const o = await getOrder(id);
      if (o) all.push(o);
    }
  } else {
    const store = readFileStore();
    all = Object.values(store.byId)
      .map(applyExpiry)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  if (status) all = all.filter((o) => o.status === status);
  return all.slice(0, lim);
}

export async function listAwaitingPayment() {
  const all = await listOrders({ limit: 200 });
  return all.filter((o) => o.status === ORDER_STATUSES.AWAITING_PAYMENT);
}

/**
 * Build a new paid-path order. Caller must have already verified qualify.eligible
 * and that the mint has no existing badge. source is always 'paid'.
 */
export async function createPaidOrder({ mint, chainId, qualify, siteUrl }) {
  const m = String(mint || '').trim();
  if (!m) throw new Error('mint required');
  if (!qualify || !qualify.eligible) throw new Error('not badge eligible');

  let n;
  try {
    n = await nextCounter();
  } catch (_) {
    n = null;
  }
  // Serverless without Redis: time+random id (still unique enough for 30m locks).
  const id = n
    ? `ORD-${new Date().getUTCFullYear()}-${String(n).padStart(5, '0')}`
    : `ORD-${new Date().getUTCFullYear()}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.parse(createdAt) + ORDER_TTL_MS).toISOString();

  const usdcAtomic = await allocateUniqueUsdcAtomic();
  const usdcDisplay = formatUsdcDisplay(usdcAtomic);
  const { priceUsd, source: priceSource } = await fetchC7PriceUsd();
  const c7 = lockC7Amount(priceUsd, C7_USD);
  const reference = newSolanaPayReference();
  const SITE = siteUrl || process.env.GUARDIAN_SITE_URL || 'https://cyre.dev';

  const order = {
    schema: 'guardian.order.v1',
    id,
    source: 'paid',
    mint: m,
    // Token's chain from live scan (e.g. ethereum for AAVE) — not the USDC payment chain.
    chainId: String(qualify.chainId || chainId || 'solana'),
    symbol: qualify.symbol || null,
    name: qualify.name || null,
    status: ORDER_STATUSES.AWAITING_PAYMENT,
    createdAt,
    expiresAt,
    qualifySnapshot: {
      path: qualify.path,
      pathLabel: qualify.pathLabel,
      pathFamily: qualify.pathFamily,
      grade: qualify.grade,
      score: qualify.score,
      lpTier: qualify.lpTier,
      lifetimeEligible: qualify.lifetimeEligible,
      badgeEligible: true,
      unlockAt: qualify.unlockAt || null,
      expiresAt: qualify.expiresAt || null,
      reason: qualify.reason || null
    },
    locked: {
      vocabulary: 'locked',
      usdcUsd: USDC_USD,
      usdcAtomic,
      usdcDisplay,
      c7Usd: C7_USD,
      c7Atomic: c7.amountAtomic,
      c7Amount: c7.amountDisplay,
      c7PriceUsd: c7.priceUsd,
      c7PriceSource: priceSource,
      lockedUntil: expiresAt
    },
    payment: {
      usdcBase: {
        lane: 'usdc_base',
        chain: 'base',
        chainId: 8453,
        asset: BASE_USDC,
        assetSymbol: 'USDC',
        to: BASE_TREASURY,
        amountAtomic: usdcAtomic,
        amountDisplay: usdcDisplay,
        amountUsd: USDC_USD,
        eip681Url: buildEip681Erc20Transfer({
          token: BASE_USDC,
          chainId: 8453,
          to: BASE_TREASURY,
          amountAtomic: usdcAtomic
        }),
        note: `Send exactly ${usdcDisplay} USDC on Base to the treasury. The unique cent-amount matches your order.`
      },
      c7Solana: {
        lane: 'c7_solana',
        chain: 'solana',
        asset: C7_MINT,
        assetSymbol: 'C7',
        to: C7_TREASURY,
        amountAtomic: c7.amountAtomic,
        amountDisplay: c7.amountDisplay,
        amountUsd: C7_USD,
        reference,
        solanaPayUrl: buildSolanaPayUrl({
          recipient: C7_TREASURY,
          amount: c7.amountDisplay,
          splToken: C7_MINT,
          reference,
          label: 'Guardian Verified',
          message: `Order ${id}`
        }),
        note: `Send ${c7.amountDisplay} $C7 (locked ≈ $${C7_USD} at order time) to the Solana treasury. Include the Solana Pay reference for exact matching. $C7 payments are recorded in the burn ledger and burned weekly.`
      }
    },
    paidAt: null,
    paymentLane: null,
    paymentTx: null,
    paymentFrom: null,
    issuance: null,
    approval: null,
    refund: null,
    burnLedgerId: null,
    statusUrl: `${SITE}/order/${id}`,
    disclaimer:
      'Guardian Verified is a measured qualifying-path seal with live re-check — patterns and lock evidence, not investment advice. Digital assets are volatile. Payment does not guarantee issuance; founder brand-safety approval is required. Unpaid orders expire after 30 minutes.'
  };

  await saveOrder(order);
  return order;
}

/**
 * Transition helpers — always persist via saveOrder after mutate.
 * @param {object} order
 * @param {object} patch
 */
export async function updateOrder(order, patch) {
  const next = applyExpiry({ ...order, ...patch, updatedAt: new Date().toISOString() });
  await saveOrder(next);
  return next;
}

export function publicOrderView(order) {
  if (!order) return null;
  const o = applyExpiry(order);
  const token = signOrder(o);
  return {
    ok: true,
    id: o.id,
    token,
    source: o.source,
    status: o.status,
    mint: o.mint,
    chainId: o.chainId,
    symbol: o.symbol,
    name: o.name,
    createdAt: o.createdAt,
    expiresAt: o.expiresAt,
    locked: o.locked,
    payment: o.payment,
    paidAt: o.paidAt,
    paymentLane: o.paymentLane,
    paymentTx: o.paymentTx,
    qualifySnapshot: o.qualifySnapshot,
    screenFlags: o.screenFlags || null,
    issuance: o.issuance,
    approval: o.approval
      ? {
          status: o.approval.status,
          decidedAt: o.approval.decidedAt,
          reason: o.approval.reason || null,
          holdReason: o.approval.holdReason || null
        }
      : null,
    refund: o.refund
      ? {
          status: o.refund.status,
          recordedAt: o.refund.recordedAt,
          note: o.refund.note || null
        }
      : null,
    burnLedgerId: o.burnLedgerId,
    statusUrl: o.statusUrl,
    disclaimer: o.disclaimer
  };
}

export function assertPaidSource(order) {
  if (!order || order.source !== 'paid') {
    throw new Error('comp issuance is not an order — use /api/badge/register');
  }
}
