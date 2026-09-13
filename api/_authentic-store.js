// api/_authentic-store.js — Guardian Authentic durable records.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { redisCommand, isDurableRedis } from './_redis.js';

const P = 'authentic:';
const accountKey = (w) => P + 'acct:' + String(w || '').toLowerCase();
const sealKey = (s) => P + 'seal:' + String(s || '').toUpperCase();
const jobKey = (id) => P + 'job:' + id;
const COUNTER = P + 'serial:counter';
const QUEUE = P + 'queue';
const LOCK = P + 'worker:lock';
const TMP = path.join('/tmp', 'guardian-authentic');

function ensureTmp() {
  try {
    fs.mkdirSync(TMP, { recursive: true });
  } catch {
    /* ignore */
  }
}
function tmpFile(name) {
  ensureTmp();
  return path.join(TMP, name.replace(/[^a-zA-Z0-9._:-]/g, '_'));
}

async function kvGet(key) {
  if (isDurableRedis()) {
    const row = await redisCommand(['GET', key]);
    const v = row && row.result;
    if (v == null || v === '') return null;
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  try {
    const p = tmpFile(key);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

async function kvSet(key, obj) {
  const raw = JSON.stringify(obj);
  if (isDurableRedis()) {
    await redisCommand(['SET', key, raw]);
    return;
  }
  fs.writeFileSync(tmpFile(key), raw);
}

async function kvDel(key) {
  if (isDurableRedis()) {
    await redisCommand(['DEL', key]);
    return;
  }
  try {
    fs.unlinkSync(tmpFile(key));
  } catch {
    /* ignore */
  }
}

export function normalizeWallet(addr) {
  const a = String(addr || '').trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(a)) return null;
  return a.toLowerCase();
}

export function normalizeHandle(h) {
  let s = String(h || '').trim();
  if (!s) return null;
  if (s.startsWith('@')) s = s.slice(1);
  s = s.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9_]{2,32}$/.test(s)) return null;
  return s;
}

export async function getAccount(wallet) {
  const w = normalizeWallet(wallet);
  if (!w) return null;
  return kvGet(accountKey(w));
}

/** Prefer durable record; if missing, rehydrate from session snapshot into store. */
export async function getAccountForSession(sess) {
  if (!sess || !sess.wallet) return null;
  let acct = await getAccount(sess.wallet);
  if (acct) return acct;
  if (!sess.account || !sess.account.handle) return null;
  return saveAccount({
    wallet: sess.wallet,
    handle: sess.account.handle,
    accountAgeLabel: sess.account.accountAgeLabel || null,
    accountAgeSource: sess.account.accountAgeSource || null,
    registeredAt: sess.account.registeredAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    paidAt: sess.account.paidAt || null,
    paymentTx: sess.account.paymentTx || null,
    paymentNetwork: sess.account.paymentNetwork || null,
    activeSerial: sess.account.activeSerial || null,
    sealCount: sess.account.sealCount || 0
  });
}

export async function saveAccount(account) {
  const w = normalizeWallet(account && account.wallet);
  if (!w) throw new Error('invalid_wallet');
  account.wallet = w;
  account.updatedAt = new Date().toISOString();
  await kvSet(accountKey(w), account);
  return account;
}

export async function getOrCreateAccount(wallet, handle, accountAgeLabel) {
  const w = normalizeWallet(wallet);
  if (!w) throw new Error('invalid_wallet');
  const existing = await getAccount(w);
  if (existing) return existing;
  const h = normalizeHandle(handle);
  if (!h) throw new Error('invalid_handle');
  const now = new Date().toISOString();
  return saveAccount({
    wallet: w,
    handle: h,
    accountAgeLabel: String(accountAgeLabel || '').trim().slice(0, 40) || null,
    accountAgeSource: accountAgeLabel ? 'user-supplied' : null,
    registeredAt: now,
    updatedAt: now,
    paidAt: null,
    paymentTx: null,
    paymentNetwork: null,
    activeSerial: null,
    sealCount: 0
  });
}

export async function markPaid(wallet, { txHash, network }) {
  const acct = await getAccount(wallet);
  if (!acct) throw new Error('account_missing');
  if (acct.paidAt) return acct;
  acct.paidAt = new Date().toISOString();
  acct.paymentTx =
    String(txHash || '').slice(0, 128) || `settled:${Date.now().toString(16)}`;
  acct.paymentNetwork = String(network || 'base').slice(0, 32);
  return saveAccount(acct);
}

export async function nextSerial() {
  const year = new Date().getUTCFullYear();
  let n = 1;
  if (isDurableRedis()) {
    const row = await redisCommand(['INCR', COUNTER]);
    n = Number(row && row.result) || 1;
  } else {
    const p = tmpFile(COUNTER);
    try {
      n = Number(fs.readFileSync(p, 'utf8') || '0') + 1;
    } catch {
      n = 1;
    }
    fs.writeFileSync(p, String(n));
  }
  return `GA-${year}-${String(n).padStart(5, '0')}`;
}

