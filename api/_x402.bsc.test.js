// api/_x402.bsc.test.js — unit tests for dormant B402 / BSC lane
// Run: node -e "import('./api/_x402.bsc.test.js')"

import { generateKeyPairSync } from 'crypto';

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assert failed');
}

// Isolate env mutations
const saved = { ...process.env };

function resetEnv(extra = {}) {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('X402_') || k.startsWith('B402_') || k.startsWith('CDP_')) delete process.env[k];
  }
  Object.assign(process.env, extra);
}

async function loadFresh() {
  const id = 'x402bsc' + Date.now() + Math.random();
  return import('./_x402.js?t=' + id);
}

async function run() {
  // --- amount conversion ---
  {
    const mod = await loadFresh();
    assert(mod.sixDecimalToLaneAtomic('5000', 6) === '5000', '6dec identity');
    assert(mod.sixDecimalToLaneAtomic('5000', 18) === '5000000000000000', '$0.005 → 18dec');
    assert(mod.sixDecimalToLaneAtomic('10000', 18) === '10000000000000000', '$0.01 → 18dec');
    console.log('ok amount conversion');
  }

  // --- BSC absent when env unset ---
  {
    resetEnv({ X402_PAY_TO_BASE: '0x9Ff25C4acf1DcDDf15fD2702C127A285f1dFa712' });
    const mod = await loadFresh();
    const names = mod.listArmedLaneNames();
    assert(!names.includes('bsc'), 'bsc should be absent: ' + names.join(','));
    assert(names.includes('base'), 'base present');
    console.log('ok bsc absent when unset');
  }

  // --- BSC present when X402_PAY_TO_BSC set ---
  {
    resetEnv({
      X402_PAY_TO_BASE: '0x9Ff25C4acf1DcDDf15fD2702C127A285f1dFa712',
      X402_PAY_TO_BSC: '0x1111111111111111111111111111111111111111',
      X402_FACILITATOR_BSC: 'https://b402.example.invalid',
      X402_ASSET_BSC: 'USDT',
      B402_SIGNER_ADDRESS: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      B402_SPENDER_ADDRESS: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    });
    const mod = await loadFresh();
    const names = mod.listArmedLaneNames();
    assert(names.includes('bsc'), 'bsc armed');
    const lane = mod.armedLanes().find((l) => l.name === 'bsc');
    const req = mod.laneRequirements(lane, '5000');
    assert(req.network === 'eip155:56', 'network mainnet');
    assert(req.asset.toLowerCase() === '0x55d398326f99059ff775485246999027b3197955', 'USDT asset');
    assert(req.amount === '5000000000000000', '18dec amount');
    assert(req.scheme === 'exact', 'scheme exact');
    assert(req.extra.assetTransferMethod === 'permit2-exact', 'permit2-exact');
    assert(req.extra.signerAddress.startsWith('0xaa'), 'signer forwarded');
    assert(req.extra.spenderAddress.startsWith('0xbb'), 'spender forwarded');
    console.log('ok bsc present + requirements');
  }

  // --- offer_mismatch: wrong asset / wrong payTo ---
  {
    resetEnv({
      X402_PAY_TO_BSC: '0x1111111111111111111111111111111111111111',
      X402_FACILITATOR_BSC: 'https://b402.example.invalid',
      B402_SIGNER_ADDRESS: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      B402_SPENDER_ADDRESS: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    });
    const mod = await loadFresh();
    const lane = mod.armedLanes().find((l) => l.name === 'bsc');
    const expected = mod.laneRequirements(lane, '5000');
    assert(
      !mod.offerMatches(
        { ...expected, asset: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' },
        expected
      ),
      'wrong asset rejected'
    );
    assert(
      !mod.offerMatches(
        { ...expected, payTo: '0x2222222222222222222222222222222222222222' },
        expected
      ),
      'wrong payTo rejected'
    );
    assert(mod.offerMatches(expected, expected), 'exact match ok');
    console.log('ok offer pin rejects wrong asset/payTo');
  }

  // --- settle path mocked (verify + settle) ---
  {
    resetEnv({
      X402_ENABLED: 'true',
      X402_PAY_TO_BSC: '0x1111111111111111111111111111111111111111',
      X402_FACILITATOR_BSC: 'https://b402.example.invalid',
      B402_CLIENT_ID: 'client-test',
      B402_ACCESS_TOKEN: 'token-test',
      B402_SIGNER_ADDRESS: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      B402_SPENDER_ADDRESS: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    });
    // Generate RSA key for signing
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });
    process.env.B402_RSA_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');

    const mod = await loadFresh();
    const lane = mod.armedLanes().find((l) => l.name === 'bsc');
    const expected = mod.laneRequirements(lane, '5000');

    const calls = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(init.body) });
      if (String(url).includes('/verify')) {
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({ code: '000000', data: { isValid: true } });
          }
        };
      }
      if (String(url).includes('/settle')) {
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({
              code: '000000',
              data: { success: true, transaction: '0xabc', payer: '0xpayer', network: 'eip155:56', amount: expected.amount }
            });
          }
        };
      }
      throw new Error('unexpected url ' + url);
    };

    try {
      const gate = mod.createX402Gate({
        price: '5000',
        resourcePath: '/api/address',
        description: 'test',
        discovery: { bazaar: { info: { input: { type: 'http', method: 'GET' } } } },
        isFree: () => false
      });
      const payment = {
        x402Version: 2,
        accepted: expected,
        payload: { signature: '0x00' }
      };
      const header = Buffer.from(JSON.stringify(payment)).toString('base64');
      const result = await gate({
        headers: {
          host: 'cyre.dev',
          'x-forwarded-proto': 'https',
          'payment-signature': header
        }
      });
      assert(result && result.settled && result.settled.success === true, 'settle success');
      assert(calls.length === 2, 'verify+settle called');
      assert(calls[0].url.endsWith('/papi/v2/b402/verify'), 'verify path');
      assert(calls[1].url.endsWith('/papi/v2/b402/settle'), 'settle path');
      assert(calls[1].body.paymentPayload.extensions && calls[1].body.paymentPayload.extensions.bazaar, 'bazaar echoed on settle');
      console.log('ok mocked verify+settle with bazaar echo');
    } finally {
      globalThis.fetch = realFetch;
    }
  }

  console.log('\nAll B402/BSC lane tests passed.');
}

run()
  .catch((e) => {
    console.error('FAIL', e);
    process.exit(1);
  })
  .finally(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in saved)) delete process.env[k];
    }
    Object.assign(process.env, saved);
  });
