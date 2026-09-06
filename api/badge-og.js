// api/badge-og.js — GET /api/badge/og?serial=GRD-2026-00001 → 1200×630 PNG from LIVE check

import { getBadgeBySerial, normalizeSerial } from './_badge-registry.js';
import { qualifyFromScan, pathLabel } from './_badge-qualify.js';
import { renderBadgeOg, formatUtc } from './_badge-og-render.js';

const SCAN_BASE = process.env.GUARDIAN_SCAN_URL || 'https://guardian-scan.onrender.com';

async function liveRecheck(badge) {
  const url = `${SCAN_BASE}/api/scan?address=${encodeURIComponent(badge.mint)}`;
  const r = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'GuardianBadgeOG/2' },
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`scan HTTP ${r.status}`);
  const payload = await r.json();
  const q = qualifyFromScan(payload, { hasRevocationHistory: badge.status === 'REVOKED' });
  return {
    q,
    scannedAt: payload?.reports?.[0]?.scannedAt || payload?.scannedAt || new Date().toISOString()
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).end('method not allowed');

  const raw = String((req.query && (req.query.serial || req.query.id)) || '').trim();
  const serial = normalizeSerial(raw);
  if (!serial) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain');
    return res.end('serial required');
  }

  const badge = await getBadgeBySerial(serial);
  if (!badge) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    return res.end('not found');
  }

  let status = badge.status || 'VALID';
  let livePath = pathLabel(badge.qualifyPath);
  let liveGrade = badge.grade;
  let checkedAt = new Date().toISOString();

  try {
    const { q, scannedAt } = await liveRecheck(badge);
    checkedAt = scannedAt;
    livePath = q.pathLabel || pathLabel(q.path);
    liveGrade = q.grade || badge.grade;
    if (badge.expiresAt && Date.parse(badge.expiresAt) <= Date.now()) status = 'EXPIRED';
    else if (!q.eligible) status = 'REVOKED';
    else status = 'VALID';
  } catch (e) {
    // Keep issued status if scan fails; still render card
    if (badge.expiresAt && Date.parse(badge.expiresAt) <= Date.now()) status = 'EXPIRED';
  }

  const png = renderBadgeOg({
    serial: badge.serial,
    symbol: badge.symbol,
    name: badge.name,
    pathLabel: badge.pathLabel || pathLabel(badge.qualifyPath),
    pathFamily: badge.pathFamily,
    grade: badge.grade,
    score: badge.score,
    lpTier: badge.lpTier,
    status,
    issuedAt: badge.issuedAt,
    liveGrade,
    livePath,
    checkedAt
  });

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  res.setHeader('X-Guardian-Badge-Status', status);
  res.setHeader('X-Guardian-Badge-Checked-At', formatUtc(checkedAt));
  return res.status(200).end(png);
}
