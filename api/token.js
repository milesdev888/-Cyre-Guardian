// api/token.js — Guardian Token Scan
// Facts about a token mint before you trade it. Patterns, not verdicts.
// GET /api/token?mint=<address>
// Optional: &holders=1 → holders-only retry (uses getTokenSupply + largest accounts).
// Site + Vercel previews stay FREE. Agents pay via x402 (see ./_x402.js).
//   X402_PRICE_TOKEN — atomic USDC (default 10000 = $0.01)

import { createX402Gate, applyX402Result, isCyreOrPreviewRequest } from './_x402.js';

const PRIMARY = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const FALLBACKS = String(process.env.SOLANA_RPC_FALLBACK || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const RPCS = [PRIMARY, ...FALLBACKS].filter((u, i, a) => u && a.indexOf(u) === i);

const TOKEN_DESCRIPTION = 'Guardian token scan — mint/freeze authority, holder concentration, and supply facts. Patterns, not verdicts.';

const TOKEN_DISCOVERY = {
  bazaar: {
    info: {
      input: {
        type: 'http',
        method: 'GET',
        queryParams: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' }
      },
      output: {
        type: 'json',
        example: {
          mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          name: 'USD Coin',
          symbol: 'USDC',
          supply: 1000000,
          decimals: 6,
          mintAuthorityRevoked: true,
          freezeAuthorityRevoked: true,
          score: 0,
          risk: 'LOW',
          signals: [{ level: 'good', text: 'Mint authority revoked — supply is fixed.' }]
        }
      }
    },
    schema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        input: {
          type: 'object',
          properties: {
            type: { type: 'string', const: 'http' },
            method: { type: 'string', enum: ['GET', 'HEAD', 'DELETE'] },
            queryParams: {
              type: 'object',
              properties: {
                mint: { type: 'string', description: 'Solana token mint address (base58)' }
              },
              required: ['mint']
            }
          },
          required: ['type', 'method'],
          additionalProperties: false
        },
        output: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            example: {
              type: 'object',
              properties: {
                mint: { type: 'string' },
                name: { type: 'string' },
                symbol: { type: 'string' },
                score: { type: 'number' },
                risk: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
                signals: { type: 'array' }
              }
            }
          },
          required: ['type']
        }
      },
      required: ['input']
    }
  }
};

const x402Gate = createX402Gate({
  price: String(process.env.X402_PRICE_TOKEN || '10000'),
  resourcePath: '/api/token',
  description: TOKEN_DESCRIPTION,
  serviceName: 'CYRE Guardian',
  tags: ['risk', 'fraud', 'solana', 'token', 'security'],
  discovery: TOKEN_DISCOVERY,
  isFree: isCyreOrPreviewRequest
});

// best-effort per-instance throttle (same pattern as api/chat.js)
let calls = 0, windowStart = Date.now();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRateLimited(status, errMsg, errCode) {
  if (status === 429) return true;
  if (errCode === 429 || errCode === -32429) return true;
  const m = String(errMsg || '').toLowerCase();
  return m.includes('too many') || m.includes('rate limit') || m.includes('429');
}

async function rpcOnce(endpoint, method, params) {
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  let j = null;
  try { j = await r.json(); } catch (_) {
    const err = new Error(r.status === 429 ? 'Too many requests' : 'invalid rpc response');
    err.status = r.status;
    throw err;
  }
  if (!r.ok || j.error) {
    const err = new Error((j && j.error && j.error.message) || ('rpc http ' + r.status));
    err.status = r.status;
    err.code = j && j.error && j.error.code;
    throw err;
  }
  return j.result;
}

async function rpc(method, params, opts) {
  const retries = (opts && opts.retries) || 4;
  let lastErr = null;
  for (let i = 0; i < RPCS.length; i++) {
    const endpoint = RPCS[i];
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await rpcOnce(endpoint, method, params);
      } catch (e) {
        lastErr = e;
        if (isRateLimited(e.status, e.message, e.code)) {
          await sleep(350 * Math.pow(2, attempt));
          continue;
        }
        // non-rate errors: try next endpoint
        break;
      }
    }
  }
  throw lastErr || new Error('rpc failed');
}

