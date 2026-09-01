// api/stream-events.js — Pulse Stream: pull graded events (long-poll / SSE chunk).
// GET/POST /api/stream/events?token=&waitSeconds=

import { createX402Gate, applyX402Result, isCyreSiteRequest } from './_x402.js';
import { attestStreamSubscription, verifyToken, STREAM_KIND } from './_attest.js';
import { B58, DISCLAIMER, gradeAddress } from './_grade.js';
import { buildStreamEvent, fingerprintFromGrade, reasonsForGrade } from './_streamlib.js';

const DESCRIPTION =
  'Guardian Pulse Stream events — evaluate sealed watches, emit only changes vs prior fingerprints, return rotated subscription token. Patterns, not verdicts.';

const x402Gate = createX402Gate({
  price: String(process.env.X402_PRICE_STREAM_EVENTS || '5000'),
  resourcePath: '/api/stream/events',
  description: DESCRIPTION,
  serviceName: 'CYRE Guardian',
  tags: ['stream', 'events', 'push', 'watch', 'agents'],
  isFree: isCyreSiteRequest
});

function readBody(req) {
  const b = req.body;
  if (!b) return null;
  if (typeof b === 'string') {
    try {
      return JSON.parse(b);
    } catch (e) {
      return { token: b.trim() };
    }
  }
  return b;
}

function pickInput(req) {
  const body = req.method === 'POST' ? readBody(req) : null;
  const q = req.query || {};
  const waitRaw = (body && body.waitSeconds) != null ? body.waitSeconds : q.waitSeconds;
  const waitSeconds = Math.max(0, Math.min(55, Number(waitRaw) || 0));
  return {
    token: String((body && body.token) || q.token || '').trim() || null,
    waitSeconds
  };
}

async function evaluateSubscription(claims) {
  const events = [];
  const fingerprints = { ...(claims.fingerprints || {}) };
  const minRisk = claims.minRisk || 'HIGH';

  for (const watch of claims.watches || []) {
    const target = watch.target;
    if (!B58.test(target)) continue;
    try {
      const g = await gradeAddress(target, { withAffinity: false });
      const fp = fingerprintFromGrade(g);
      const priorFp = fingerprints[target] || null;
      const reasons = reasonsForGrade(g, minRisk, priorFp);
      fingerprints[target] = fp;
      if (reasons.length) {
        events.push(buildStreamEvent(watch, g, reasons));
      }
      await new Promise((r) => setTimeout(r, 80));
    } catch (e) {
      events.push({
        type: 'grade.error',
        watch: watch.type || 'address',
        target,
        reasons: ['rpc_error'],
        error: String((e && e.message) || e).slice(0, 120)
      });
    }
  }

  return { events, fingerprints };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, payment-signature, x-payment, x-guardian-key, accept');
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
  if (!input.token) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ ok: false, error: 'Provide subscription `token` from /api/stream/subscribe.', disclaimer: DISCLAIMER });
  }

  const verified = verifyToken(input.token, Date.now(), { kinds: [STREAM_KIND] });
  if (!verified.valid || !verified.claims) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ ok: false, error: verified.reason || 'invalid subscription token', disclaimer: DISCLAIMER });
  }

  if (hasPayment) {
    const gate = await x402Gate(req);
    if (applyX402Result(res, gate)) return;
  }

  if (input.waitSeconds > 0) {
    await new Promise((r) => setTimeout(r, input.waitSeconds * 1000));
  }

  const claims = verified.claims;
  const { events, fingerprints } = await evaluateSubscription(claims);
  const rotated = attestStreamSubscription({
    actor: claims.actor,
    watches: claims.watches,
    minRisk: claims.minRisk,
    webhookUrl: claims.webhookUrl,
    fingerprints,
    seq: (claims.seq || 0) + 1
  });

  const payload = {
    ok: true,
    kind: 'cyre-stream-events',
    version: 1,
    seq: (claims.seq || 0) + 1,
    eventCount: events.length,
    events,
    token: rotated.token,
    attestation: rotated.attestation || null,
    brief:
      events.length === 0
        ? 'Quiet stream tick — no new hits vs prior fingerprints.'
        : `${events.length} event(s) on this tick. Store rotated token for next pull.`,
    disclaimer: DISCLAIMER
  };

  const accept = String(req.headers.accept || '').toLowerCase();
  if (accept.includes('text/event-stream')) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.write(`event: stream\ndata: ${JSON.stringify(payload)}\n\n`);
    return res.end();
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(payload);
}
