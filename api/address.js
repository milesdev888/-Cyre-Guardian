// api/address.js — CYRE address profile + x402 payment gate
// Site visitors (cyre.dev) stay FREE. Direct API callers (agents) pay per query via x402.
//
// Env vars (all optional — gate is OFF until X402_ENABLED=true):
//   SOLANA_RPC             RPC endpoint (defaults to public mainnet)
//   X402_ENABLED           "true" to arm the payment gate (default: off, everything free)
//   X402_NETWORK           "devnet" or "mainnet" — default for both chains (default: devnet)
//   X402_NETWORK_BASE      per-lane override for Base only (lets Base run mainnet while Solana rehearses on devnet)
//   CDP_API_KEY_ID         Coinbase CDP API key id — when set (with secret), Base lane defaults to the
//   CDP_API_KEY_SECRET     CDP mainnet facilitator and calls are signed with a CDP JWT (required for Bazaar indexing)
//   X402_PRICE             Price in USDC atomic units, 6 decimals (default: 5000 = $0.005)
//   -- Solana lane (armed when set) --
//   X402_PAY_TO            Solana treasury address receiving USDC
//   X402_FACILITATOR       Solana facilitator URL (default: https://x402.org/facilitator — testnet;
//                          mainnet needs a production facilitator, e.g. Coinbase CDP)
//   -- Base lane (armed when set) --
//   X402_PAY_TO_BASE       Base treasury address (0x...) receiving USDC
//   X402_FACILITATOR_BASE  Base facilitator URL (default: https://x402.org/facilitator — testnet;
//                          mainnet needs a production facilitator, e.g. Coinbase CDP)
// An agent gets ALL armed lanes in the 402 "accepts" list and pays on whichever chain it prefers.

const RPC = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DAY = 86400;

// ---------- x402 config ----------
const X402_ENABLED = process.env.X402_ENABLED === 'true';
const NET = (process.env.X402_NETWORK || 'devnet').toLowerCase();
const PRICE = String(process.env.X402_PRICE || '5000'); // $0.005 USDC (6 decimals on both chains)
const DESCRIPTION = 'Guardian address profile — explainable on-chain risk signals. Patterns, not verdicts.';

const DEFAULT_FACILITATOR = 'https://x402.org/facilitator';
const CDP_FACILITATOR = 'https://api.cdp.coinbase.com/platform/v2/x402';
const CDP_KEY_ID = process.env.CDP_API_KEY_ID || '';
const CDP_KEY_SECRET = process.env.CDP_API_KEY_SECRET || '';
const NET_BASE = (process.env.X402_NETWORK_BASE || 'mainnet').toLowerCase();