function accountUiAmount(row, decimalsFallback) {
  if (row == null) return 0;
  if (row.uiAmount != null && Number.isFinite(Number(row.uiAmount))) return Number(row.uiAmount);
  if (row.uiAmountString != null && row.uiAmountString !== '') {
    const n = Number(row.uiAmountString);
    if (Number.isFinite(n)) return n;
  }
  const raw = Number(row.amount);
  if (!Number.isFinite(raw)) return 0;
  const dec = row.decimals != null ? Number(row.decimals) : decimalsFallback;
  return raw / Math.pow(10, Number.isFinite(dec) ? dec : 0);
}

async function measureHoldersViaRpc(mint, supply, decimals) {
  // Prefer confirmed commitment; some providers want a string commitment, others an object.
  let largest = null;
  let lastErr = null;
  const attempts = [
    [mint, { commitment: 'confirmed' }],
    [mint, 'confirmed'],
    [mint]
  ];
  for (let i = 0; i < attempts.length; i++) {
    try {
      largest = await rpc('getTokenLargestAccounts', attempts[i], { retries: 3 });
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      await sleep(200 * (i + 1));
    }
  }
  if (!largest) throw lastErr || new Error('largest accounts unavailable');

  const accounts = (largest && largest.value) || [];
  if (!accounts.length) {
    return { top1: 0, top10: 0, holdersMeasured: true, holderCount: 0, source: 'rpc' };
  }
  const amounts = accounts
    .map((a) => accountUiAmount(a, decimals))
    .filter((n) => n > 0)
    .sort((a, b) => b - a);
  const top1 = supply > 0 ? ((amounts[0] || 0) / supply) * 100 : 0;
  const top10 = supply > 0
    ? (amounts.slice(0, 10).reduce((s, v) => s + v, 0) / supply) * 100
    : 0;
  return {
    top1,
    top10,
    holdersMeasured: true,
    holderCount: amounts.length,
    source: 'rpc'
  };
}

function cleanMetaField(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s || s === 'unknown' || s === 'Unknown') return null;
  return s.slice(0, 64);
}

function metaFromRugcheckReport(d) {
  if (!d || typeof d !== 'object') return { name: null, symbol: null };
  const tm = d.tokenMeta || (d.token_extensions && d.token_extensions.tokenMetadata) || d.fileMeta || {};
  return {
    name: cleanMetaField(tm.name),
    symbol: cleanMetaField(tm.symbol)
  };
}

function holdersFromRugcheckReport(d) {
  const rows = Array.isArray(d && d.topHolders) ? d.topHolders : [];
  const pcts = rows
    .map((h) => Number(h && h.pct))
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => b - a);
  if (!pcts.length) return null;
  return {
    top1: Math.min(100, pcts[0] || 0),
    top10: Math.min(100, pcts.slice(0, 10).reduce((s, v) => s + v, 0)),
    holdersMeasured: true,
    holderCount: pcts.length,
    source: 'index'
  };
}

async function fetchRugcheckReport(mint) {
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch('https://api.rugcheck.xyz/v1/tokens/' + encodeURIComponent(mint) + '/report', {
        headers: { accept: 'application/json' }
      });
      if (!r.ok) throw new Error('holder index http ' + r.status);
      return await r.json();
    } catch (e) {
      lastErr = e;
      await sleep(250 * (attempt + 1));
    }
  }
  throw lastErr || new Error('holder index unavailable');
}

// Indexed holders + token name/symbol from the same RugCheck report.
// We only read pct + metadata fields — never their risk score / "rugged" labels.
async function measureHoldersViaRugcheck(mint) {
  const d = await fetchRugcheckReport(mint);
  const meta = metaFromRugcheckReport(d);
  const holders = holdersFromRugcheckReport(d);
  if (!holders) throw new Error('holder index empty');
  return { ...holders, name: meta.name, symbol: meta.symbol };
}

async function fetchMetaViaJupiter(mint) {
  try {
    const r = await fetch(
      'https://lite-api.jup.ag/tokens/v2/search?query=' + encodeURIComponent(mint),
      { headers: { accept: 'application/json' } }
    );
    if (!r.ok) return { name: null, symbol: null };
    const arr = await r.json();
    const rows = Array.isArray(arr) ? arr : [];
    const hit = rows.find((t) => t && t.id === mint) || rows[0];
    if (!hit) return { name: null, symbol: null };
    return {
      name: cleanMetaField(hit.name),
      symbol: cleanMetaField(hit.symbol)
    };
  } catch (_) {
    return { name: null, symbol: null };
  }
}

