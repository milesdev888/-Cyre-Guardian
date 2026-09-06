// api/_badge-registry.js — Phase 2: durable badge serial registry.
// Serial format: GRD-YYYY-NNNNN (e.g. GRD-2026-00001).
// Redis (Upstash/KV REST) when configured; else ephemeral /tmp file (dev/preview).
// Genesis serial GRD-2026-00001 is seeded for C7 acceptance (generic registry + fixture).

import fs from 'node:fs';
import path from 'node:path';

const FILE_STORE = process.env.BADGE_REGISTRY_STORE || '/tmp/guardian-badge-registry.json';
const KEY_PREFIX = 'guardian:badge:';
const COUNTER_KEY = 'guardian:badge:counter:';
const BY_MINT_PREFIX = 'guardian:badge:mint:';

/** First acceptance serial — C7 on Solana (fixture only; qualification stays generic). */
export const GENESIS_SERIAL = 'GRD-2026-00001';
export const GENESIS_MINT = '979sitxCjWFPdAsrF2ybKNENwFcpiHDwaAasC5Xa5qww';
export const GENESIS_CHAIN = 'solana';

export const GENESIS_BADGE = {
  schema: 'guardian.badge.v1',
  serial: GENESIS_SERIAL,
  mint: GENESIS_MINT,
  chainId: GENESIS_CHAIN,
  symbol: 'C7',
  name: 'CYRE',
  grade: 'A',
  score: 91,
  lpTier: 'PERMANENT',
  qualifyPath: 'lifetime',
  pathLabel: 'Lifetime',
  pathFamily: 'secured',
  status: 'VALID',
  lifetimeEligible: true,
  badgeEligible: true,
  issuedAt: '2026-09-06T22:00:00.000Z',
  expiresAt: null,
  scanUrl: `https://guardian-scan.onrender.com/?address=${GENESIS_MINT}`,
  note: 'Genesis acceptance serial — Phase 2 step 2'
};

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
  return {
    bySerial: { [GENESIS_SERIAL]: { ...GENESIS_BADGE } },
    byMint: { [GENESIS_CHAIN + ':' + GENESIS_MINT]: GENESIS_SERIAL },
    counters: { '2026': 1 },
    revoked: {}
  };
}

