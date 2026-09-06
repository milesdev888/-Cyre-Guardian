// api/badge-verify.js — Phase 2 step 2: free public verify + live re-check.
// GET /api/badge/verify?serial=GRD-2026-00001
//   → { ok, valid, badge, live: { eligible, path, grade, … } }

import { getBadgeBySerial, normalizeSerial, isDurableBadgeStore } from './_badge-registry.js';
import { qualifyFromScan, QUALIFY_PATHS } from './_badge-qualify.js';
import { recordVerifyHit } from './_traffic.js';

const DISCLAIMER =
  'Patterns, not verdicts. Issued serial + live re-check. Live status can change without revoking the serial.';
const SCAN_BASE = process.env.GUARDIAN_SCAN_URL || 'https://guardian-scan.onrender.com';

async function liveRecheck(badge) {
  if (!badge || !badge.mint) {
    return { ok: false, error: 'no mint on badge', eligible: false, path: 'none' };
  }
  const url = `${SCAN_BASE}/api/scan?address=${encodeURIComponent(badge.mint)}`;
  try {
    const r = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'GuardianBadge/2' },
      cache: 'no-store'
    });
    if (!r.ok) {
      return {
        ok: false,
        error: `scan HTTP ${r.status}`,
        eligible: false,
        path: 'none',
        scannedAt: null
      };
    }
    const payload = await r.json();
    const q = qualifyFromScan(payload);
    return {
      ok: true,
      eligible: q.eligible,
      path: q.path,
      reason: q.reason,
      lpTier: q.lpTier,
      grade: q.grade,
      score: q.score,
      lifetimeEligible: q.lifetimeEligible,
      badgeEligible: q.badgeEligible,
      unlockAt: q.unlockAt,
      expiresAt: q.expiresAt,
      scannedAt: payload?.reports?.[0]?.scannedAt || payload?.scannedAt || new Date().toISOString(),
      scanUrl: `${SCAN_BASE}/?address=${encodeURIComponent(badge.mint)}`,
      paths: QUALIFY_PATHS
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'live re-check failed',
      eligible: false,
      path: 'none',
      scannedAt: null
    };
  }
}

export default async function handler(req, res) {
  recordVerifyHit('/api/badge/verify', req);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const raw = String((req.query && (req.query.serial || req.query.id)) || '').trim();
  const skipLive = String((req.query && req.query.live) || '') === '0';

  if (!raw) {
    return res.status(200).json({
      ok: true,
      howTo: 'GET /api/badge/verify?serial=GRD-2026-00001',
      paths: QUALIFY_PATHS,
      durable: isDurableBadgeStore(),
      disclaimer: DISCLAIMER
    });
  }

  const serial = normalizeSerial(raw);
  if (!serial) {
    return res.status(400).json({ ok: false, valid: false, error: 'invalid serial format' });
  }

  const badge = await getBadgeBySerial(serial);
  if (!badge) {
    return res.status(404).json({
      ok: true,
      valid: false,
      serial,
      error: 'serial not found',
      durable: isDurableBadgeStore(),
      disclaimer: DISCLAIMER
    });
  }

  const expired = badge.expiresAt ? Date.parse(badge.expiresAt) <= Date.now() : false;
  const live = skipLive ? null : await liveRecheck(badge);
  const liveEligible = live ? Boolean(live.ok && live.eligible) : null;

  return res.status(200).json({
    ok: true,
    valid: !expired,
    expired,
    badge,
    live,
    stillQualifies: liveEligible,
    durable: isDurableBadgeStore(),
    paths: QUALIFY_PATHS,
    disclaimer: DISCLAIMER
  });
}