async function fetchTokenMeta(mint, seeded) {
  let name = seeded && seeded.name || null;
  let symbol = seeded && seeded.symbol || null;
  if (name || symbol) return { name, symbol };

  try {
    const d = await fetchRugcheckReport(mint);
    const meta = metaFromRugcheckReport(d);
    name = meta.name;
    symbol = meta.symbol;
    if (name || symbol) return { name, symbol };
  } catch (_) { /* try Jupiter */ }

  return fetchMetaViaJupiter(mint);
}

async function measureHolders(mint, supply, decimals) {
  // Prefer indexed holders first (no Solana RPC quota). Fall back to on-chain largest-accounts.
  try {
    return await measureHoldersViaRugcheck(mint);
  } catch (_) { /* try RPC */ }
  return measureHoldersViaRpc(mint, supply, decimals);
}

function buildSignals(mintAuthority, freezeAuthority, holders) {
  const signals = [];
  let score = 0;

  if (mintAuthority) {
    score += 30;
    signals.push({ level: 'high', text: 'Mint authority is ACTIVE — the creator can print unlimited new supply at any time.' });
  } else {
    signals.push({ level: 'good', text: 'Mint authority revoked — supply is fixed.' });
  }

  if (freezeAuthority) {
    score += 25;
    signals.push({ level: 'high', text: 'Freeze authority is ACTIVE — the creator can freeze your tokens in your wallet.' });
  } else {
    signals.push({ level: 'good', text: 'Freeze authority revoked — tokens cannot be frozen.' });
  }

  if (holders.holdersMeasured) {
    const top1 = holders.top1;
    const top10 = holders.top10;
    if (top1 > 20) {
      score += 15;
      signals.push({ level: 'med', text: 'Largest single account holds ' + top1.toFixed(1) + '% of supply. Note: large accounts are sometimes liquidity pools, not individuals.' });
    }
    if (top10 > 60) {
      score += 15;
      signals.push({ level: 'med', text: 'Top 10 accounts hold ' + top10.toFixed(1) + '% of supply — concentrated.' });
    } else if (top10 > 0) {
      signals.push({ level: 'info', text: 'Top 10 accounts hold ' + top10.toFixed(1) + '% of supply.' });
    }
  } else {
    signals.push({ level: 'info', text: 'Holder concentration not measured this run. Mint and freeze authority facts above still apply.' });
  }

  signals.push({ level: 'info', text: 'LP lock status is not assessed in this scan. Verify locks on the pool page before sizing a position.' });

  const risk = score >= 45 ? 'HIGH' : score >= 20 ? 'MEDIUM' : 'LOW';
  return { signals, score, risk };
}

