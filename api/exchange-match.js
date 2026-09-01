// api/exchange-match.js — Intent Exchange: match intent token vs vendor quote.
// GET/POST /api/exchange/match?intentToken=&resourceUrl=&payTo=&amountAtomic=&network=

import { createX402Gate, applyX402Result, isCyreSiteRequest } from './_x402.js';
import { verifyToken, EXCHANGE_KIND } from './_attest.js';
import { DISCLAIMER } from './_grade.js';
import { matchIntentToVendor } from './_exchange.js';

const DESCRIPTION =
  'Guardian Intent Exchange match — compare a sealed intent token to a vendor quote (URL, payTo, amount). Returns fit brief + next skills. Patterns, not verdicts.';

const x402Gate = createX402Gate({
  price: String(process.env.X402_PRICE_EXCHANGE_MATCH || '2000'),
  resourcePath: '/api/exchange/match',
  description: DESCRIPTION,
  serviceName: 'CYRE Guardian',
  tags: ['exchange', 'match', 'intent', 'agents', 'vendor'],
  isFree: isCyreSiteRequest
});

function readBody(req) {
  const b = req.body;
  if (!b) return null;
  if (typeof b === 'string') {
    try {
      return JSON.parse(b);
    } catch (e) {
      return null;
    }
  }
  return b;
}

function pickInput(req) {
  const body = req.method === 'POST' ? readBody(req) : null;
  const q = req.query || {};
  return {
    intentToken: String((body && (body.intentToken || body.token)) || q.intentToken || q.token || '').trim() || null,
    resourceUrl: String((body && body.resourceUrl) || q.resourceUrl || '').trim() || null,
    payTo: String((body && body.payTo) || q.payTo || '').trim() || null,
    amountAtomic: String((body && body.amountAtomic) != null ? body.amountAtomic : q.amountAtomic != null ? q.amountAtomic : '').trim() || null,
    network: String((body && body.network) || q.network || '').trim() || null
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, payment-signature, x-payment, x-guardian-key');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'HEAD') {
    return res.status(405).json({ ok: false, error: 'Use GET or POST', disclaimer: DISCLAIMER });
  }

  const hasPayment = !!(req.headers['payment-signature'] || req.headers['x-payment']);
  if (!hasPayment) {
    const quote = await x402Gate(req);
    if (applyX402Result(res, quote)) return;
  }

  const input = pickInput(req);
  if (!input.intentToken) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ ok: false, error: 'Provide `intentToken` from /api/exchange/post.', disclaimer: DISCLAIMER });
  }

  const verified = verifyToken(input.intentToken, Date.now(), { kinds: [EXCHANGE_KIND] });
  if (!verified.valid || !verified.claims) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ ok: false, error: verified.reason || 'invalid intent token', disclaimer: DISCLAIMER });
  }

  if (hasPayment) {
    const gate = await x402Gate(req);
    if (applyX402Result(res, gate)) return;
  }

  const match = matchIntentToVendor(verified.claims, {
    resourceUrl: input.resourceUrl,
    payTo: input.payTo,
    amountAtomic: input.amountAtomic,
    network: input.network || verified.claims.network
  });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ok: true,
    kind: 'cyre-exchange-match',
    version: 1,
    matched: match.ok,
    reasons: match.reasons,
    intent: match.summary,
    vendor: match.vendor,
    next: match.next,
    brief: match.ok
      ? 'Intent fits vendor quote — run Gate + Lockbox before pay.'
      : `No match — ${match.reasons.join(', ') || 'adjust quote'}.`,
    disclaimer: DISCLAIMER
  });
}
