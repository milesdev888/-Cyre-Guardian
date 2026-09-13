// api/authentic-jobs.js

import {
  getAccount,
  enqueueJob,
  getJob,
  getSeal,
  normalizeWallet
} from './_authentic-store.js';
import { cors, readJson, sessionFromReq } from './_authentic-auth.js';
import { PLATFORMS, CORNERS } from './_authentic-compose.js';
import { processOneJob } from './_authentic-worker.js';

export const config = { maxDuration: 60 };

function publicJob(j) {
  if (!j) return null;
  return {
    id: j.id,
    status: j.status,
    platform: j.platform,
    corner: j.corner,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
    startedAt: j.startedAt || null,
    finishedAt: j.finishedAt || null,
    resultSerial: j.resultSerial || null,
    error: j.error || null,
    warnScannableOverride: !!j.warnScannableOverride,
    queueNote:
      j.status === 'pending'
        ? 'Queued — one seal at a time. Stay on this page; uploads do not time out.'
        : null
  };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    const id = String((req.query && req.query.id) || '').trim();
    if (!id) return res.status(400).json({ ok: false, error: 'id_required' });
    const job = await getJob(id);
    if (!job) return res.status(404).json({ ok: false, error: 'not_found' });
    const sess = sessionFromReq(req);
    if (sess && sess.wallet !== job.wallet) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }
    let seal = null;
    if (job.resultSerial) seal = await getSeal(job.resultSerial);
    return res.status(200).json({
      ok: true,
      job: publicJob(job),
      seal: seal
        ? {
            serial: seal.serial,
            status: seal.status,
            checkPath: seal.checkPath,
            platform: seal.platform,
            warnScannableOverride: !!seal.warnScannableOverride,
            imageUrl: `/api/authentic/image?serial=${encodeURIComponent(seal.serial)}`
          }
        : null
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
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

  const acct = await getAccount(wallet);
  if (!acct) return res.status(404).json({ ok: false, error: 'not_registered' });
  if (!acct.paidAt) {
    return res.status(402).json({
      ok: false,
      error: 'payment_required',
      detail: 'Pay $25 USDC on Base once to unlock seal generation. Reissue stays free after that.'
    });
  }

  const platform = String(body.platform || '');
  if (!PLATFORMS[platform]) {
    return res.status(400).json({
      ok: false,
      error: 'bad_platform',
      platforms: Object.keys(PLATFORMS)
    });
  }
  let corner = String(body.corner || 'top-right');
  if (!CORNERS.has(corner)) corner = 'top-right';

  const b64 = String(body.imageBase64 || '').replace(/^data:image\/\w+;base64,/, '');
  if (!b64 || b64.length < 100) return res.status(400).json({ ok: false, error: 'image_required' });
  if (b64.length > 8_000_000) return res.status(413).json({ ok: false, error: 'image_too_large' });

  const job = await enqueueJob({
    wallet,
    platform,
    corner,
    imageBase64: b64,
    reissue: !!acct.activeSerial
  });

  let kick = null;
  try {
    kick = await processOneJob(req);
  } catch (e) {
    kick = { error: String((e && e.message) || e).slice(0, 200) };
  }

  const fresh = await getJob(job.id);
  return res.status(202).json({ ok: true, job: publicJob(fresh || job), worker: kick });
}
