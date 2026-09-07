// api/badge-seal.js — GET /api/seal/<serial>.png
// Renders from LIVE registry status only (anti-copy). Unknown → 404 placeholder PNG.

import { getBadgeBySerial, normalizeSerial } from './_badge-registry.js';
import { renderOfficialSeal, renderMissingSealPng } from './_badge-seal-render.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).end('method not allowed');
  }

  let raw = String((req.query && (req.query.serial || req.query.id)) || '').trim();
  // Support /api/seal/GRD-2026-00001.png via rewrite query
  raw = raw.replace(/\.png$/i, '');
  const serial = normalizeSerial(raw);

  if (!serial) {
    const png = renderMissingSealPng();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('X-Guardian-Seal', 'MISSING');
    if (req.method === 'HEAD') return res.status(404).end();
    return res.status(404).end(png);
  }

  const badge = await getBadgeBySerial(serial);
  if (!badge) {
    const png = renderMissingSealPng();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('X-Guardian-Seal', 'MISSING');
    if (req.method === 'HEAD') return res.status(404).end();
    return res.status(404).end(png);
  }

  const status = badge.status || 'VALID';
  const png = await renderOfficialSeal({
    serial: badge.serial,
    ca: badge.mint,
    status
  });

  res.setHeader('Content-Type', 'image/png');
  // ≤10 min TTL so revocation propagates; allow SWR
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=60');
  res.setHeader('X-Guardian-Seal', status);
  res.setHeader('X-Guardian-Seal-Serial', badge.serial);
  res.setHeader('Content-Length', String(png.length));
  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).end(png);
}
