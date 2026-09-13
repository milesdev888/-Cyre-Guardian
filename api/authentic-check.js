// api/authentic-check.js

import { getSeal, getAccount } from './_authentic-store.js';
import { cors } from './_authentic-auth.js';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const serial = String((req.query && (req.query.serial || req.query.s)) || '')
    .trim()
    .toUpperCase();
  if (!serial) return res.status(400).json({ ok: false, error: 'serial_required' });

  const seal = await getSeal(serial);
  if (!seal) {
    res.setHeader('Cache-Control', 'public, max-age=30');
    return res.status(404).json({ ok: false, error: 'not_found' });
  }

  const acct = await getAccount(seal.wallet);
  // Same account record as the seal image — never a generate-time field.
  const handle = (acct && acct.handle) || seal.handle || null;
  const accountAgeLabel =
    (acct && acct.accountAgeLabel) || seal.accountAgeLabel || null;
  const accountAgeSource =
    (acct && acct.accountAgeSource) || seal.accountAgeSource || 'user-supplied';
  const registeredAt = (acct && acct.registeredAt) || seal.registeredAt || null;

  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  return res.status(200).json({
    ok: true,
    serial: seal.serial,
    handle,
    status: seal.status,
    accountAgeLabel,
    accountAgeSource,
    registeredAt,
    createdAt: seal.createdAt,
    revokedAt: seal.revokedAt,
    supersededBy: seal.supersededBy,
    supersededAt: seal.supersededAt || null,
    platform: seal.platform,
    checkPath: seal.checkPath,
    imageUrl: seal.imagePngBase64
      ? `/api/authentic/image?serial=${encodeURIComponent(seal.serial)}`
      : null,
    expandQrUrl: `/api/authentic/image?serial=${encodeURIComponent(seal.serial)}&plate=1`
  });
}
