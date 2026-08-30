// api/_x402.js — shared x402 v2 payment gate (zero-dep).
// Used by address/token/passport/handshake/preflight/receipt/delta/batch/program/alerts/oracle/gate.
// Site visitors stay free.
//
// Env (optional until X402_ENABLED=true):
//   X402_ENABLED, X402_NETWORK, X402_NETWORK_BASE, X402_PRICE (per-route override via createX402Gate)
//   CDP_API_KEY_ID, CDP_API_KEY_SECRET
//   X402_PAY_TO, X402_FACILITATOR, X402_PAY_TO_BASE, X402_FACILITATOR_BASE
//   -- BNB Chain / B402 lane (dormant until X402_PAY_TO_BSC is set) --
//   X402_PAY_TO_BSC, X402_NETWORK_BSC (mainnet|testnet), X402_ASSET_BSC, X402_FACILITATOR_BSC
//   B402_CLIENT_ID | B402_API_KEY, B402_ACCESS_TOKEN | B402_API_SECRET, B402_RSA_PRIVATE_KEY
//   B402_SIGNER_ADDRESS, B402_SPENDER_ADDRESS (from POST /papi/v2/b402/supported — forward in extra)
//   X402_INTERNAL_KEY — bypass via x-guardian-key header
// See docs/B402-RESEARCH.md

const DEFAULT_FACILITATOR = 'https://x402.org/facilitator';
const CDP_FACILITATOR = 'https://api.cdp.coinbase.com/platform/v2/x402';
const CDP_KEY_ID = process.env.CDP_API_KEY_ID || '';
const CDP_KEY_SECRET = process.env.CDP_API_KEY_SECRET || '';
const X402_ENABLED = process.env.X402_ENABLED === 'true';
const NET = (process.env.X402_NETWORK || 'devnet').toLowerCase();
const NET_BASE = (process.env.X402_NETWORK_BASE || 'mainnet').toLowerCase();

// BSC mainnet stables are 18 decimals; Base USDC price knobs stay 6-decimal atomic.
const BSC_ASSETS = {
  mainnet: {
    USDT: { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, name: 'Tether USD', version: '1' },
    USDC: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, name: 'USD Coin', version: '2' }
  },
  testnet: {
    USDT: { address: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd', decimals: 18, name: 'Tether USD', version: '1' },
    USDC: { address: '0xEC1C60D64a06896Df296438c12edD14E974FDE47', decimals: 6, name: 'USD Coin', version: '2' }
  }
};

function bscAssetConfig() {
  const net = (process.env.X402_NETWORK_BSC || 'mainnet').toLowerCase();
  const envKey = net === 'testnet' ? 'testnet' : 'mainnet';
  const sym = String(process.env.X402_ASSET_BSC || 'USDT').trim().toUpperCase();
  const table = BSC_ASSETS[envKey];
  return table[sym] || table.USDT;
}

function buildBscLane() {
  const payTo = process.env.X402_PAY_TO_BSC || '';
  const asset = bscAssetConfig();
  const net = (process.env.X402_NETWORK_BSC || 'mainnet').toLowerCase();
  const network = net === 'testnet' ? 'eip155:97' : 'eip155:56';
  const extra = {
    name: process.env.X402_ASSET_BSC_NAME || asset.name,
    version: process.env.X402_ASSET_BSC_VERSION || asset.version,
    assetTransferMethod: process.env.X402_BSC_TRANSFER_METHOD || 'permit2-exact',
    signerAddress: process.env.B402_SIGNER_ADDRESS || '',
    spenderAddress: process.env.B402_SPENDER_ADDRESS || ''
  };
  return {
    name: 'bsc',
    payTo,
    facilitator: String(process.env.X402_FACILITATOR_BSC || '').replace(/\/$/, ''),
    auth: 'b402',
    verifyPath: '/papi/v2/b402/verify',
    settlePath: '/papi/v2/b402/settle',
    mainnet: { network, usdc: asset.address, decimals: asset.decimals, extra, scheme: 'exact' },
    devnet: { network, usdc: asset.address, decimals: asset.decimals, extra, scheme: 'exact' }
  };
}

