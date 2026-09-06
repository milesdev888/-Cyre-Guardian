// api/_badge-qualify.js — Phase 2 step 2: qualifying paths for Guardian badges.
// Mirrors guardian-scan lp-tier badgeEligible / lifetimeEligible rules.
// Paths are generic (never mint-specific). C7 is only used as an acceptance fixture elsewhere.

/** @typedef {'lifetime'|'timed'|'none'} QualifyPath */

/**
 * @typedef {object} QualifyResult
 * @property {boolean} eligible
 * @property {QualifyPath} path
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
 */

const FAIL = (partial) => ({
  eligible: false,
  path: 'none',
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
  chainId: partial.chainId || 'solana'
});

function daysUntil(iso) {
  if (!iso) return null;
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms)) return null;
  return ms / 86_400_000;
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

/**
 * Qualify a Guardian scan report for badge issuance / live re-check.
 * @param {any} reportOrPayload
 * @returns {QualifyResult}
 */
export function qualifyFromScan(reportOrPayload) {
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

  // Authority gate: live mint/freeze fails qualification even if LP looks good.
  const ownerCheck = (report.checks || []).find((c) => c && c.id === 'owner_privileges');
  if (ownerCheck && ownerCheck.status === 'flag') {
    return FAIL({
      ...base,
      reason: 'mint or freeze authority still live'
    });
  }

  if (lifetimeEligible || lpTier === 'BURNED' || lpTier === 'PERMANENT') {
    if (!badgeEligible && !(lpTier === 'BURNED' || lpTier === 'PERMANENT')) {
      return FAIL({ ...base, reason: 'not badge eligible' });
    }
    return {
      eligible: true,
      path: 'lifetime',
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

  if (lpTier === 'TIMED' || badgeEligible) {
    const remaining = daysUntil(unlockAt);
    if (remaining === null) {
      return FAIL({
        ...base,
        reason: 'timed path requires a public unlock date ≥ 90 days out'
      });
    }
    if (remaining < 90) {
      return FAIL({
        ...base,
        reason: `timed unlock too soon (${Math.floor(remaining)}d remaining; need ≥ 90d)`
      });
    }
    return {
      eligible: true,
      path: 'timed',
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

  return FAIL({
    ...base,
    reason: lpTier
      ? `LP tier ${lpTier} is not a qualifying path`
      : 'no qualifying LP path (need BURNED, PERMANENT, or TIMED ≥ 90d)'
  });
}

export const QUALIFY_PATHS = {
  lifetime: {
    id: 'lifetime',
    label: 'Lifetime',
    detail: 'LP burned or protocol-level permanent lock (e.g. Meteora DAMM v2).'
  },
  timed: {
    id: 'timed',
    label: 'Timed',
    detail: 'Known timed locker with ≥ 90 days remaining. Eligibility expires at unlock.'
  }
};