export default async function handler(req, res) {
  const mint = (req.query.mint || '').trim();

  // ----- x402 gate, quote step -----
  // Unpaid callers get the 402 quote BEFORE any input validation, so Bazaar's
  // /validate crawler (bare probe, no params) sees a 402 and not a 400.
  // Nothing is computed or billed here.
  const hasPayment = !!(req.headers['payment-signature'] || req.headers['x-payment']);
  if (!hasPayment) {
    const quote = await x402Gate(req);
    if (applyX402Result(res, quote)) return;
  }

  // throttle: 60 scans/min per warm instance
  const now = Date.now();
  if (now - windowStart > 60000) { calls = 0; windowStart = now; }
  if (++calls > 60) return res.status(429).json({ error: 'slow down' });

  // ----- input validation (refusals stay free — runs before any settle) -----
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint))
    return res.status(400).json({ error: 'not a valid Solana address' });

  const holdersOnly = String(req.query.holders || '') === '1';

  try {
    let mintAuthority = null;
    let freezeAuthority = null;
    let decimals = 0;
    let supply = 0;
    let holders = { top1: 0, top10: 0, holdersMeasured: false, holderCount: 0, source: null };
    let meta = { name: null, symbol: null };

    // ----- mint existence BEFORE settle (reuse result downstream; no duplicate RPC) -----
    let supplyValue = null;
    let mintInfo = null;
    if (holdersOnly) {
      const tokSupply = await rpc('getTokenSupply', [mint, { commitment: 'confirmed' }]);
      supplyValue = tokSupply && tokSupply.value;
      if (!supplyValue) return res.status(404).json({ error: 'mint supply not found' });
    } else {
      const acct = await rpc('getAccountInfo', [mint, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
      if (!acct || !acct.value) return res.status(404).json({ error: 'account not found' });
      const parsed = acct.value.data && acct.value.data.parsed;
      if (!parsed || parsed.type !== 'mint')
        return res.status(400).json({ error: 'address is not a token mint' });
      mintInfo = parsed.info;
    }

    // ----- x402 gate, verify + settle step (paid callers only; mint already resolved) -----
    if (hasPayment) {
      const gate = await x402Gate(req);
      if (applyX402Result(res, gate)) return;
    }

    if (holdersOnly) {
      // Prefer index (no RPC). Only hit chain if the index has no topHolders.
      const holdersP = measureHoldersViaRugcheck(mint).catch(() => null);
      const jupMetaP = fetchMetaViaJupiter(mint);
      const v = supplyValue;
      decimals = Number(v.decimals) || 0;
      supply = Number(v.uiAmount);
      if (!Number.isFinite(supply)) {
        supply = Number(v.amount) / Math.pow(10, decimals);
      }
      holders = (await holdersP) || { top1: 0, top10: 0, holdersMeasured: false, holderCount: 0, source: null };
      meta = { name: holders.name || null, symbol: holders.symbol || null };
      if (!holders.holdersMeasured) {
        try { holders = await measureHoldersViaRpc(mint, supply, decimals); }
        catch (_) { /* leave unmeasured */ }
      }
      if (!meta.name || !meta.symbol) {
        const jup = await jupMetaP;
        meta = { name: meta.name || jup.name, symbol: meta.symbol || jup.symbol };
      }
      if (!meta.name && !meta.symbol) {
        meta = await fetchTokenMeta(mint, meta);
      }
    } else {
      const holdersP = measureHoldersViaRugcheck(mint).catch(() => null);
      const jupMetaP = fetchMetaViaJupiter(mint);
      const info = mintInfo;
      mintAuthority = info.mintAuthority || null;   // null = revoked
      freezeAuthority = info.freezeAuthority || null;
      decimals = info.decimals;
      supply = Number(info.supply) / Math.pow(10, decimals);

      holders = (await holdersP) || { top1: 0, top10: 0, holdersMeasured: false, holderCount: 0, source: null };
      meta = { name: holders.name || null, symbol: holders.symbol || null };
      if (!holders.holdersMeasured) {
        try { holders = await measureHoldersViaRpc(mint, supply, decimals); }
        catch (_) { /* leave unmeasured */ }
      }
      if (!meta.name || !meta.symbol) {
        const jup = await jupMetaP;
        meta = { name: meta.name || jup.name, symbol: meta.symbol || jup.symbol };
      }
      if (!meta.name && !meta.symbol) {
        meta = await fetchTokenMeta(mint, meta);
      }
    }

    if (holdersOnly) {
      res.setHeader('cache-control', 'no-store');
      return res.status(200).json({
        mint,
        name: meta.name,
        symbol: meta.symbol,
        supply,
        decimals,
        top1Pct: holders.holdersMeasured ? +holders.top1.toFixed(2) : null,
        top10Pct: holders.holdersMeasured ? +holders.top10.toFixed(2) : null,
        holdersMeasured: holders.holdersMeasured,
        holdersSource: holders.source || null,
        disclaimer: 'Patterns, not verdicts. This scan reports on-chain facts; it is not investment advice and cannot detect every risk.'
      });
    }

    const { signals, score, risk } = buildSignals(mintAuthority, freezeAuthority, holders);

    res.setHeader('cache-control', 'no-store');
    return res.status(200).json({
      mint,
      name: meta.name,
      symbol: meta.symbol,
      supply, decimals,
      mintAuthorityRevoked: !mintAuthority,
      freezeAuthorityRevoked: !freezeAuthority,
      top1Pct: holders.holdersMeasured ? +holders.top1.toFixed(2) : null,
      top10Pct: holders.holdersMeasured ? +holders.top10.toFixed(2) : null,
      holdersMeasured: holders.holdersMeasured,
      holdersSource: holders.source || null,
      score, risk, signals,
      disclaimer: 'Patterns, not verdicts. This scan reports on-chain facts; it is not investment advice and cannot detect every risk.'
    });
  } catch (e) {
    return res.status(502).json({ error: 'scan failed — RPC busy, try again' });
  }
}