function readFileStore() {
  try {
    if (!fs.existsSync(FILE_STORE)) return emptyFileStore();
    const data = JSON.parse(fs.readFileSync(FILE_STORE, 'utf8'));
    if (!data || typeof data !== 'object') return emptyFileStore();
    const store = {
      bySerial: data.bySerial && typeof data.bySerial === 'object' ? data.bySerial : {},
      byMint: data.byMint && typeof data.byMint === 'object' ? data.byMint : {},
      counters: data.counters && typeof data.counters === 'object' ? data.counters : {}
    };
    // Always keep genesis available (survives empty /tmp on cold start until first write).
    if (!store.bySerial[GENESIS_SERIAL]) {
      store.bySerial[GENESIS_SERIAL] = { ...GENESIS_BADGE };
      store.byMint[GENESIS_CHAIN + ':' + GENESIS_MINT] = GENESIS_SERIAL;
      store.counters['2026'] = Math.max(Number(store.counters['2026']) || 0, 1);
    }
    return store;
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

/** @returns {string} GRD-YYYY-NNNNN */
export function formatSerial(year, n) {
  const y = String(year);
  const num = String(Math.floor(Number(n))).padStart(5, '0');
  return `GRD-${y}-${num}`;
}

/**
 * Allocate next sequential serial for a year (starts after genesis 00001 for 2026).
 * @param {number} [year]
 */
export async function allocateSerial(year = new Date().getUTCFullYear()) {
  const y = String(year);
  if (redisRestConfig()) {
    const row = await redisCommand(['INCR', COUNTER_KEY + y]);
    let n = Number(row && row.result) || 0;
    // First incr on empty key returns 1 — reserve 00001 as genesis for 2026.
    if (y === '2026' && n === 1) {
      const again = await redisCommand(['INCR', COUNTER_KEY + y]);
      n = Number(again && again.result) || 2;
    }
    if (y === '2026' && n < 1) n = 1;
    return formatSerial(y, n);
  }
  const store = readFileStore();
  let n = Number(store.counters[y]) || 0;
  n += 1;
  if (y === '2026' && n === 1 && store.bySerial[GENESIS_SERIAL]) {
    // Genesis already owns 00001.
    n = Math.max(n, 2);
  }
  store.counters[y] = n;
  writeFileStore(store);
  return formatSerial(y, n);
}

export function normalizeSerial(raw) {
  const s = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  // Preferred: GRD-2026-00001
  if (/^GRD-\d{4}-\d{5}$/.test(s)) return s;
  // Legacy step-1 random form (still readable if present)
  if (/^GRD-\d{8}-[A-Z2-9]{5,12}$/.test(s)) return s;
  return null;
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
 * @property {string} [qualifyPath]
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

  // Idempotent: existing mint wins (including genesis).
  const existing = await getBadgeByMint(mint, chainId);
  if (existing) return existing;

  const issuedAt = new Date().toISOString();
  const serial = normalizeSerial(input.serial) || (await allocateSerial(new Date(issuedAt).getUTCFullYear()));
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
    qualifyPath: input.qualifyPath || (input.lifetimeEligible ? 'lifetime' : 'timed'),
    pathLabel: input.pathLabel || undefined,
    pathFamily: input.pathFamily || undefined,
    status: 'VALID',
    lifetimeEligible: Boolean(input.lifetimeEligible),
    badgeEligible: true,
    issuedAt,
    expiresAt: input.expiresAt || null,
    scanUrl: input.scanUrl || undefined
  };

  if (redisRestConfig()) {
    await redisCommand(['SET', KEY_PREFIX + serial, JSON.stringify(record)]);
    await redisCommand(['SET', BY_MINT_PREFIX + chainId + ':' + mint, serial]);
    // Ensure genesis keys exist in Redis once.
    await ensureGenesisInRedis();
    return record;
  }

  const store = readFileStore();
  store.bySerial[serial] = record;
  store.byMint[chainId + ':' + mint] = serial;
  const y = serial.split('-')[1];
  const n = Number(serial.split('-')[2]);
  if (y && Number.isFinite(n)) {
    store.counters[y] = Math.max(Number(store.counters[y]) || 0, n);
  }
  writeFileStore(store);
  return record;
}

async function ensureGenesisInRedis() {
  if (!redisRestConfig()) return;
  const row = await redisCommand(['GET', KEY_PREFIX + GENESIS_SERIAL]);
  if (row && row.result) return;
  await redisCommand(['SET', KEY_PREFIX + GENESIS_SERIAL, JSON.stringify(GENESIS_BADGE)]);
  await redisCommand([
    'SET',
    BY_MINT_PREFIX + GENESIS_CHAIN + ':' + GENESIS_MINT,
    GENESIS_SERIAL
  ]);
  // Counter at least 1 for 2026
  const cur = await redisCommand(['GET', COUNTER_KEY + '2026']);
  if (!cur || !cur.result) {
    await redisCommand(['SET', COUNTER_KEY + '2026', '1']);
  }
}

/** @param {string} serial */
export async function getBadgeBySerial(serial) {
  const key = normalizeSerial(serial);
  if (!key) return null;

  if (key === GENESIS_SERIAL) {
    // Always resolve genesis even before Redis seed / cold /tmp.
    if (redisRestConfig()) {
      await ensureGenesisInRedis();
      const row = await redisCommand(['GET', KEY_PREFIX + key]);
      if (row && row.result) {
        try {
          return JSON.parse(row.result);
        } catch (e) {
          return { ...GENESIS_BADGE };
        }
      }
    }
    return { ...GENESIS_BADGE };
  }

  if (redisRestConfig()) {
    await ensureGenesisInRedis();
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
  if (m === GENESIS_MINT && chainId === GENESIS_CHAIN) {
    return getBadgeBySerial(GENESIS_SERIAL);
  }
  if (redisRestConfig()) {
    await ensureGenesisInRedis();
    const row = await redisCommand(['GET', BY_MINT_PREFIX + chainId + ':' + m]);
    if (!row || !row.result) return null;
    return getBadgeBySerial(row.result);
  }
  const store = readFileStore();
  const serial = store.byMint[chainId + ':' + m];
  return serial ? store.bySerial[serial] || null : null;
}

/**
 * Persist REVOKED status (auto-revocation on failed live re-check).
 * @param {string} serial
 * @param {string} [reason]
 */
export async function revokeBadge(serial, reason = 'live re-check failed') {
  const key = normalizeSerial(serial);
  if (!key) return null;
  const badge = await getBadgeBySerial(key);
  if (!badge) return null;
  const updated = {
    ...badge,
    status: 'REVOKED',
    revokedAt: new Date().toISOString(),
    revokeReason: reason,
    pathLabel: badge.pathLabel || badge.qualifyPath || undefined
  };

  if (redisRestConfig()) {
    await redisCommand(['SET', KEY_PREFIX + key, JSON.stringify(updated)]);
    await redisCommand([
      'SET',
      'guardian:badge:revoked:' + badge.chainId + ':' + badge.mint,
      key
    ]);
    return updated;
  }

  const store = readFileStore();
  store.bySerial[key] = updated;
  store.revoked = store.revoked || {};
  store.revoked[badge.chainId + ':' + badge.mint] = key;
  writeFileStore(store);
  return updated;
}

/** True if this mint has any REVOKED serial in the registry. */
export async function hasRevocationHistory(mint, chainId = 'solana') {
  const m = String(mint || '').trim();
  if (!m) return false;
  if (redisRestConfig()) {
    const row = await redisCommand(['GET', 'guardian:badge:revoked:' + chainId + ':' + m]);
    return Boolean(row && row.result);
  }
  const store = readFileStore();
  if (store.revoked && store.revoked[chainId + ':' + m]) return true;
  // Also scan serials
  for (const badge of Object.values(store.bySerial || {})) {
    if (badge && badge.mint === m && badge.chainId === chainId && badge.status === 'REVOKED') {
      return true;
    }
  }
  return false;
}

