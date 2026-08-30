// api/middleware.test.js — pure unit tests for lookalike + ticket policy helpers
// Run: node -e "import('./api/middleware.test.js')"

import { comparePair, scanLookalikes, levenshtein, detectFamily } from './_lookalike.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assert failed');
}

function run() {
  assert(detectFamily('0x9Ff25C4acf1DcDDf15fD2702C127A285f1dFa712') === 'evm', 'evm');
  assert(detectFamily('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM') === 'solana', 'sol');

  assert(levenshtein('abc', 'abc') === 0, 'lev 0');
  assert(levenshtein('abc', 'abd') === 1, 'lev 1');

  const base = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
  // same head/tail, middle changed → prefix_suffix_trap
  const trap =
    base.slice(0, 4) +
    'XXXXXX' +
    base.slice(10, -4) +
    base.slice(-4);
  // Force same length by editing middle only
  const mid = base.slice(0, 8) + 'zzzzzz' + base.slice(14);
  assert(mid.length === base.length, 'same length');
  const pair = comparePair(mid, base);
  assert(pair.triggered, 'near edit should trigger: ' + JSON.stringify(pair.flags));
  assert(pair.points >= 12, 'points');

  const exact = comparePair(base, base);
  assert(exact.exact && !exact.triggered, 'exact');

  const scan = scanLookalikes(mid, [base, '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9']);
  assert(scan.hits.some((h) => h.triggered), 'scan hits');
  assert(scan.score >= 12, 'scan score');

  const evmA = '0x9Ff25C4acf1DcDDf15fD2702C127A285f1dFa712';
  const evmB = '0x9Ff25C4acf1DcDDf15fD2702C127A285f1dFa713';
  const flip = comparePair(evmB, evmA);
  assert(flip.triggered, 'single nibble flip');

  console.log('All middleware (lookalike) tests passed.');
}

run();
