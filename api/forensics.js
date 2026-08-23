// api/forensics.js — CYRE Forensics v1
// Thin measured-pattern board for one Solana address.
// Reuses the same 1k-sig window + seed-mint hold/touch as Watch/Passport.
// No LLM. Patterns, not verdicts. No invented metrics.
// Env: SOLANA_RPC (same as /api/address)

const RPC = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DAY = 86400;
const HOUR = 3600;
const DISCLAIMER = 'Patterns, not verdicts.';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

// SPEC Watch seed mints — hold/touch affinity only (no weights/scores).
const SEED_MINTS = [
  { symbol: 'USDY', mint: 'A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6' },
  { symbol: 'OUSG', mint: 'i7u4r16TcsJTgq1kAG8opmVZyVnAKBwLKu6ZPMwzxNc' },
  { symbol: 'syrupUSDC', mint: 'AvZZF1YaZDziPY2RCK4oJrRVrbN3mTD9NL24hPeaZeUj' },
  { symbol: 'AAPLx', mint: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp' },
  { symbol: 'TSLAx', mint: 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB' },
  { symbol: 'SPYx', mint: 'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W' }
];

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

function buildMintAffinity(tokenAccounts) {
  const byMint = new Map();
  const list = Array.isArray(tokenAccounts) ? tokenAccounts : [];
  for (const acc of list) {
    const info =
      acc &&
      acc.account &&
      acc.account.data &&
      acc.account.data.parsed &&
      acc.account.data.parsed.info;
    if (!info || !info.mint) continue;
    const amountRaw = info.tokenAmount && info.tokenAmount.amount;
    let amount = 0;
    if (typeof amountRaw === 'string') amount = Number(amountRaw);
    else if (typeof amountRaw === 'number') amount = amountRaw;
    const prev = byMint.get(info.mint) || { touch: false, hold: false };
    prev.touch = true;
    if (amount > 0) prev.hold = true;
    byMint.set(info.mint, prev);
  }
  return SEED_MINTS.map(({ symbol, mint }) => {
    const hit = byMint.get(mint);
    return {
      symbol,
      mint,
      hold: !!(hit && hit.hold),
      touch: !!(hit && hit.touch)
    };
  });
}

function buildPatterns(list, mintAffinity) {
  const now = Math.floor(Date.now() / 1000);
  const times = list.map((s) => s.blockTime).filter(Boolean).sort((a, b) => a - b);
  const latest = times.length ? times[times.length - 1] : now;
  const idleDays = Math.floor((now - latest) / DAY);

  const last24 = times.filter((t) => now - t < DAY).length;
  const lastHour = times.filter((t) => now - t < HOUR).length;
  const failed = list.filter((s) => s.err).length;
  const failsHour = list.filter((s) => s.err && s.blockTime && now - s.blockTime < HOUR).length;
  const failRate = list.length ? failed / list.length : 0;

  let biggestGap = 0;
  for (let i = 1; i < times.length; i++) {
    const g = times[i] - times[i - 1];
    if (g > biggestGap) biggestGap = g;
  }
  const gapDays = Math.floor(biggestGap / DAY);

  const patterns = [];

  // dormant→active — same measured rule family as Watch alerts / address signals
  const dormantTriggered = gapDays >= 90 && idleDays < 7;
  patterns.push({
    id: 'dormant_then_active',
    pattern: 'dormant→active',
    triggered: dormantTriggered,
    detail: dormantTriggered
      ? `Was inactive for ${gapDays} days, then moved again recently (idle ${idleDays} day${idleDays === 1 ? '' : 's'}).`
      : gapDays
        ? `Longest quiet stretch in this 1,000-sig window was ${gapDays} days; not a recent re-activation.`
        : 'Activity is continuous in this window.',
    measured: { longestGapDays: gapDays, idleDays }
  });

  // burst — measured last-24h / last-hour counts only
  const burstTriggered = last24 >= 15 || lastHour >= 40;
  patterns.push({
    id: 'burst',
    pattern: 'burst',
    triggered: burstTriggered,
    detail:
      lastHour >= 40
        ? `${lastHour} transactions in the last hour (measured in this run).`
        : `${last24} transactions in the last 24 hours (measured in this run).`,
    measured: { last24h: last24, lastHour }
  });

  // failure spike — measured fail ratio in window / last hour
  const hourSpike = lastHour >= 10 && failsHour / lastHour >= 0.4;
  const windowSpike = failRate > 0.3 && list.length >= 10;
  const failTriggered = hourSpike || windowSpike;
  patterns.push({
    id: 'failure_spike',
    pattern: 'failure spike',
    triggered: failTriggered,
    detail: hourSpike
      ? `${Math.round((failsHour / lastHour) * 100)}% of last-hour transactions failed (${failsHour}/${lastHour}).`
      : `${Math.round(failRate * 100)}% of recent transactions failed (${failed}/${list.length}).`,
    measured: {
      failedPercent: Math.round(failRate * 100),
      failedCount: failed,
      lastHourFailed: failsHour,
      lastHour
    }
  });

  // mint-affinity — hold/touch yes|no vs SPEC seed mints (no weights)
  const holds = (mintAffinity || []).filter((m) => m.hold).map((m) => m.symbol);
  const touches = (mintAffinity || [])
    .filter((m) => m.touch && !m.hold)
    .map((m) => m.symbol);
  const affinityTriggered = holds.length > 0 || touches.length > 0;
  patterns.push({
    id: 'mint_affinity',
    pattern: 'mint-affinity',
    triggered: affinityTriggered,
    detail: affinityTriggered
      ? [
          holds.length ? `Hold: ${holds.join(', ')}` : null,
          touches.length ? `Touch (zero balance): ${touches.join(', ')}` : null
        ]
          .filter(Boolean)
          .join(' · ')
      : 'No hold/touch against SPEC seed RWA mints in token accounts.',
    measured: { mintAffinity: mintAffinity || [] }
  });

  // Later taxonomy — named but not evaluated cheaply in v1
  patterns.push({
    id: 'collateral_loop',
    pattern: 'collateral-loop',
    triggered: false,
    evaluated: false,
    detail: 'Not evaluated in Forensics v1 — needs instruction-level decode beyond the cheap sig window.',
    measured: null
  });
  patterns.push({
    id: 'transfer_hook_friction',
    pattern: 'transfer-hook/eligibility friction',
    triggered: false,
    evaluated: false,
    detail: 'Not evaluated in Forensics v1 — Token-2022 extension introspection deferred (cost).',
    measured: null
  });

  return {
    patterns,
    counters: {
      patternsEvaluated: patterns.filter((p) => p.evaluated !== false).length,
      patternsTriggered: patterns.filter((p) => p.triggered).length,
      patternsDeferred: patterns.filter((p) => p.evaluated === false).length,
      transactionsSeen: list.length,
      last24h: last24,
      lastHour,
      failedPercent: Math.round(failRate * 100),
      longestGapDays: gapDays,
      idleDays
    }
  };
}

export default async function handler(req, res) {
  const address = String((req.query && req.query.address) || '').trim();
  res.setHeader('Cache-Control', 'no-store');

  if (!B58.test(address)) {
    return res.status(400).json({
      ok: false,
      error: 'That does not look like a Solana address.',
      disclaimer: DISCLAIMER
    });
  }

  try {
    const [sigs, bal, tokenAccounts] = await Promise.all([
      rpc('getSignaturesForAddress', [address, { limit: 1000 }]),
      rpc('getBalance', [address]),
      rpc('getTokenAccountsByOwner', [
        address,
        { programId: TOKEN_PROGRAM },
        { encoding: 'jsonParsed' }
      ]).catch(() => null)
    ]);

    const list = Array.isArray(sigs) ? sigs : [];
    const sol = (bal && typeof bal.value === 'number' ? bal.value : 0) / 1e9;
    const accounts =
      tokenAccounts && Array.isArray(tokenAccounts.value)
        ? tokenAccounts.value
        : Array.isArray(tokenAccounts)
          ? tokenAccounts
          : [];
    const mintAffinity = buildMintAffinity(accounts);
    const fetchedAt = new Date().toISOString();

    if (!list.length) {
      return res.status(200).json({
        ok: true,
        kind: 'cyre-forensics',
        version: 1,
        address,
        empty: true,
        balanceSol: Number(sol.toFixed(4)),
        patterns: [],
        mintAffinity,
        counters: {
          patternsEvaluated: 0,
          patternsTriggered: 0,
          patternsDeferred: 2,
          transactionsSeen: 0,
          last24h: 0,
          lastHour: 0,
          failedPercent: 0,
          longestGapDays: 0,
          idleDays: 0
        },
        window: {
          signaturesLimit: 1000,
          signaturesFetched: 0,
          lastChecked: fetchedAt
        },
        message: 'No transaction history found for this address.',
        deferred: ['collateral-loop', 'transfer-hook/eligibility friction'],
        disclaimer: DISCLAIMER,
        checkedAt: fetchedAt
      });
    }

    const built = buildPatterns(list, mintAffinity);

    return res.status(200).json({
      ok: true,
      kind: 'cyre-forensics',
      version: 1,
      address,
      empty: false,
      balanceSol: Number(sol.toFixed(4)),
      patterns: built.patterns,
      mintAffinity,
      counters: built.counters,
      window: {
        signaturesLimit: 1000,
        signaturesFetched: list.length,
        lastChecked: fetchedAt
      },
      deferred: ['collateral-loop', 'transfer-hook/eligibility friction'],
      disclaimer: DISCLAIMER,
      checkedAt: fetchedAt
    });
  } catch (e) {
    console.error('forensics', e && e.message);
    return res.status(200).json({
      ok: false,
      error: 'Could not read chain data right now. Try again in a moment.',
      disclaimer: DISCLAIMER
    });
  }
}