export async function getSeal(serial) {
  return kvGet(sealKey(serial));
}

export async function saveSeal(seal) {
  seal.serial = String(seal.serial || '').toUpperCase();
  seal.updatedAt = new Date().toISOString();
  await kvSet(sealKey(seal.serial), seal);
  return seal;
}

/** Issue seal; prior active → superseded. Optional meta.serial from nextSerial(). */
export async function issueSeal(account, meta = {}) {
  const serial = String(meta.serial || (await nextSerial())).toUpperCase();
  const now = new Date().toISOString();
  if (account.activeSerial && account.activeSerial !== serial) {
    const prev = await getSeal(account.activeSerial);
    if (prev && prev.status === 'valid') {
      prev.status = 'superseded';
      prev.supersededBy = serial;
      prev.supersededAt = now;
      await saveSeal(prev);
    }
  }
  const seal = {
    serial,
    wallet: account.wallet,
    handle: account.handle,
    accountAgeLabel: account.accountAgeLabel,
    accountAgeSource: account.accountAgeSource,
    registeredAt: account.registeredAt,
    status: 'valid',
    platform: meta.platform || null,
    corner: meta.corner || 'top-right',
    createdAt: now,
    updatedAt: now,
    paymentTx: account.paymentTx,
    imagePngBase64: meta.imagePngBase64 || null,
    warnScannableOverride: !!meta.warnScannableOverride,
    composeMeta: meta.composeMeta || null,
    checkPath: `/authentic/c/${serial}`,
    supersededBy: null,
    revokedAt: null
  };
  await saveSeal(seal);
  account.activeSerial = serial;
  account.sealCount = (account.sealCount || 0) + 1;
  await saveAccount(account);
  return seal;
}

export async function revokeSeal(serial, wallet) {
  const seal = await getSeal(serial);
  if (!seal) throw new Error('not_found');
  const w = normalizeWallet(wallet);
  if (seal.wallet !== w) throw new Error('forbidden');
  if (seal.status === 'revoked') return seal;
  seal.status = 'revoked';
  seal.revokedAt = new Date().toISOString();
  await saveSeal(seal);
  const acct = await getAccount(w);
  if (acct && acct.activeSerial === seal.serial) {
    acct.activeSerial = null;
    await saveAccount(acct);
  }
  return seal;
}

export function newJobId() {
  return 'job_' + crypto.randomBytes(8).toString('hex');
}

export async function enqueueJob(job) {
  job.id = job.id || newJobId();
  job.status = 'pending';
  job.createdAt = new Date().toISOString();
  job.updatedAt = job.createdAt;
  job.error = null;
  job.resultSerial = null;
  await kvSet(jobKey(job.id), job);
  if (isDurableRedis()) {
    await redisCommand(['LPUSH', QUEUE, job.id]);
  } else {
    const qp = tmpFile(QUEUE);
    let q = [];
    try {
      q = JSON.parse(fs.readFileSync(qp, 'utf8'));
    } catch {
      q = [];
    }
    q.push(job.id);
    fs.writeFileSync(qp, JSON.stringify(q));
  }
  return job;
}

export async function getJob(id) {
  return kvGet(jobKey(id));
}

export async function saveJob(job) {
  job.updatedAt = new Date().toISOString();
  await kvSet(jobKey(job.id), job);
  return job;
}

export async function popNextJobId() {
  if (isDurableRedis()) {
    const row = await redisCommand(['RPOP', QUEUE]);
    return (row && row.result) || null;
  }
  const qp = tmpFile(QUEUE);
  let q = [];
  try {
    q = JSON.parse(fs.readFileSync(qp, 'utf8'));
  } catch {
    q = [];
  }
  const id = q.shift() || null;
  fs.writeFileSync(qp, JSON.stringify(q));
  return id;
}

export async function acquireWorkerLock(ttlSec = 90) {
  const token = crypto.randomBytes(8).toString('hex');
  const payload = { token, until: Date.now() + ttlSec * 1000 };
  if (isDurableRedis()) {
    const row = await redisCommand(['SET', LOCK, JSON.stringify(payload), 'NX']);
    const ok = row && (row.result === 'OK' || row.result === true);
    if (ok) return token;
    const cur = await kvGet(LOCK);
    if (cur && cur.until && cur.until < Date.now()) {
      await kvSet(LOCK, payload);
      return token;
    }
    return null;
  }
  const p = tmpFile(LOCK);
  try {
    if (fs.existsSync(p)) {
      const cur = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (cur.until && cur.until > Date.now()) return null;
    }
  } catch {
    /* ignore */
  }
  fs.writeFileSync(p, JSON.stringify(payload));
  return token;
}

export async function releaseWorkerLock(token) {
  const cur = await kvGet(LOCK);
  if (cur && cur.token && token && cur.token !== token) return;
  await kvDel(LOCK);
}

export function siteBase(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'cyre.dev')
    .split(',')[0]
    .trim();
  return `${proto}://${host}`;
}
