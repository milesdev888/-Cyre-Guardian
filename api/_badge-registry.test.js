// api/_badge-registry.test.js — Phase 2 serial + genesis + qualify smoke tests
import assert from 'node:assert/strict';
import {
  formatSerial,
  normalizeSerial,
  registerBadge,
  getBadgeBySerial,
  getBadgeByMint,
  allocateSerial,
  GENESIS_SERIAL,
  GENESIS_MINT,
  GENESIS_BADGE
} from './_badge-registry.js';
import { qualifyFromScan } from './_badge-qualify.js';

process.env.BADGE_REGISTRY_STORE = '/tmp/guardian-badge-registry-test-step2.json';

assert.equal(formatSerial(2026, 1), 'GRD-2026-00001');
assert.equal(normalizeSerial('grd-2026-00001'), GENESIS_SERIAL);
assert.equal(normalizeSerial('nope'), null);

const genesis = await getBadgeBySerial(GENESIS_SERIAL);
assert.equal(genesis.serial, GENESIS_SERIAL);
assert.equal(genesis.mint, GENESIS_MINT);
assert.equal(genesis.qualifyPath || 'lifetime', 'lifetime');

const byMint = await getBadgeByMint(GENESIS_MINT, 'solana');
assert.equal(byMint.serial, GENESIS_SERIAL);

// Idempotent register of C7 returns genesis
const again = await registerBadge({
  mint: GENESIS_MINT,
  chainId: 'solana',
  grade: 'A',
  lpTier: 'PERMANENT',
  lifetimeEligible: true,
  badgeEligible: true,
  qualifyPath: 'lifetime'
});
assert.equal(again.serial, GENESIS_SERIAL);

const next = await allocateSerial(2026);
assert.match(next, /^GRD-2026-\d{5}$/);
assert.notEqual(next, GENESIS_SERIAL);

// Qualifying paths
const lifetimeReport = {
  schema: 'guardian.report.v2',
  grade: 'A',
  score: 91,
  token: { address: GENESIS_MINT, symbol: 'C7', name: 'CYRE' },
  chain: { id: 'solana' },
  lp: {
    tier: 'PERMANENT',
    lifetimeEligible: true,
    badgeEligible: true,
    unlockAt: null
  },
  checks: [{ id: 'owner_privileges', status: 'pass' }]
};
const qLife = qualifyFromScan(lifetimeReport);
assert.equal(qLife.eligible, true);
assert.equal(qLife.path, 'lifetime');

const timedOk = qualifyFromScan({
  schema: 'guardian.report.v2',
  token: { address: 'TimedMint1111111111111111111111111111111' },
  chain: { id: 'solana' },
  lp: {
    tier: 'TIMED',
    lifetimeEligible: false,
    badgeEligible: true,
    unlockAt: new Date(Date.now() + 120 * 86400000).toISOString()
  },
  checks: [{ id: 'owner_privileges', status: 'pass' }]
});
assert.equal(timedOk.eligible, true);
assert.equal(timedOk.path, 'timed');

const timedShort = qualifyFromScan({
  schema: 'guardian.report.v2',
  token: { address: 'ShortMint111111111111111111111111111111' },
  chain: { id: 'solana' },
  lp: {
    tier: 'TIMED',
    badgeEligible: false,
    unlockAt: new Date(Date.now() + 10 * 86400000).toISOString()
  },
  checks: [{ id: 'owner_privileges', status: 'pass' }]
});
assert.equal(timedShort.eligible, false);

const liveMint = qualifyFromScan({
  schema: 'guardian.report.v2',
  token: { address: 'AuthMint1111111111111111111111111111111' },
  chain: { id: 'solana' },
  lp: { tier: 'PERMANENT', lifetimeEligible: true, badgeEligible: true },
  checks: [{ id: 'owner_privileges', status: 'flag', grade: 'F' }]
});
assert.equal(liveMint.eligible, false);

// Genesis fixture matches acceptance serial
assert.equal(GENESIS_BADGE.serial, 'GRD-2026-00001');

console.log('badge-registry.test.js: ok');
