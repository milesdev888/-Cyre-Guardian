// api/badge-verify.js — Phase 2 step 1: free public verify for a badge serial.
// GET /api/badge/verify?serial=GRD-…  → { ok, valid, badge }

import { getBadgeBySerial, normalizeSerial, isDurableBadgeStore } from './_badge-registry.js';
import { recordVerifyHit } from './_traffic.js';

const DISCLAIMER = 'Patterns, not verdicts. A serial proves a past eligible scan — re-scan for live risk.';

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
  if (!raw) {
    return res.status(200).json({
      ok: true,
      howTo: 'GET /api/badge/verify?serial=GRD-YYYYMMDD-XXXXXXXX',
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
  return res.status(200).json({
    ok: true,
    valid: !expired,
    expired,
    badge,
    durable: isDurableBadgeStore(),
    disclaimer: DISCLAIMER
  });
}
