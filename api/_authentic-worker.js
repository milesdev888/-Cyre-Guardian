// api/_authentic-worker.js — single-flight seal job processor.

import {
  acquireWorkerLock,
  releaseWorkerLock,
  popNextJobId,
  getJob,
  saveJob,
  getAccount,
  nextSerial,
  issueSeal,
  siteBase
} from './_authentic-store.js';
import { composeAuthenticSeal, PLATFORMS } from './_authentic-compose.js';

export async function processOneJob(req) {
  const token = await acquireWorkerLock(90);
  if (!token) return { busy: true };

  try {
    const id = await popNextJobId();
    if (!id) return { idle: true };

    const job = await getJob(id);
    if (!job) return { missing: id };

    job.status = 'running';
    job.startedAt = new Date().toISOString();
    await saveJob(job);

    try {
      const account = await getAccount(job.wallet);
      if (!account) throw new Error('account_missing');
      if (!account.paidAt) throw new Error('payment_required');
      if (!PLATFORMS[job.platform]) throw new Error('bad_platform');

      const imageBuf = Buffer.from(String(job.imageBase64 || ''), 'base64');
      if (imageBuf.length < 100) throw new Error('bad_image');

      // Reserve serial before compose so QR encodes the final check URL.
      // Supersede only after a successful compose (inside issueSeal).
      const serial = await nextSerial();
      const checkUrl = `${siteBase(req)}/authentic/c/${serial}`;

      const { png, meta } = await composeAuthenticSeal({
        imageBuf,
        platform: job.platform,
        corner: job.corner || 'top-right',
        handle: account.handle, // account record only — never from job payload
        checkUrl
      });

      const seal = await issueSeal(account, {
        serial,
        platform: job.platform,
        corner: job.corner,
        imagePngBase64: png.toString('base64'),
        warnScannableOverride: !!meta.warnScannableOverride,
        composeMeta: meta
      });

      job.status = 'done';
      job.resultSerial = seal.serial;
      job.warnScannableOverride = !!meta.warnScannableOverride;
      job.finishedAt = new Date().toISOString();
      delete job.imageBase64;
      await saveJob(job);
      return {
        done: true,
        jobId: job.id,
        serial: seal.serial,
        warn: job.warnScannableOverride
      };
    } catch (e) {
      job.status = 'error';
      job.error = String((e && e.message) || e).slice(0, 300);
      job.finishedAt = new Date().toISOString();
      delete job.imageBase64;
      await saveJob(job);
      return { error: job.error, jobId: job.id };
    }
  } finally {
    await releaseWorkerLock(token);
  }
}
