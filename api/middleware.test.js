// api/middleware.test.js — pure unit tests for lookalike + policy + offer helpers
// Run: node --input-type=module -e "import('./api/middleware.test.js')"

import { comparePair, scanLookalikes, levenshtein, detectFamily } from './_lookalike.js';
import { evaluatePolicy } from './_policycheck.js';
import { decodePaymentRequired, analyzeOffer } from './_offerparse.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assert failed');
}

function runLookalike() {
  assert(detectFamily('0x9Ff25C4acf1DcDDf15fD2702C127A285f1dFa712') === 'evm', 'evm');
  assert(detectFamily('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM') === 'solana', 'sol');

  assert(levenshtein('abc', 'abc') === 0, 'lev 0');
  assert(levenshtein('abc', 'abd') === 1, 'lev 1');

  const base = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
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
}

function runPolicy() {
  const claims = {
    kind: 'cyre-spend-policy',
    maxSpendAtomic: '10000',
    allowHosts: ['example.com'],
    denyHosts: ['evil.xyz'],
    networks: ['eip155:8453'],
    maxRisk: 'MEDIUM',
    requireTicket: true,
    denyFreshEoa: true
  };

  const ok = evaluatePolicy(claims, {
    amountAtomic: '5000',
    resourceUrl: 'https://api.example.com/pay',
    network: 'eip155:8453',
    riskLevel: 'LOW',
    hasTicket: true,
    freshEoa: false
  });
  assert(ok.ok, 'policy should pass: ' + ok.reasons.join(','));

  const over = evaluatePolicy(claims, {
    amountAtomic: '20000',
    resourceUrl: 'https://example.com/x',
    hasTicket: true
  });
  assert(!over.ok && over.reasons.includes('over_max_spend'), 'over spend');

  const deny = evaluatePolicy(claims, {
    amountAtomic: '100',
    resourceUrl: 'https://evil.xyz/x',
    hasTicket: true
  });
  assert(!deny.ok && deny.reasons.includes('deny_host'), 'deny host');

  const noTicket = evaluatePolicy(claims, {
    amountAtomic: '100',
    resourceUrl: 'https://example.com/x',
    hasTicket: false
  });
  assert(!noTicket.ok && noTicket.reasons.includes('ticket_required'), 'ticket required');

  const bad = evaluatePolicy({ kind: 'other' }, {});
  assert(!bad.ok && bad.reasons.includes('not_a_policy'), 'not a policy');
}

function runOffer() {
  const body = {
    x402Version: 2,
    accepts: [
      { network: 'eip155:8453', amount: '1000', payTo: '0x9Ff25C4acf1DcDDf15fD2702C127A285f1dFa712' },
      { network: 'eip155:8453', amount: '2000', payTo: '0x9Ff25C4acf1DcDDf15fD2702C127A285f1dFa712' }
    ],
    resource: { url: 'https://evil.xyz/api/paid' }
  };
  const analysis = analyzeOffer(body, {
    amount: '1000',
    payTo: '0x9Ff25C4acf1DcDDf15fD2702C127A285f1dFa712',
    resourceUrl: 'https://evil.xyz/api/paid',
    facilitator: 'https://unknown-facilitator.example/x402'
  });
  assert(analysis.acceptsCount === 2, 'accepts count');
  assert(analysis.signals.some((s) => s.id === 'amount_spread' && s.triggered), 'amount spread');
  assert(analysis.signals.some((s) => s.id === 'payto_recycle' && s.triggered), 'payto recycle');
  assert(analysis.signals.some((s) => s.id === 'facilitator_unknown' && s.triggered), 'unknown facilitator');
  assert(analysis.score >= 20, 'offer score');

  const b64 = Buffer.from(JSON.stringify(body)).toString('base64');
  const decoded = decodePaymentRequired(b64);
  assert(!decoded.error && decoded.body.accepts.length === 2, 'decode b64');

  const bad = decodePaymentRequired('%%%');
  assert(bad.error, 'bad decode');
}

function run() {
  runLookalike();
  runPolicy();
  runOffer();
  console.log('All middleware (lookalike + policy + offer) tests passed.');
}

run();
