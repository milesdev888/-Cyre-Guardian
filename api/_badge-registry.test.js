// api/_badge-registry.test.js — Phase 2 step 1 serial + registry smoke test
import assert from 'node:assert/strict';
import {
  mintSerial,
  normalizeSerial,
  registerBadge,
  getBadgeBySerial,
  getBadgeByMint
} from './_badge-registry.js';

process.env.BADGE_REGISTRY_STORE = '/tmp/guardian-badge-registry-test.json';

const a = mintSerial(new Date('2026-09-06T12:00:00Z'));
assert.match(a, /^GRD-20260906-[A-Z2-9]{5}$/);
assert.equal(normalizeSerial(a.toLowerCase()), a);
assert.equal(normalizeSerial('nope'), null);

const badge = await registerBadge({
  mint: 'MintTest111111111111111111111111111111111',
  chainId: 'solana',
  grade: 'A',
  score: 92,
  lpTier: 'PERMANENT',
  lifetimeEligible: true,
  badgeEligible: true,
  symbol: 'TEST'
});
assert.match(badge.serial, /^GRD-/);
assert.equal(badge.schema, 'guardian.badge.v1');

const again = await registerBadge({
  mint: 'MintTest111111111111111111111111111111111',
  chainId: 'solana',
  grade: 'A',
  lpTier: 'PERMANENT',
  lifetimeEligible: true,
  badgeEligible: true
});
assert.equal(again.serial, badge.serial, 'idempotent per mint');

const bySerial = await getBadgeBySerial(badge.serial);
assert.equal(bySerial.mint, badge.mint);
const byMint = await getBadgeByMint(badge.mint, 'solana');
assert.equal(byMint.serial, badge.serial);

let rejected = false;
try {
  await registerBadge({ mint: 'x', badgeEligible: false, grade: 'F', lpTier: 'UNVERIFIED' });
} catch (e) {
  rejected = true;
}
assert.equal(rejected, true);

console.log('badge-registry.test.js: ok');
