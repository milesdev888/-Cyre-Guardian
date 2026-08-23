// api/passport.js — CYRE Passport v1
// Portable RWA profile from measured address signals (same 1k-sig window).
// No LLM in the hot path. Patterns, not verdicts. No invented metrics.
// Env: SOLANA_RPC (same as /api/address)

const RPC = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DAY = 86400;
const DISCLAIMER = 'Patterns, not verdicts.';

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || 'RPC error');
  return d.result;
}

function signal(id, name, points, triggered, detail) {
  return { id, name, points, triggered, detail };
}

function buildMeasured(address, list, bal) {
  const now = Math.floor(Date.now() / 1000);
  const sol = (bal && typeof bal.value === 'number' ? bal.value : 0) / 1e9;
  const fetchedAt = new Date().toISOString();

  if (!list.length) {
    return {
      version: 1,
      kind: 'cyre-passport',
      address,
      fetchedAt,
      empty: true,
      score: null,
      riskLevel: null,
      profile: {
        ageDays: 0,
        ageIsMinimum: false,
        idleDays: 0,
        transactionsSeen: 0,
        last24h: 0,
        failedPercent: 0,
        longestGapDays: 0,
        balanceSol: Number(sol.toFixed(4))
      },
      signals: [],
      signalsTriggered: 0,
      signalsEvaluated: 0,
      message: 'No transaction history found for this address.',
      disclaimer: DISCLAIMER
    };
  }

  const times = list.map((s) => s.blockTime).filter(Boolean).sort((a, b) => a - b);
  const earliest = times[0] || now;
  const latest = times[times.length - 1] || now;
  const ageDays = Math.floor((now - earliest) / DAY);
  const idleDays = Math.floor((now - latest) / DAY);
  const capped = list.length >= 1000;

  const last24 = times.filter((t) => now - t < DAY).length;
  const failed = list.filter((s) => s.err).length;
  const failRate = list.length ? failed / list.length : 0;

  let biggestGap = 0;
  for (let i = 1; i < times.length; i++) {
    const g = times[i] - times[i - 1];
    if (g > biggestGap) biggestGap = g;
  }
  const gapDays = Math.floor(biggestGap / DAY);

  const signals = [];

  signals.push(
    capped
      ? signal(
          'age',
          'Wallet age',
          0,
          false,
          ageDays < 1
            ? 'Too active to date — the 1,000 most recent transactions all landed within a day; first activity is older than this window reaches'
            : `Active for at least ${ageDays} days — history runs deeper than the 1,000-transaction window`
        )
      : ageDays < 7
        ? signal('age', 'Wallet age', 26, true, `First activity ${ageDays} day${ageDays === 1 ? '' : 's'} ago — a very new wallet`)
        : ageDays < 30
          ? signal('age', 'Wallet age', 12, true, `First activity ${ageDays} days ago`)
          : signal('age', 'Wallet age', 0, false, `First activity ${ageDays} days ago`)
  );

  signals.push(
    last24 >= 40
      ? signal('burst', 'Activity burst', 24, true, `${last24} transactions in the last 24 hours`)
      : last24 >= 15
        ? signal('burst', 'Activity burst', 12, true, `${last24} transactions in the last 24 hours`)
        : signal('burst', 'Activity burst', 0, false, `${last24} transactions in the last 24 hours`)
  );

  signals.push(
    failRate > 0.3
      ? signal(
          'failures',
          'Failed transactions',
          18,
          true,
          `${Math.round(failRate * 100)}% of recent transactions failed — often automated behaviour`
        )
      : signal(
          'failures',
          'Failed transactions',
          0,
          false,
          `${Math.round(failRate * 100)}% of recent transactions failed`
        )
  );

  signals.push(
    gapDays >= 90 && idleDays < 7
      ? signal('dormant', 'Dormant then active', 20, true, `Was inactive for ${gapDays} days, then moved again recently`)
      : signal(
          'dormant',
          'Dormant then active',
          0,
          false,
          gapDays ? `Longest quiet stretch was ${gapDays} days` : 'Activity is continuous'
        )
  );

  signals.push(
    sol < 0.01 && list.length > 20
      ? signal(
          'balance',
          'Balance vs activity',
          14,
          true,
          `Holds ${sol.toFixed(4)} SOL despite ${list.length}+ recent transactions — pass-through pattern`
        )
      : signal('balance', 'Balance vs activity', 0, false, `Holds ${sol.toFixed(4)} SOL`)
  );

  signals.push(
    list.length < 5
      ? signal(
          'history',
          'Transaction history',
          10,
          true,
          `Only ${list.length} transaction${list.length === 1 ? '' : 's'} on record`
        )
      : signal(
          'history',
          'Transaction history',
          0,
          false,
          capped ? '1,000+ recent transactions' : `${list.length} transactions on record`
        )
  );

  const score = Math.min(
    signals.reduce((s, x) => s + x.points, 0),
    100
  );
  const riskLevel = score < 30 ? 'LOW' : score < 70 ? 'MEDIUM' : 'HIGH';

  return {
    version: 1,
    kind: 'cyre-passport',
    address,
    fetchedAt,
    empty: false,
    score,
    riskLevel,
    profile: {
      ageDays,
      ageIsMinimum: capped,
      idleDays,
      transactionsSeen: list.length,
      last24h: last24,
      failedPercent: Math.round(failRate * 100),
      longestGapDays: gapDays,
      balanceSol: Number(sol.toFixed(4))
    },
    signals,
    signalsTriggered: signals.filter((s) => s.triggered).length,
    signalsEvaluated: signals.length,
    disclaimer: DISCLAIMER
  };
}

export default async function handler(req, res) {
  const address = String((req.query && req.query.address) || '').trim();

  if (!B58.test(address)) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({
      ok: false,
      error: 'That does not look like a Solana address.',
      disclaimer: DISCLAIMER
    });
  }

  try {
    const [sigs, bal] = await Promise.all([
      rpc('getSignaturesForAddress', [address, { limit: 1000 }]),
      rpc('getBalance', [address])
    ]);
    const list = Array.isArray(sigs) ? sigs : [];
    const passport = buildMeasured(address, list, bal);

    res.setHeader('Cache-Control', 'no-store'); // fresh measured passport only — never CDN-reuse
    return res.status(200).json({
      ok: true,
      ...passport
    });
  } catch (e) {
    console.error('passport', e && e.message);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      ok: false,
      error: 'Could not read chain data right now. Try again in a moment.',
      disclaimer: DISCLAIMER
    });
  }
}
