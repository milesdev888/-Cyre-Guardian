// api/_badge-registry.test.js — qualify paths incl. ESTABLISHED + genesis + OG smoke
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
  GENESIS_BADGE,
  revokeBadge,
  hasRevocationHistory
} from './_badge-registry.js';
import { qualifyFromScan, evaluateEstablished, analyzePools } from './_badge-qualify.js';
import { renderBadgeOg, encodePng, decodePng, loadSealImage, blitImage } from './_badge-og-render.js';

process.env.BADGE_REGISTRY_STORE = '/tmp/guardian-badge-registry-test-step2b.json';

assert.equal(formatSerial(2026, 1), 'GRD-2026-00001');
assert.equal(normalizeSerial('grd-2026-00001'), GENESIS_SERIAL);

const genesis = await getBadgeBySerial(GENESIS_SERIAL);
assert.equal(genesis.serial, GENESIS_SERIAL);
assert.equal(genesis.pathLabel, 'Lifetime');
assert.equal(genesis.pathFamily, 'secured');

// Lifetime path
const qLife = qualifyFromScan({
  schema: 'guardian.report.v2',
  grade: 'A',
  score: 91,
  token: { address: GENESIS_MINT, symbol: 'C7', name: 'CYRE' },
  chain: { id: 'solana' },
  lp: { tier: 'PERMANENT', lifetimeEligible: true, badgeEligible: true },
  checks: [{ id: 'owner_privileges', status: 'pass' }],
  pools: [{ dex: 'meteora', pairAddress: 'p1', liquidityUsd: 5000, createdAt: Date.now() - 4 * 86400000 }]
});
assert.equal(qLife.path, 'lifetime');
assert.equal(qLife.pathLabel, 'Lifetime');

// Age alone never qualifies established
const ageOnly = evaluateEstablished({
  schema: 'guardian.report.v2',
  pools: [{ dex: 'raydium', pairAddress: 'a', liquidityUsd: 50000, createdAt: Date.now() - 800 * 86400000 }],
  checks: [{ id: 'owner_privileges', status: 'pass' }]
});
assert.equal(ageOnly.eligible, false, 'age alone must not qualify');

// Full established
const old = Date.now() - 800 * 86400000;
const estReport = {
  schema: 'guardian.report.v2',
  grade: 'A',
  score: 88,
  token: { address: 'EstMint111111111111111111111111111111111', symbol: 'OLD', name: 'Old' },
  chain: { id: 'solana' },
  lp: { tier: 'UNVERIFIED', lifetimeEligible: false, badgeEligible: false },
  checks: [{ id: 'owner_privileges', status: 'pass' }],
  pools: [
    { dex: 'raydium', pairAddress: 'poolA', liquidityUsd: 40000, createdAt: old },
    { dex: 'orca', pairAddress: 'poolB', liquidityUsd: 35000, createdAt: old },
    { dex: 'meteora', pairAddress: 'poolC', liquidityUsd: 30000, createdAt: old }
  ]
};
const pools = analyzePools(estReport);
assert.equal(pools.poolCount, 3);
assert.ok(pools.totalLiquidityUsd >= 100000);
assert.equal(pools.noSingleMajority, true);
const qEst = qualifyFromScan(estReport);
assert.equal(qEst.eligible, true);
assert.equal(qEst.path, 'established');
assert.equal(qEst.pathLabel, 'Established');
assert.equal(qEst.pathFamily, 'established');

// Majority fails established
const majorityFail = qualifyFromScan({
  ...estReport,
  pools: [
    { dex: 'raydium', pairAddress: 'poolA', liquidityUsd: 90000, createdAt: old },
    { dex: 'orca', pairAddress: 'poolB', liquidityUsd: 5000, createdAt: old },
    { dex: 'meteora', pairAddress: 'poolC', liquidityUsd: 5000, createdAt: old }
  ]
});
assert.equal(majorityFail.eligible, false);

// OG render produces PNG header
const png = renderBadgeOg({
  serial: GENESIS_SERIAL,
  symbol: 'C7',
  pathLabel: 'Lifetime',
  grade: 'A',
  lpTier: 'PERMANENT',
  status: 'VALID',
  issuedAt: GENESIS_BADGE.issuedAt,
  liveGrade: 'A',
  livePath: 'Lifetime',
  checkedAt: new Date().toISOString()
});
assert.equal(png[0], 137);
assert.equal(png[1], 80);
assert.equal(png[2], 78);
assert.equal(png[3], 71);

const revokedPng = renderBadgeOg({
  serial: GENESIS_SERIAL,
  symbol: 'C7',
  pathLabel: 'Lifetime',
  status: 'REVOKED',
  issuedAt: GENESIS_BADGE.issuedAt,
  livePath: 'None',
  checkedAt: new Date().toISOString()
});
assert.equal(revokedPng[0], 137);

// Ornate seal PNG must decode with transparent corners (blit root-cause fix)
const sealImg = loadSealImage(false);
assert.ok(sealImg, 'valid seal asset missing');
assert.ok(sealImg.width >= 512, 'seal should be ≥2× card display');
assert.equal(sealImg.rgba[3], 0, 'seal corner alpha must be 0');
const revSeal = loadSealImage(true);
assert.ok(revSeal);
assert.equal(revSeal.rgba[3], 0, 'revoked seal corner alpha must be 0');

// Revocation history
const other = await registerBadge({
  mint: 'RevokeTestMint111111111111111111111111111',
  chainId: 'solana',
  grade: 'A',
  lpTier: 'PERMANENT',
  qualifyPath: 'lifetime',
  pathLabel: 'Lifetime',
  pathFamily: 'secured',
  lifetimeEligible: true,
  badgeEligible: true
});
await revokeBadge(other.serial, 'test');
assert.equal(await hasRevocationHistory('RevokeTestMint111111111111111111111111111', 'solana'), true);

console.log('badge-registry.test.js: ok');
