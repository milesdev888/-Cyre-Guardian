// scripts/authentic-smoke.mjs — local smoke: compose + store queue + supersede/revoke.
import fs from 'node:fs';
import path from 'node:path';
import { encodePng } from '../api/_badge-og-render.js';
import { composeAuthenticSeal } from '../api/_authentic-compose.js';
import {
  getOrCreateAccount,
  markPaid,
  enqueueJob,
  getSeal,
  getJob,
  revokeSeal,
  getAccount
} from '../api/_authentic-store.js';
import { processOneJob } from '../api/_authentic-worker.js';

function solidPng(w, h, rgb) {
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = rgb[0];
    rgba[i * 4 + 1] = rgb[1];
    rgba[i * 4 + 2] = rgb[2];
    rgba[i * 4 + 3] = 255;
  }
  return encodePng(rgba, w, h);
}

const outDir = path.join('/tmp', 'authentic-smoke');
fs.mkdirSync(outDir, { recursive: true });

const photo = solidPng(800, 600, [40, 80, 60]);

const banner = await composeAuthenticSeal({
  imageBuf: photo,
  platform: 'x-banner',
  corner: 'top-right',
  handle: 'milesdev',
  checkUrl: 'https://cyre.dev/authentic/c/GA-2026-00001'
});
fs.writeFileSync(path.join(outDir, 'x-banner.png'), banner.png);
console.log('banner', banner.meta.width, banner.meta.height, 'modulePx', banner.meta.modulePx, 'warn', banner.meta.warnScannableOverride);
if (banner.meta.width !== 1500 || banner.meta.height !== 500) throw new Error('banner dims');
if (banner.meta.modulePx < 5) throw new Error('module floor');

const avatar = await composeAuthenticSeal({
  imageBuf: photo,
  platform: 'x-avatar',
  corner: 'top-right',
  handle: 'milesdev',
  checkUrl: 'https://cyre.dev/authentic/c/GA-2026-00001'
});
fs.writeFileSync(path.join(outDir, 'x-avatar.png'), avatar.png);
console.log('avatar', avatar.meta.width, avatar.meta.height, 'modulePx', avatar.meta.modulePx, 'warn', avatar.meta.warnScannableOverride);
if (avatar.meta.modulePx < 5) throw new Error('avatar module floor');
if (!avatar.meta.warnScannableOverride) throw new Error('expected scannable override on 400px');

const wallet = '0x' + 'ab'.repeat(20);
const acct = await getOrCreateAccount(wallet, 'milesdev', 'since 2018');
await markPaid(wallet, { txHash: '0xsmoke', network: 'base' });

const req = { headers: { host: 'localhost', 'x-forwarded-proto': 'http' } };

const job1 = await enqueueJob({
  wallet,
  platform: 'x-banner',
  corner: 'top-right',
  imageBase64: photo.toString('base64')
});
const job2 = await enqueueJob({
  wallet,
  platform: 'x-avatar',
  corner: 'top-right',
  imageBase64: photo.toString('base64')
});

const r1 = await processOneJob(req);
console.log('job1', r1);
const r2 = await processOneJob(req);
console.log('job2', r2);

const j1 = await getJob(job1.id);
const j2 = await getJob(job2.id);
if (j1.status !== 'done' || j2.status !== 'done') throw new Error('jobs not done');

const s1 = await getSeal(j1.resultSerial);
const s2 = await getSeal(j2.resultSerial);
if (s1.status !== 'superseded') throw new Error('first should be superseded after reissue');
if (s2.status !== 'valid') throw new Error('second should be valid');
if (s1.handle !== 'milesdev' || s2.handle !== 'milesdev') throw new Error('handle mismatch');

await revokeSeal(s2.serial, wallet);
const revoked = await getSeal(s2.serial);
if (revoked.status !== 'revoked') throw new Error('revoke failed');

const fresh = await getAccount(wallet);
console.log('account', {
  handle: fresh.handle,
  paidAt: fresh.paidAt,
  paymentTx: fresh.paymentTx,
  activeSerial: fresh.activeSerial,
  sealCount: fresh.sealCount
});
console.log('OK authentic smoke →', outDir);
