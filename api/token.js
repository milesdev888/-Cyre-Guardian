// api/token.js — Guardian Token Scan
// Facts about a token mint before you trade it. Patterns, not verdicts.
// GET /api/token?mint=<address>

const RPC = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const ALLOWED = ['https://cyre.dev', 'https://www.cyre.dev'];

// best-effort per-instance throttle (same pattern as api/chat.js)
let calls = 0, windowStart = Date.now();

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || 'rpc error');
  return j.result;
}

export default async function handler(req, res) {
  // origin gate
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const ok = ALLOWED.some(a => origin === a || referer.startsWith(a));
  if (!ok) return res.status(403).json({ error: 'forbidden' });

  // throttle: 60 scans/min per warm instance
  const now = Date.now();
  if (now - windowStart > 60000) { calls = 0; windowStart = now; }
  if (++calls > 60) return res.status(429).json({ error: 'slow down' });

  const mint = (req.query.mint || '').trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint))
    return res.status(400).json({ error: 'not a valid Solana address' });

  try {
    // 1. mint account (jsonParsed gives us authorities + decimals + supply)
    const acct = await rpc('getAccountInfo', [mint, { encoding: 'jsonParsed' }]);
    if (!acct || !acct.value) return res.status(404).json({ error: 'account not found' });
    const parsed = acct.value.data && acct.value.data.parsed;
    if (!parsed || parsed.type !== 'mint')
      return res.status(400).json({ error: 'address is not a token mint' });

    const info = parsed.info;
    const mintAuthority = info.mintAuthority || null;   // null = revoked
    const freezeAuthority = info.freezeAuthority || null;
    const decimals = info.decimals;
    const supply = Number(info.supply) / Math.pow(10, decimals);

    // 2. largest holders
    const largest = await rpc('getTokenLargestAccounts', [mint]);
    const accounts = (largest && largest.value) || [];
    const amounts = accounts.map(a => Number(a.uiAmount) || 0);
    const top1 = supply > 0 ? (amounts[0] || 0) / supply * 100 : 0;
    const top10 = supply > 0 ? amounts.slice(0, 10).reduce((s, v) => s + v, 0) / supply * 100 : 0;

    // 3. score — facts in, points out
    const signals = [];
    let score = 0;

    if (mintAuthority) { score += 30; signals.push({ level: 'high', text: 'Mint authority is ACTIVE — the creator can print unlimited new supply at any time.' }); }
    else signals.push({ level: 'good', text: 'Mint authority revoked — supply is fixed.' });

    if (freezeAuthority) { score += 25; signals.push({ level: 'high', text: 'Freeze authority is ACTIVE — the creator can freeze your tokens in your wallet.' }); }
    else signals.push({ level: 'good', text: 'Freeze authority revoked — tokens cannot be frozen.' });

    if (top1 > 20) { score += 15; signals.push({ level: 'med', text: `Largest single account holds ${top1.toFixed(1)}% of supply. Note: large accounts are sometimes liquidity pools, not individuals.` }); }
    if (top10 > 60) { score += 15; signals.push({ level: 'med', text: `Top 10 accounts hold ${top10.toFixed(1)}% of supply — concentrated.` }); }
    else if (top10 > 0) signals.push({ level: 'info', text: `Top 10 accounts hold ${top10.toFixed(1)}% of supply.` });

    signals.push({ level: 'info', text: 'LP lock status is not assessed in this scan. Verify locks on the pool page before sizing a position.' });

    const risk = score >= 45 ? 'HIGH' : score >= 20 ? 'MEDIUM' : 'LOW';

    res.setHeader('cache-control', 's-maxage=60');
    return res.status(200).json({
      mint, supply, decimals,
      mintAuthorityRevoked: !mintAuthority,
      freezeAuthorityRevoked: !freezeAuthority,
      top1Pct: +top1.toFixed(2),
      top10Pct: +top10.toFixed(2),
      score, risk, signals,
      disclaimer: 'Patterns, not verdicts. This scan reports on-chain facts; it is not investment advice and cannot detect every risk.'
    });
  } catch (e) {
    return res.status(502).json({ error: 'scan failed — RPC busy, try again' });
  }
}