function buildLanes() {
  return [
    {
      name: 'solana',
      payTo: process.env.X402_PAY_TO || '',
      facilitator: (process.env.X402_FACILITATOR || DEFAULT_FACILITATOR).replace(/\/$/, ''),
      auth: 'default',
      verifyPath: '/verify',
      settlePath: '/settle',
      mainnet: { network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', usdc: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
      devnet: { network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', usdc: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', decimals: 6 }
    },
    {
      name: 'base',
      payTo: process.env.X402_PAY_TO_BASE || '0x9Ff25C4acf1DcDDf15fD2702C127A285f1dFa712',
      facilitator: (process.env.X402_FACILITATOR_BASE || (CDP_KEY_ID && CDP_KEY_SECRET ? CDP_FACILITATOR : DEFAULT_FACILITATOR)).replace(/\/$/, ''),
      auth: 'cdp',
      verifyPath: '/verify',
      settlePath: '/settle',
      mainnet: { network: 'eip155:8453', usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, extra: { name: 'USD Coin', version: '2' } },
      devnet: { network: 'eip155:84532', usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', decimals: 6, extra: { name: 'USDC', version: '2' } }
    },
    buildBscLane()
  ];
}

/** Convert 6-decimal USD atomic (Base USDC price knobs) → token atomic for a lane asset. */
export function sixDecimalToLaneAtomic(priceSix, decimals) {
  const p = BigInt(String(priceSix || '0'));
  const d = Number(decimals);
  if (!Number.isFinite(d) || d === 6) return p.toString();
  if (d > 6) return (p * 10n ** BigInt(d - 6)).toString();
  const div = 10n ** BigInt(6 - d);
  return (p / div).toString();
}

export function armedLanes() {
  return buildLanes().filter((l) => l.payTo);
}

export function listArmedLaneNames() {
  return armedLanes().map((l) => l.name);
}

function laneNet(lane) {
  if (lane.name === 'base') return NET_BASE;
  if (lane.name === 'bsc') {
    return (process.env.X402_NETWORK_BSC || 'mainnet').toLowerCase() === 'testnet' ? 'devnet' : 'mainnet';
  }
  return NET;
}

function laneEnv(lane) {
  return laneNet(lane) === 'mainnet' ? lane.mainnet : lane.devnet;
}

export function laneRequirements(lane, priceSix) {
  const env = laneEnv(lane);
  const amount = sixDecimalToLaneAtomic(priceSix, env.decimals != null ? env.decimals : 6);
  const req = {
    scheme: env.scheme || 'exact',
    network: env.network,
    amount,
    asset: env.usdc,
    payTo: lane.payTo,
    maxTimeoutSeconds: 60,
    extra: env.extra || {}
  };
  return req;
}

function normAddr(v) {
  const s = String(v || '');
  return s.startsWith('0x') ? s.toLowerCase() : s;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function cdpPrivateKey() {
  const crypto = require('crypto');
  const secret = CDP_KEY_SECRET.trim();
  if (secret.includes('BEGIN')) {
    return { key: crypto.createPrivateKey(secret), alg: 'ES256' };
  }
  const raw = Buffer.from(secret, 'base64');
  if (raw.length !== 64) {
    throw new Error('CDP Ed25519 secret must decode to 64 bytes');
  }
  const seed = raw.subarray(0, 32);
  const publicKey = raw.subarray(32);
  return {
    key: crypto.createPrivateKey({
      key: { kty: 'OKP', crv: 'Ed25519', d: seed.toString('base64url'), x: publicKey.toString('base64url') },
      format: 'jwk'
    }),
    alg: 'EdDSA'
  };
}

function cdpJwt(method, urlPath) {
  const crypto = require('crypto');
  const { key, alg } = cdpPrivateKey();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg, kid: CDP_KEY_ID, typ: 'JWT', nonce: crypto.randomBytes(16).toString('hex') };
  const payload = {
    iss: 'cdp',
    sub: CDP_KEY_ID,
    nbf: now,
    exp: now + 120,
    uris: [method + ' ' + 'api.cdp.coinbase.com' + urlPath]
  };
  const signingInput = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(payload));
  let sig;
  if (alg === 'EdDSA') {
    sig = crypto.sign(null, Buffer.from(signingInput), key);
  } else {
    sig = crypto.sign('sha256', Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' });
  }
  return signingInput + '.' + b64url(sig);
}

function b402Credentials() {
  const clientId = process.env.B402_CLIENT_ID || process.env.B402_API_KEY || '';
  const accessToken = process.env.B402_ACCESS_TOKEN || process.env.B402_API_SECRET || '';
  const rsa = process.env.B402_RSA_PRIVATE_KEY || '';
  return { clientId, accessToken, rsa };
}

function b402Headers(bodyString) {
  const crypto = require('crypto');
  const { clientId, accessToken, rsa } = b402Credentials();
  if (!clientId || !accessToken || !rsa) {
    throw new Error('B402 credentials missing (B402_CLIENT_ID/B402_API_KEY, B402_ACCESS_TOKEN/B402_API_SECRET, B402_RSA_PRIVATE_KEY)');
  }
  const timestamp = Date.now().toString();
  const toSign = bodyString + timestamp;
  let privateKey;
  if (rsa.includes('BEGIN')) {
    privateKey = crypto.createPrivateKey(rsa);
  } else {
    privateKey = crypto.createPrivateKey({
      key: Buffer.from(rsa.trim(), 'base64'),
      format: 'der',
      type: 'pkcs8'
    });
  }
  const signature = crypto.createSign('SHA256').update(toSign, 'utf8').sign(privateKey, 'base64');
  return {
    'content-type': 'application/json',
    'X-Tesla-ClientId': clientId,
    'X-Tesla-SignAccessToken': accessToken,
    'X-Tesla-Timestamp': timestamp,
    'X-Tesla-Signature': signature
  };
}

function unwrapFacilitatorData(data) {
  if (!data || typeof data !== 'object') return data;
  // Binance BAPI envelope: { code, message, data: { isValid|success|... } }
  if (data.data && typeof data.data === 'object' &&
      (Object.prototype.hasOwnProperty.call(data.data, 'isValid') ||
       Object.prototype.hasOwnProperty.call(data.data, 'success'))) {
    return data.data;
  }
  return data;
}

async function callFacilitator(lane, path, body) {
  const base = lane.facilitator;
  if (!base) throw new Error('facilitator URL not configured for lane ' + lane.name);
  const bodyString = JSON.stringify(body);
  const headers = { 'content-type': 'application/json' };

  if (lane.auth === 'b402') {
    Object.assign(headers, b402Headers(bodyString));
  } else if (base.includes('api.cdp.coinbase.com') && CDP_KEY_ID && CDP_KEY_SECRET) {
    // Preserve prior Base behavior: JWT only when talking to CDP facilitator URL.
    const urlPath = new URL(base + path).pathname;
    headers.authorization = 'Bearer ' + cdpJwt('POST', urlPath);
  }

  const r = await fetch(base + path, {
    method: 'POST',
    headers,
    body: bodyString
  });
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = null;
  }
  data = unwrapFacilitatorData(data);
  if (data && (Object.prototype.hasOwnProperty.call(data, 'isValid') || Object.prototype.hasOwnProperty.call(data, 'success'))) {
    return data;
  }
  if (!r.ok) throw new Error('facilitator ' + path + ' ' + r.status + ' ' + text.slice(0, 300));
  return data || {};
}

/** cyre.dev (www) only — address-profile free path */
export function isCyreSiteRequest(req) {
  const src = String(req.headers.origin || req.headers.referer || '');
  return /^https:\/\/(www\.)?cyre\.dev(\/|$)/.test(src);
}

/** cyre.dev + Vercel preview deploys for this project */
export function isCyreOrPreviewRequest(req) {
  if (isCyreSiteRequest(req)) return true;
  const origin = String(req.headers.origin || '');
  const referer = String(req.headers.referer || '');
  const preview = /^https:\/\/cyre-guardian[\w.-]*\.vercel\.app/;
  return preview.test(origin) || preview.test(referer);
}

/**
 * Local offer-pin check used before facilitator calls.
 * Exported for unit tests.
 */
export function offerMatches(accepted, expected) {
  if (!accepted || !expected) return false;
  try {
    if (BigInt(accepted.amount || '0') < BigInt(expected.amount || '0')) return false;
  } catch (e) {
    return false;
  }
  return accepted.scheme === expected.scheme &&
    accepted.network === expected.network &&
    normAddr(accepted.asset) === normAddr(expected.asset) &&
    normAddr(accepted.payTo) === normAddr(expected.payTo);
}

/**
 * @param {object} opts
 * @param {string} opts.price — atomic USDC amount string (6 decimals; BSC lane converts to asset decimals)
 * @param {string} opts.resourcePath — e.g. '/api/address'
 * @param {string} opts.description
 * @param {string} [opts.serviceName]
 * @param {string[]} [opts.tags]
 * @param {string} [opts.iconUrl]
 * @param {object} opts.discovery — bazaar extension object { bazaar: { info, schema } }
 * @param {(req: any) => boolean} [opts.isFree] — return true to skip payment
 * @param {boolean} [opts.baseOnly] — only arm Base lane
 */
export function createX402Gate(opts) {
  const price = String(opts.price);
  const resourcePath = opts.resourcePath;
  const description = opts.description + ' Agent guide: https://cyre.dev/SKILL.md';
  const serviceName = opts.serviceName || 'CYRE Guardian';
  const tags = opts.tags || ['risk', 'fraud', 'solana', 'security'];
  const iconUrl = opts.iconUrl || 'https://cyre.dev/cyre-token-icon-256.png';
  const discovery = opts.discovery;
  const isFree = opts.isFree || isCyreSiteRequest;
  const baseOnly = !!opts.baseOnly;

  function resourceInfo(resourceUrl) {
    return {
      url: resourceUrl,
      description,
      mimeType: 'application/json',
      serviceName,
      tags,
      iconUrl
    };
  }

  function paymentRequired(resourceUrl, accepts, error) {
    return { x402Version: 2, error, resource: resourceInfo(resourceUrl), accepts, extensions: discovery };
  }

  return async function x402Gate(req) {
    if (!X402_ENABLED) return null;
    if (isFree(req)) return null;

    const internalKey = process.env.X402_INTERNAL_KEY || '';
    if (internalKey && req.headers['x-guardian-key'] === internalKey) return null;

    let lanes = armedLanes();
    if (baseOnly) lanes = lanes.filter((l) => l.name === 'base');
    if (!lanes.length) {
      console.error('x402: X402_ENABLED but no treasury set — serving free');
      return null;
    }

    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'cyre.dev';
    const resourceUrl = proto + '://' + host + resourcePath;
    const accepts = lanes.map((l) => laneRequirements(l, price));

    const header = req.headers['payment-signature'] || req.headers['x-payment'];
    if (!header) {
      return { status: 402, body: paymentRequired(resourceUrl, accepts, 'Payment required') };
    }

    let payment;
    try {
      payment = JSON.parse(Buffer.from(String(header), 'base64').toString('utf8'));
    } catch (e) {
      return { status: 402, body: paymentRequired(resourceUrl, accepts, 'Malformed PAYMENT-SIGNATURE header') };
    }

    const paidNetwork = payment && ((payment.accepted && payment.accepted.network) || payment.network);
    const idx = lanes.findIndex((l) => laneEnv(l).network === paidNetwork);
    if (idx === -1) {
      return { status: 402, body: paymentRequired(resourceUrl, accepts, 'Unsupported payment network') };
    }
    const lane = lanes[idx];
    const expected = accepts[idx];
    const accepted = payment && payment.accepted;
    if (!accepted) {
      return { status: 402, body: paymentRequired(resourceUrl, accepts, 'Malformed payment payload') };
    }
    if (!offerMatches(accepted, expected)) {
      // Distinguish amount vs other pin failures for clearer 402 errors (existing Base/Solana behavior).
      try {
        if (BigInt(accepted.amount || '0') < BigInt(expected.amount || '0')) {
          return { status: 402, body: paymentRequired(resourceUrl, accepts, 'amount_too_low') };
        }
      } catch (e) {
        return { status: 402, body: paymentRequired(resourceUrl, accepts, 'amount_too_low') };
      }
      return { status: 402, body: paymentRequired(resourceUrl, accepts, 'offer_mismatch') };
    }
    const requirements = accepted;

    // Echo bazaar discovery on paymentPayload.extensions when settling (B402 Bazaar indexes from settle).
    const paymentPayload = discovery
      ? { ...payment, extensions: { ...(payment.extensions || {}), ...discovery } }
      : payment;

    try {
      const v = await callFacilitator(lane, lane.verifyPath || '/verify', {
        x402Version: 2,
        paymentPayload,
        paymentRequirements: requirements
      });
      if (!v || v.isValid !== true) {
        const reason = (v && (v.invalidMessage || v.invalidReason)) || 'Payment invalid';
        return { status: 402, body: paymentRequired(resourceUrl, accepts, reason) };
      }
      const s = await callFacilitator(lane, lane.settlePath || '/settle', {
        x402Version: 2,
        paymentPayload,
        paymentRequirements: requirements
      });
      if (!s || s.success !== true) {
        const reason = (s && (s.errorMessage || s.errorReason)) || 'Settlement failed';
        return { status: 402, body: paymentRequired(resourceUrl, accepts, reason) };
      }
      return { settled: s };
    } catch (e) {
      console.error('x402 facilitator error', e && e.message);
      return { status: 502, body: { error: 'Payment processor unreachable. Try again shortly.', detail: String((e && e.message) || e).slice(0, 300) } };
    }
  };
}

/** Apply gate result to a Vercel/Express-style res. Returns true if response was sent. */
export function applyX402Result(res, gate) {
  if (!gate) return false;
  if (gate.status) {
    if (gate.status === 402) {
      try { res.setHeader('PAYMENT-REQUIRED', Buffer.from(JSON.stringify(gate.body)).toString('base64')); } catch (e) { /* non-fatal */ }
    }
    res.status(gate.status).json(gate.body);
    return true;
  }
  if (gate.settled) {
    try {
      const b64 = Buffer.from(JSON.stringify(gate.settled)).toString('base64');
      res.setHeader('PAYMENT-RESPONSE', b64);
      res.setHeader('X-PAYMENT-RESPONSE', b64);
    } catch (e) { /* non-fatal */ }
  }
  return false;
}
