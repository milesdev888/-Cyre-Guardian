// api/_badge-qualify.js — Phase 2: qualifying paths for Guardian badges.
// Paths: lifetime | timed | established | none
// ESTABLISHED (all required; age alone never qualifies):
//   deployed ≥2y, ≥3 independent pools, no single-pool majority, ≥$100k liquidity,
//   no mint/freeze/owner powers, no revocation history in the registry.

/** @typedef {'lifetime'|'timed'|'established'|'none'} QualifyPath */

/**
 * @typedef {object} QualifyResult
 * @property {boolean} eligible
 * @property {QualifyPath} path
 * @property {string} pathLabel
 * @property {string} pathFamily  secured | established | none
 * @property {string} reason
 * @property {string|null} lpTier
 * @property {boolean} lifetimeEligible
 * @property {boolean} badgeEligible
 * @property {string|null} unlockAt
 * @property {string|null} expiresAt
 * @property {string|null} grade
 * @property {number|null} score
 * @property {string|null} symbol
 * @property {string|null} name
 * @property {string|null} mint
 * @property {string} chainId
 * @property {object} [established]
 */

const DAY_MS = 86_400_000;
const ESTABLISHED_MIN_AGE_DAYS = 730; // ≥ 2 years
const ESTABLISHED_MIN_POOLS = 3;
const ESTABLISHED_MIN_LIQUIDITY_USD = 100_000;

export const QUALIFY_PATHS = {
  lifetime: {
    id: 'lifetime',
    label: 'Lifetime',
    family: 'secured',
    detail: 'LP burned or protocol-level permanent lock (e.g. Meteora DAMM v2).'
  },
  timed: {
    id: 'timed',
    label: 'Timed',
    family: 'secured',
    detail: 'Known timed locker with ≥ 90 days remaining. Eligibility expires at unlock.'
  },
  established: {
    id: 'established',
    label: 'Established',
    family: 'established',
    detail:
      'Deployed ≥2 years, ≥3 independent pools with no single majority, ≥$100K liquidity, no mint/freeze/owner powers, no revocation history. Age alone never qualifies.'
  }
};

const FAIL = (partial) => ({
  eligible: false,
  path: 'none',
  pathLabel: 'None',
  pathFamily: 'none',
  reason: partial.reason || 'not eligible',
  lpTier: partial.lpTier ?? null,
  lifetimeEligible: false,
  badgeEligible: false,
  unlockAt: partial.unlockAt ?? null,
  expiresAt: null,
  grade: partial.grade ?? null,
  score: partial.score ?? null,
  symbol: partial.symbol ?? null,
  name: partial.name ?? null,
  mint: partial.mint ?? null,
  chainId: partial.chainId || 'solana',
  established: partial.established
});

function daysUntil(iso) {
  if (!iso) return null;
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms)) return null;
  return ms / DAY_MS;
}

function daysAgo(ts) {
  if (ts == null) return null;
  let ms;
  if (typeof ts === 'number') {
    ms = ts < 10_000_000_000 ? ts * 1000 : ts;
  } else {
    ms = Date.parse(String(ts));
  }
  if (!Number.isFinite(ms)) return null;
  return (Date.now() - ms) / DAY_MS;
}

export function pathLabel(path) {
  if (path === 'lifetime') return 'Lifetime';
  if (path === 'timed') return 'Timed';
  if (path === 'established') return 'Established';
  return 'None';
}

export function pathFamily(path) {
  if (path === 'lifetime' || path === 'timed') return 'secured';
  if (path === 'established') return 'established';
  return 'none';
}

/** Seal / presentation mark: SECURED | ESTABLISHED (equal prestige). */
export function pathMark(familyOrPath) {
  const raw = String(familyOrPath || '').toLowerCase();
  if (raw === 'established') return 'ESTABLISHED';
  if (raw === 'secured' || raw === 'lifetime' || raw === 'timed') return 'SECURED';
  const fam = pathFamily(raw);
  if (fam === 'established') return 'ESTABLISHED';
  if (fam === 'secured') return 'SECURED';
  return null;
}

/**
 * Extract the first Guardian report from a scan API payload or a bare report.
 * @param {any} payload
 */
export function extractScanReport(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.schema === 'guardian.report.v2') return payload;
  if (Array.isArray(payload.reports) && payload.reports[0]) return payload.reports[0];
  if (payload.report && payload.report.schema === 'guardian.report.v2') return payload.report;
  return null;
}

function tokenAgeDays(report) {
  const pools = Array.isArray(report.pools) ? report.pools : [];
  const created = pools
    .map((p) => p && p.createdAt)
    .filter((v) => v != null)
    .map((v) => (typeof v === 'number' ? (v < 10_000_000_000 ? v * 1000 : v) : Date.parse(String(v))))
    .filter((n) => Number.isFinite(n));
  if (created.length) {
    return daysAgo(Math.min(...created));
  }
  const ageCheck = (report.checks || []).find((c) => c && c.id === 'contract_age');
  if (ageCheck && typeof ageCheck.evidence?.ageDays === 'number') {
    return ageCheck.evidence.ageDays;
  }
  // Parse "First pool is N days old" as fallback only for diagnostics — not for sole qualification.
  if (ageCheck && typeof ageCheck.summary === 'string') {
    const m = ageCheck.summary.match(/(\d+)\s*days?\s*old/i);
    if (m) return Number(m[1]);
  }
  return null;
}

