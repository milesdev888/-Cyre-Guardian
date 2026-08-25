// api/token.js — Guardian Token Scan
// Facts about a token mint before you trade it. Patterns, not verdicts.
// GET /api/token?mint=<address>
// Optional: &holders=1 → holders-only retry (uses getTokenSupply + largest accounts).

const PRIMARY = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const FALLBACKS = String(process.env.SOLANA_RPC_FALLBACK || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const RPCS = [PRIMARY, ...FALLBACKS].filter((u, i, a) => u && a.indexOf(u) === i);
const ALLOWED = ['https://cyre.dev', 'https://www.cyre.dev'];

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

// Fallback when RPC rate-limits getTokenLargestAccounts: RugCheck's measured topHolders.
// We only read percentage fields — never their risk score / "rugged" labels.
async function measureHoldersViaRugcheck(mint) {
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch('https://api.rugcheck.xyz/v1/tokens/' + encodeURIComponent(mint) + '/report', {
        headers: { accept: 'application/json' }
      });
      if (!r.ok) throw new Error('holder index http ' + r.status);
      const d = await r.json();
      const rows = Array.isArray(d.topHolders) ? d.topHolders : [];
      if (!rows.length) throw new Error('holder index empty');
      const pcts = rows
        .map((h) => Number(h && h.pct))
        .filter((n) => Number.isFinite(n) && n >= 0)
        .sort((a, b) => b - a);
      if (!pcts.length) throw new Error('holder index missing pct');
      const top1 = Math.min(100, pcts[0] || 0);
      const top10 = Math.min(100, pcts.slice(0, 10).reduce((s, v) => s + v, 0));
      return {
        top1,
        top10,
        holdersMeasured: true,
        holderCount: pcts.length,
        source: 'index'
      };
    } catch (e) {
      lastErr = e;
      await sleep(250 * (attempt + 1));
    }
  }
  throw lastErr || new Error('holder index unavailable');
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
  // origin gate
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const ok = ALLOWED.some((a) => origin === a || referer.startsWith(a));
  if (!ok) return res.status(403).json({ error: 'forbidden' });

  // throttle: 60 scans/min per warm instance
  const now = Date.now();
  if (now - windowStart > 60000) { calls = 0; windowStart = now; }
  if (++calls > 60) return res.status(429).json({ error: 'slow down' });

  const mint = (req.query.mint || '').trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint))
    return res.status(400).json({ error: 'not a valid Solana address' });

  const holdersOnly = String(req.query.holders || '') === '1';

  try {
    let mintAuthority = null;
    let freezeAuthority = null;
    let decimals = 0;
    let supply = 0;
    let holders = { top1: 0, top10: 0, holdersMeasured: false, holderCount: 0, source: null };

    if (holdersOnly) {
      // Prefer index (no RPC). Only hit chain if the index has no topHolders.
      try {
        holders = await measureHoldersViaRugcheck(mint);
      } catch (_) {
        holders = { top1: 0, top10: 0, holdersMeasured: false, holderCount: 0, source: null };
      }
      const tokSupply = await rpc('getTokenSupply', [mint, { commitment: 'confirmed' }]);
      const v = tokSupply && tokSupply.value;
      if (!v) return res.status(404).json({ error: 'mint supply not found' });
      decimals = Number(v.decimals) || 0;
      supply = Number(v.uiAmount);
      if (!Number.isFinite(supply)) {
        supply = Number(v.amount) / Math.pow(10, decimals);
      }
      if (!holders.holdersMeasured) {
        try { holders = await measureHoldersViaRpc(mint, supply, decimals); }
        catch (_) { /* leave unmeasured */ }
      }
    } else {
      // Mint account + holder index in parallel so holders don't wait on (or share) RPC quota
      const acctP = rpc('getAccountInfo', [mint, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
      const holdersP = measureHoldersViaRugcheck(mint).catch(() => null);
      const acct = await acctP;
      if (!acct || !acct.value) return res.status(404).json({ error: 'account not found' });
      const parsed = acct.value.data && acct.value.data.parsed;
      if (!parsed || parsed.type !== 'mint')
        return res.status(400).json({ error: 'address is not a token mint' });

      const info = parsed.info;
      mintAuthority = info.mintAuthority || null;   // null = revoked
      freezeAuthority = info.freezeAuthority || null;
      decimals = info.decimals;
      supply = Number(info.supply) / Math.pow(10, decimals);

      holders = (await holdersP) || { top1: 0, top10: 0, holdersMeasured: false, holderCount: 0, source: null };
      if (!holders.holdersMeasured) {
        try { holders = await measureHoldersViaRpc(mint, supply, decimals); }
        catch (_) { /* leave unmeasured */ }
      }
    }

    if (holdersOnly) {
      res.setHeader('cache-control', 'no-store');
      return res.status(200).json({
        mint,
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
      mint, supply, decimals,
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
