// api/badge-register.js — Phase 2 step 1: issue a Guardian badge serial.
// POST { mint, chainId?, grade, score?, lpTier, lifetimeEligible, badgeEligible, symbol?, name?, expiresAt?, scanUrl? }
// Idempotent per mint+chain. FREE for cyre.dev site; no x402 yet (step 1 registry only).

import { registerBadge, isDurableBadgeStore, getBadgeByMint } from './_badge-registry.js';
import { isCyreSiteRequest } from './_x402.js';

const DISCLAIMER = 'Patterns, not verdicts. Badge serials attest scan eligibility at issue time.';
const SCAN_BASE = process.env.GUARDIAN_SCAN_URL || 'https://guardian-scan.onrender.com';

function readBody(req) {
  const b = req.body;
  if (!b) return null;
  if (typeof b === 'string') {
    try {
      return JSON.parse(b);
    } catch (e) {
      return null;
    }
  }
  return b;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    const mint = String((req.query && req.query.mint) || '').trim();
    const chainId = String((req.query && req.query.chainId) || 'solana').trim();
    if (mint) {
      const existing = await getBadgeByMint(mint, chainId);
      return res.status(200).json({
        ok: true,
        found: Boolean(existing),
        badge: existing,
        durable: isDurableBadgeStore(),
        disclaimer: DISCLAIMER
      });
    }
    return res.status(200).json({
      ok: true,
      howTo: {
        register: 'POST /api/badge/register with scan eligibility fields (badgeEligible must be true)',
        verify: 'GET /api/badge/verify?serial=GRD-… or /verify/GRD-…'
      },
      durable: isDurableBadgeStore(),
      scanBase: SCAN_BASE,
      disclaimer: DISCLAIMER
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  // Step 1: allow site + open register for wiring; tighten with x402 in a later step.
  if (!isCyreSiteRequest(req) && process.env.BADGE_REGISTER_OPEN !== '1') {
    // Still allow in non-production / when durable store missing (local).
    if (process.env.VERCEL_ENV === 'production' && isDurableBadgeStore()) {
      return res.status(403).json({
        ok: false,
        error: 'badge register is site-gated in production until x402 step lands'
      });
    }
  }

  const body = readBody(req) || {};
  const mint = String(body.mint || '').trim();
  if (!mint) return res.status(400).json({ ok: false, error: 'mint required' });
  if (!body.badgeEligible) {
    return res.status(422).json({
      ok: false,
      error: 'not badge eligible',
      detail: 'lp.badgeEligible must be true from a Guardian scan before a serial can issue.'
    });
  }

  try {
    const badge = await registerBadge({
      mint,
      chainId: body.chainId || 'solana',
      symbol: body.symbol,
      name: body.name,
      grade: body.grade,
      score: body.score,
      lpTier: body.lpTier,
      lifetimeEligible: Boolean(body.lifetimeEligible),
      badgeEligible: true,
      expiresAt: body.expiresAt || null,
      scanUrl: body.scanUrl || `${SCAN_BASE}/?address=${encodeURIComponent(mint)}`
    });
    return res.status(200).json({
      ok: true,
      badge,
      verifyUrl: `https://cyre.dev/verify/${badge.serial}`,
      durable: isDurableBadgeStore(),
      disclaimer: DISCLAIMER
    });
  } catch (e) {
    return res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : 'register failed'
    });
  }
}