/**
 * Independent pools + liquidity concentration for ESTABLISHED.
 * @param {any} report
 */
export function analyzePools(report) {
  const pools = Array.isArray(report.pools) ? report.pools : [];
  const rows = pools
    .map((p) => ({
      dex: String(p?.dex || p?.dexId || 'unknown').toLowerCase(),
      pair: String(p?.pairAddress || p?.address || ''),
      liquidityUsd: Number(p?.liquidityUsd) || 0
    }))
    .filter((p) => p.liquidityUsd > 0 || p.pair);

  // Independent = unique pair address when present, else dex+index
  const seen = new Set();
  const independent = [];
  for (const row of rows) {
    const key = row.pair || `${row.dex}:${independent.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    independent.push(row);
  }

  const total = independent.reduce((s, r) => s + r.liquidityUsd, 0);
  const maxShare = total > 0 ? Math.max(...independent.map((r) => r.liquidityUsd / total)) : 1;
  return {
    poolCount: independent.length,
    totalLiquidityUsd: total,
    maxPoolShare: maxShare,
    noSingleMajority: independent.length >= 2 && maxShare <= 0.5,
    pools: independent
  };
}

/**
 * @param {any} report
 * @param {{ hasRevocationHistory?: boolean }} [opts]
 */
export function evaluateEstablished(report, opts = {}) {
  const ageDays = tokenAgeDays(report);
  const pools = analyzePools(report);
  const ownerCheck = (report.checks || []).find((c) => c && c.id === 'owner_privileges');
  const authoritiesClean = !(ownerCheck && ownerCheck.status === 'flag');
  const ageOk = ageDays != null && ageDays >= ESTABLISHED_MIN_AGE_DAYS;
  const poolsOk = pools.poolCount >= ESTABLISHED_MIN_POOLS;
  const liqOk = pools.totalLiquidityUsd >= ESTABLISHED_MIN_LIQUIDITY_USD;
  const majorityOk = pools.noSingleMajority;
  const revocationOk = !opts.hasRevocationHistory;

  const checks = {
    ageDays,
    ageOk,
    poolCount: pools.poolCount,
    poolsOk,
    totalLiquidityUsd: pools.totalLiquidityUsd,
    liqOk,
    maxPoolShare: pools.maxPoolShare,
    majorityOk,
    authoritiesClean,
    revocationOk
  };

  // Age alone never qualifies — require every criterion.
  const eligible =
    ageOk && poolsOk && liqOk && majorityOk && authoritiesClean && revocationOk;

  // Path B fail copy — never "LP unlocked" / lock-centric wording
  let reason = 'established path';
  if (!eligible) {
    if (!majorityOk) reason = 'liquidity concentration exceeded threshold';
    else if (!liqOk) reason = `total liquidity below $${ESTABLISHED_MIN_LIQUIDITY_USD.toLocaleString('en-US')}`;
    else if (!poolsOk) reason = `fewer than ${ESTABLISHED_MIN_POOLS} independent pools`;
    else if (!authoritiesClean) reason = 'mint or freeze authority restored';
    else if (!revocationOk) reason = 'revocation history on record';
    else if (!ageOk)
      reason = `on-chain age below ${ESTABLISHED_MIN_AGE_DAYS} days`;
    else reason = 'established path criteria not met';
  }

  return { eligible, reason, checks, pools };
}

/**
 * Live re-check for an already-issued badge — tests THAT path's bars only.
 * Established badges never fall through Path A (lock) criteria.
 * @param {any} reportOrPayload
 * @param {{ pathFamily?: string, qualifyPath?: string, hasRevocationHistory?: boolean }} [opts]
 */
export function recheckIssuedPath(reportOrPayload, opts = {}) {
  const family = String(opts.pathFamily || pathFamily(opts.qualifyPath) || '').toLowerCase();
  const report = extractScanReport(reportOrPayload) || reportOrPayload;
  if (!report || typeof report !== 'object') {
    return FAIL({ reason: 'no scan report' });
  }

  if (family === 'established') {
    const mint = report.token?.address || null;
    const chainId = report.chain?.id || 'solana';
    const symbol = report.token?.symbol || null;
    const name = report.token?.name || null;
    const grade = report.grade || null;
    const score = typeof report.score === 'number' ? report.score : null;
    const lp = report.lp || {};

    // Fraud flags — Path B live bars
    const checks = report.checks || [];
    const honeypot = checks.find((c) => c && c.id === 'honeypot_simulation');
    const holders = checks.find((c) => c && c.id === 'holder_concentration');
    if (honeypot && honeypot.status === 'flag') {
      return FAIL({
        reason: 'new fraud flag on record (honeypot pattern)',
        grade,
        score,
        symbol,
        name,
        mint,
        chainId,
        lpTier: lp.tier || null
      });
    }
    if (holders && holders.status === 'flag') {
      return FAIL({
        reason: 'new fraud flag on record (holder concentration)',
        grade,
        score,
        symbol,
        name,
        mint,
        chainId,
        lpTier: lp.tier || null
      });
    }

    const est = evaluateEstablished(report, opts);
    if (est.eligible) {
      return {
        eligible: true,
        path: 'established',
        pathLabel: 'Established',
        pathFamily: 'established',
        reason: 'Still qualifies · Established path',
        lpTier: lp.tier || null,
        lifetimeEligible: false,
        badgeEligible: true,
        unlockAt: null,
        expiresAt: null,
        grade,
        score,
        symbol,
        name,
        mint,
        chainId,
        established: est.checks
      };
    }
    return FAIL({
      reason: est.reason,
      grade,
      score,
      symbol,
      name,
      mint,
      chainId,
      lpTier: lp.tier || null,
      established: est.checks
    });
  }

  // Secured (and unknown) — full path ladder
  return qualifyFromScan(reportOrPayload, opts);
}

/**
 * Qualify a Guardian scan report for badge issuance / live re-check.
 * @param {any} reportOrPayload
 * @param {{ hasRevocationHistory?: boolean }} [opts]
 * @returns {QualifyResult}
 */
export function qualifyFromScan(reportOrPayload, opts = {}) {
  const report = extractScanReport(reportOrPayload) || reportOrPayload;
  if (!report || typeof report !== 'object') {
    return FAIL({ reason: 'no scan report' });
  }

  const mint = report.token?.address || report.address || null;
  const chainId = report.chain?.id || report.chainId || 'solana';
  const symbol = report.token?.symbol || null;
  const name = report.token?.name || null;
  const grade = report.grade || null;
  const score = typeof report.score === 'number' ? report.score : null;
  const lp = report.lp || {};
  const lpTier = lp.tier || null;
  const unlockAt = lp.unlockAt || null;
  const lifetimeEligible = Boolean(lp.lifetimeEligible);
  const badgeEligible = Boolean(lp.badgeEligible);

  const base = {
    lpTier,
    unlockAt,
    grade,
    score,
    symbol,
    name,
    mint,
    chainId
  };

  // Authority gate for secured paths.
  const ownerCheck = (report.checks || []).find((c) => c && c.id === 'owner_privileges');
  const authoritiesLive = ownerCheck && ownerCheck.status === 'flag';

  // 1) Lifetime (secured)
  if (!authoritiesLive && (lifetimeEligible || lpTier === 'BURNED' || lpTier === 'PERMANENT')) {
    if (badgeEligible || lpTier === 'BURNED' || lpTier === 'PERMANENT') {
      return {
        eligible: true,
        path: 'lifetime',
        pathLabel: 'Lifetime',
        pathFamily: 'secured',
        reason: `lifetime path · LP ${lpTier || 'locked'}`,
        lpTier,
        lifetimeEligible: true,
        badgeEligible: true,
        unlockAt: null,
        expiresAt: null,
        grade,
        score,
        symbol,
        name,
        mint,
        chainId
      };
    }
  }

  // 2) Timed (secured)
  if (!authoritiesLive && (lpTier === 'TIMED' || (badgeEligible && unlockAt))) {
    const remaining = daysUntil(unlockAt);
    if (remaining !== null && remaining >= 90) {
      return {
        eligible: true,
        path: 'timed',
        pathLabel: 'Timed',
        pathFamily: 'secured',
        reason: `timed path · unlock ${String(unlockAt).slice(0, 10)}`,
        lpTier: lpTier || 'TIMED',
        lifetimeEligible: false,
        badgeEligible: true,
        unlockAt,
        expiresAt: unlockAt,
        grade,
        score,
        symbol,
        name,
        mint,
        chainId
      };
    }
  }

  // 3) Established — all criteria; age alone never qualifies
  const est = evaluateEstablished(report, opts);
  if (est.eligible) {
    return {
      eligible: true,
      path: 'established',
      pathLabel: 'Established',
      pathFamily: 'established',
      reason: est.reason,
      lpTier,
      lifetimeEligible: false,
      badgeEligible: true,
      unlockAt: null,
      expiresAt: null,
      grade,
      score,
      symbol,
      name,
      mint,
      chainId,
      established: est.checks
    };
  }

  if (authoritiesLive) {
    return FAIL({
      ...base,
      reason: 'mint or freeze authority still live',
      established: est.checks
    });
  }

  // Prefer the most informative failure reason
  if (lpTier === 'TIMED') {
    const remaining = daysUntil(unlockAt);
    if (remaining === null) {
      return FAIL({
        ...base,
        reason: 'timed path requires a public unlock date ≥ 90 days out',
        established: est.checks
      });
    }
    if (remaining < 90) {
      return FAIL({
        ...base,
        reason: `timed unlock too soon (${Math.floor(remaining)}d remaining; need ≥ 90d)`,
        established: est.checks
      });
    }
  }

  return FAIL({
    ...base,
    reason: est.reason || (lpTier
      ? `LP tier ${lpTier} is not a qualifying path`
      : 'no qualifying path (lifetime, timed ≥90d, or established)'),
    established: est.checks
  });
}
