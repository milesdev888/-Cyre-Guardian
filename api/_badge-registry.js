// api/_badge-registry.js — Phase 2 step 1: durable badge serial registry.
// Redis (Upstash/KV REST) when configured; else ephemeral /tmp file (dev/preview).
// Serials are opaque public identifiers — never mint-specific special cases.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const FILE_STORE = process.env.BADGE_REGISTRY_STORE || '/tmp/guardian-badge-registry.json';
const KEY_PREFIX = 'guardian:badge:';
const COUNTER_KEY = 'guardian:badge:counter';
const BY_MINT_PREFIX = 'guardian:badge:mint:';

const SERIAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Crockford-ish, no I/O/0/1

function redisRestConfig() {
  const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
  if (url.startsWith('https://')) {
    const token =
      process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
    return token ? { url: url.replace(/\/$/, ''), token } : null;
  }
  return null;
}

async function redisCommand(cmd) {
  const cfg = redisRestConfig();
  if (!cfg) return null;
  const r = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + cfg.token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(cmd)
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error('redis ' + r.status + ' ' + t.slice(0, 200));
  }
  return r.json();
}

export function isDurableBadgeStore() {
  return !!redisRestConfig();
}

function emptyFileStore() {
  return { bySerial: {}, byMint: {}, counter: 0 };
}

function readFileStore() {
  try {
    if (!fs.existsSync(FILE_STORE)) return emptyFileStore();
    const data = JSON.parse(fs.readFileSync(FILE_STORE, 'utf8'));
    if (!data || typeof data !== 'object') return emptyFileStore();
    return {
      bySerial: data.bySerial && typeof data.bySerial === 'object' ? data.bySerial : {},
      byMint: data.byMint && typeof data.byMint === 'object' ? data.byMint : {},
      counter: Number(data.counter) || 0
    };
  } catch (e) {
    console.error('badge registry file read failed', e && e.message);
    return emptyFileStore();
  }
}

function writeFileStore(store) {
  try {
    const dir = path.dirname(FILE_STORE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FILE_STORE, JSON.stringify(store));
  } catch (e) {
    console.error('badge registry file write failed', e && e.message);
  }
}

/** @returns {string} GRD-YYYYMMDD-XXXXXXXX */
export function mintSerial(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const bytes = crypto.randomBytes(5);
  let body = '';
  for (let i = 0; i < bytes.length; i++) {
    body += SERIAL_ALPHABET[bytes[i] % SERIAL_ALPHABET.length];
  }
  return `GRD-${y}${m}${d}-${body}`;
}

export function normalizeSerial(raw) {
  const s = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!/^GRD-\d{8}-[A-Z2-9]{5,12}$/.test(s)) return null;
  return s;
}

/**
 * @typedef {object} BadgeRecord
 * @property {string} serial
 * @property {string} mint
 * @property {string} chainId
 * @property {string} [symbol]
 * @property {string} [name]
 * @property {string} grade
 * @property {number|null} [score]
 * @property {string} lpTier
 * @property {boolean} lifetimeEligible
 * @property {boolean} badgeEligible
 * @property {string} issuedAt
 * @property {string|null} [expiresAt]
 * @property {string} [scanUrl]
 * @property {string} schema
 */

/**
 * @param {Omit<BadgeRecord,'serial'|'issuedAt'|'schema'> & { serial?: string }} input
 * @returns {Promise<BadgeRecord>}
 */
export async function registerBadge(input) {
  const mint = String(input.mint || '').trim();
  const chainId = String(input.chainId || 'solana').trim();
  if (!mint) throw new Error('mint required');
  if (!input.badgeEligible) throw new Error('not badge eligible');

  const issuedAt = new Date().toISOString();
  const serial = normalizeSerial(input.serial) || mintSerial(new Date(issuedAt));
  /** @type {BadgeRecord} */
  const record = {
    schema: 'guardian.badge.v1',
    serial,
    mint,
    chainId,
    symbol: input.symbol || undefined,
    name: input.name || undefined,
    grade: String(input.grade || 'U'),
    score: typeof input.score === 'number' ? input.score : null,
    lpTier: String(input.lpTier || 'UNVERIFIED'),
    lifetimeEligible: Boolean(input.lifetimeEligible),
    badgeEligible: true,
    issuedAt,
    expiresAt: input.expiresAt || null,
    scanUrl: input.scanUrl || undefined
  };

  if (redisRestConfig()) {
    const existing = await redisCommand(['GET', BY_MINT_PREFIX + chainId + ':' + mint]);
    if (existing && existing.result) {
      const prior = await getBadgeBySerial(existing.result);
      if (prior) return prior;
    }
    await redisCommand(['SET', KEY_PREFIX + serial, JSON.stringify(record)]);
    await redisCommand(['SET', BY_MINT_PREFIX + chainId + ':' + mint, serial]);
    await redisCommand(['INCR', COUNTER_KEY]);
    return record;
  }

  const store = readFileStore();
  const mintKey = chainId + ':' + mint;
  if (store.byMint[mintKey] && store.bySerial[store.byMint[mintKey]]) {
    return store.bySerial[store.byMint[mintKey]];
  }
  store.bySerial[serial] = record;
  store.byMint[mintKey] = serial;
  store.counter = (store.counter || 0) + 1;
  writeFileStore(store);
  return record;
}

/** @param {string} serial */
export async function getBadgeBySerial(serial) {
  const key = normalizeSerial(serial);
  if (!key) return null;

  if (redisRestConfig()) {
    const row = await redisCommand(['GET', KEY_PREFIX + key]);
    if (!row || !row.result) return null;
    try {
      return JSON.parse(row.result);
    } catch (e) {
      return null;
    }
  }

  const store = readFileStore();
  return store.bySerial[key] || null;
}

/** @param {string} mint @param {string} [chainId] */
export async function getBadgeByMint(mint, chainId = 'solana') {
  const m = String(mint || '').trim();
  if (!m) return null;
  if (redisRestConfig()) {
    const row = await redisCommand(['GET', BY_MINT_PREFIX + chainId + ':' + m]);
    if (!row || !row.result) return null;
    return getBadgeBySerial(row.result);
  }
  const store = readFileStore();
  const serial = store.byMint[chainId + ':' + m];
  return serial ? store.bySerial[serial] || null : null;
}