// Each lane: CAIP-2 network id + USDC contract per environment, its own treasury + facilitator.
const LANES = [
  {
    name: 'solana',
    payTo: process.env.X402_PAY_TO || '',
    facilitator: (process.env.X402_FACILITATOR || DEFAULT_FACILITATOR).replace(/\/$/, ''),
    mainnet: { network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', usdc: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
    devnet: { network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', usdc: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' }
  },
  {
    name: 'base',
    payTo: process.env.X402_PAY_TO_BASE || '0x9Ff25C4acf1DcDDf15fD2702C127A285f1dFa712',
    facilitator: (process.env.X402_FACILITATOR_BASE || (CDP_KEY_ID && CDP_KEY_SECRET ? CDP_FACILITATOR : DEFAULT_FACILITATOR)).replace(/\/$/, ''),
    mainnet: { network: 'eip155:8453', usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    devnet: { network: 'eip155:84532', usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' } // Base Sepolia
  }
];

function armedLanes() {
  return LANES.filter((l) => l.payTo);
}

function laneNet(lane) {
  return lane.name === 'base' ? NET_BASE : NET;
}

function laneRequirements(lane, resourceUrl) {
  const env = laneNet(lane) === 'mainnet' ? lane.mainnet : lane.devnet;
  return {
    scheme: 'exact',
    network: env.network,
    maxAmountRequired: PRICE,
    asset: env.usdc,
    payTo: lane.payTo,
    resource: resourceUrl,
    description: DESCRIPTION,
    mimeType: 'application/json',
    maxTimeoutSeconds: 60,
    outputSchema: {
      input: {
        type: 'http',
        method: 'GET',
        queryParams: {
          address: { type: 'string', required: true, description: 'Solana address (base58) to grade' }
        }
      },
      output: {
        ok: 'boolean',
        address: 'string',
        score: 'number (0-100 risk score)',
        riskLevel: 'LOW | MEDIUM | HIGH',
        signals: 'array of explainable risk signals',
        profile: 'object with wallet age, activity, balance stats'
      }
    },
    extra: {
      name: 'Guardian Address Profile',
      discoverable: true,
      provider: 'CYRE Guardian — cyre.dev',
      category: 'risk-and-fraud'
    }
  };
}

function isSiteRequest(req) {
  const src = String(req.headers.origin || req.headers.referer || '');
  return /^https:\/\/(www\.)?cyre\.dev(\/|$)/.test(src);
}

// ---- Coinbase CDP JWT (zero-dep; Node crypto only) ----
// Supports both CDP secret formats: Ed25519 (base64, new keys) and ECDSA P-256 (PEM, legacy keys).
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
  const seed = raw.subarray(0, 32); // Ed25519: 64 bytes = seed + public
  const pkcs8 = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]);
  return { key: crypto.createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' }), alg: 'EdDSA' };
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

async function callFacilitator(base, path, body) {
  const headers = { 'content-type': 'application/json' };
  if (base.includes('api.cdp.coinbase.com') && CDP_KEY_ID && CDP_KEY_SECRET) {
    const urlPath = new URL(base + path).pathname;
    headers.authorization = 'Bearer ' + cdpJwt('POST', urlPath);
  }
  const r = await fetch(base + path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('facilitator ' + path + ' ' + r.status);
  return r.json();
}

// Returns null if the request may proceed; otherwise an object {status, body} to send.
async function x402Gate(req) {
  if (!X402_ENABLED) return null;          // gate disarmed — everything free
  if (isSiteRequest(req)) return null;     // cyre.dev visitors stay free

  // Internal services (mention-grader, watchers) bypass with a shared key.
  const internalKey = process.env.X402_INTERNAL_KEY || '';
  if (internalKey && req.headers['x-guardian-key'] === internalKey) return null;

  const lanes = armedLanes();
  if (!lanes.length) {
    console.error('x402: X402_ENABLED but no treasury set (X402_PAY_TO / X402_PAY_TO_BASE) — serving free');
    return null;                           // misconfig must never break the product
  }

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'cyre.dev';
  const resourceUrl = proto + '://' + host + '/api/address';
  const accepts = lanes.map((l) => laneRequirements(l, resourceUrl));

  const header = req.headers['x-payment'];
  if (!header) {
    return { status: 402, body: { x402Version: 1, error: 'Payment required', accepts } };
  }

  let payment;
  try {
    payment = JSON.parse(Buffer.from(String(header), 'base64').toString('utf8'));
  } catch (e) {
    return { status: 402, body: { x402Version: 1, error: 'Malformed X-PAYMENT header', accepts } };
  }

  // Route to the lane the agent chose to pay on.
  const idx = lanes.findIndex((l) => {
    const env = laneNet(l) === 'mainnet' ? l.mainnet : l.devnet;
    return payment && payment.network === env.network;
  });
  if (idx === -1) {
    return { status: 402, body: { x402Version: 1, error: 'Unsupported payment network', accepts } };
  }
  const lane = lanes[idx];
  const requirements = accepts[idx];

  try {
    const v = await callFacilitator(lane.facilitator, '/verify', { x402Version: 1, paymentPayload: payment, paymentRequirements: requirements });
    if (!v || v.isValid !== true) {
      return { status: 402, body: { x402Version: 1, error: (v && v.invalidReason) || 'Payment invalid', accepts } };
    }
    const s = await callFacilitator(lane.facilitator, '/settle', { x402Version: 1, paymentPayload: payment, paymentRequirements: requirements });
    if (!s || s.success !== true) {
      return { status: 402, body: { x402Version: 1, error: (s && s.errorReason) || 'Settlement failed', accepts } };
    }
    return { settled: s }; // caller attaches X-PAYMENT-RESPONSE
  } catch (e) {
    console.error('x402 facilitator error', e && e.message);
    return { status: 502, body: { error: 'Payment processor unreachable. Try again shortly.' } };
  }
}

// ---------- chain reads (unchanged) ----------
async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || 'RPC error');
  return d.result;
}

function signal(id, name, points, triggered, detail) {
  return { id, name, points, triggered, detail };
}

export default async function handler(req, res) {
  const address = String((req.query && req.query.address) || '').trim();

  if (!B58.test(address)) {
    return res.status(400).json({ error: 'That does not look like a Solana address.' });
  }

  // ----- x402 gate -----
  const gate = await x402Gate(req);
  if (gate && gate.status) {
    return res.status(gate.status).json(gate.body);
  }
  if (gate && gate.settled) {
    try {
      res.setHeader('X-PAYMENT-RESPONSE', Buffer.from(JSON.stringify(gate.settled)).toString('base64'));
    } catch (e) { /* non-fatal */ }
  }

  try {
    const [sigs, bal] = await Promise.all([
      rpc('getSignaturesForAddress', [address, { limit: 1000 }]),
      rpc('getBalance', [address])
    ]);

    const list = Array.isArray(sigs) ? sigs : [];
    const now = Math.floor(Date.now() / 1000);
    const sol = (bal && typeof bal.value === 'number' ? bal.value : 0) / 1e9;

    if (!list.length) {
      return res.status(200).json({
        ok: true,
        address,
        empty: true,
        balanceSol: sol,
        message: 'No transaction history found for this address.'
      });
    }

    const times = list.map((s) => s.blockTime).filter(Boolean).sort((a, b) => a - b);
    const earliest = times[0] || now;
    const latest = times[times.length - 1] || now;
    const ageDays = Math.floor((now - earliest) / DAY);
    const idleDays = Math.floor((now - latest) / DAY);
    const capped = list.length >= 1000;

    const last24 = times.filter((t) => now - t < DAY).length;
    const failed = list.filter((s) => s.err).length;
    const failRate = list.length ? failed / list.length : 0;

    let biggestGap = 0;
    for (let i = 1; i < times.length; i++) {
      const g = times[i] - times[i - 1];
      if (g > biggestGap) biggestGap = g;
    }
    const gapDays = Math.floor(biggestGap / DAY);

    const signals = [];

    signals.push(
      capped
        ? signal('age', 'Wallet age', 0, false, ageDays < 1
            ? 'Too active to date — the 1,000 most recent transactions all landed within a day; first activity is older than this window reaches'
            : `Active for at least ${ageDays} days — history runs deeper than the 1,000-transaction window`)
        : ageDays < 7
        ? signal('age', 'Wallet age', 26, true, `First activity ${ageDays} day${ageDays === 1 ? '' : 's'} ago — a very new wallet`)
        : ageDays < 30
        ? signal('age', 'Wallet age', 12, true, `First activity ${ageDays} days ago`)
        : signal('age', 'Wallet age', 0, false, `First activity ${ageDays} days ago`)
    );

    signals.push(
      last24 >= 40
        ? signal('burst', 'Activity burst', 24, true, `${last24} transactions in the last 24 hours`)
        : last24 >= 15
        ? signal('burst', 'Activity burst', 12, true, `${last24} transactions in the last 24 hours`)
        : signal('burst', 'Activity burst', 0, false, `${last24} transactions in the last 24 hours`)
    );

    signals.push(
      failRate > 0.3
        ? signal('failures', 'Failed transactions', 18, true, `${Math.round(failRate * 100)}% of recent transactions failed — often automated behaviour`)
        : signal('failures', 'Failed transactions', 0, false, `${Math.round(failRate * 100)}% of recent transactions failed`)
    );

    signals.push(
      gapDays >= 90 && idleDays < 7
        ? signal('dormant', 'Dormant then active', 20, true, `Was inactive for ${gapDays} days, then moved again recently`)
        : signal('dormant', 'Dormant then active', 0, false, gapDays
            ? `Longest quiet stretch was ${gapDays} days`
            : 'Activity is continuous')
    );

    signals.push(
      sol < 0.01 && list.length > 20
        ? signal('balance', 'Balance vs activity', 14, true, `Holds ${sol.toFixed(4)} SOL despite ${list.length}+ recent transactions — pass-through pattern`)
        : signal('balance', 'Balance vs activity', 0, false, `Holds ${sol.toFixed(4)} SOL`)
    );

    signals.push(
      list.length < 5
        ? signal('history', 'Transaction history', 10, true, `Only ${list.length} transaction${list.length === 1 ? '' : 's'} on record`)
        : signal('history', 'Transaction history', 0, false, capped
            ? '1,000+ recent transactions'
            : `${list.length} transactions on record`)
    );

    const score = Math.min(signals.reduce((s, x) => s + x.points, 0), 100);
    const riskLevel = score < 30 ? 'LOW' : score < 70 ? 'MEDIUM' : 'HIGH';

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
    return res.status(200).json({
      ok: true,
      address,
      score,
      riskLevel,
      signals,
      signalsTriggered: signals.filter((s) => s.triggered).length,
      signalsEvaluated: signals.length,
      profile: {
        ageDays,
        ageIsMinimum: capped,
        idleDays,
        transactionsSeen: list.length,
        last24h: last24,
        failedPercent: Math.round(failRate * 100),
        longestGapDays: gapDays,
        balanceSol: Number(sol.toFixed(4))
      },
      checkedAt: new Date().toISOString()
    });
  } catch (e) {
    console.error('address', e && e.message);
    return res.status(200).json({ ok: false, error: 'Could not read chain data right now. Try again in a moment.' });
  }
}
