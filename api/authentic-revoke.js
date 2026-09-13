// api/authentic-revoke.js

import { revokeSeal, normalizeWallet, getSeal } from './_authentic-store.js';
import { cors, readJson, sessionFromReq } from './_authentic-auth.js';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const sess = sessionFromReq(req);
  let body;
  try {
    body = await readJson(req);
  } catch {
    return res.status(400).json({ ok: false, error: 'bad_json' });
  }
  const wallet = (sess && sess.wallet) || normalizeWallet(body.wallet);
  if (!wallet) return res.status(401).json({ ok: false, error: 'auth_required' });

  const serial = String(body.serial || '')
    .trim()
    .toUpperCase();
  if (!serial) return res.status(400).json({ ok: false, error: 'serial_required' });

  const existing = await getSeal(serial);
  if (!existing) return res.status(404).json({ ok: false, error: 'not_found' });

  try {
    const seal = await revokeSeal(serial, wallet);
    return res.status(200).json({
      ok: true,
      serial: seal.serial,
      status: seal.status,
      revokedAt: seal.revokedAt
    });
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (msg === 'forbidden') return res.status(403).json({ ok: false, error: 'forbidden' });
    return res.status(400).json({ ok: false, error: msg });
  }
}
