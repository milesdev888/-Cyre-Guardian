// api/badge-order-watch.js — Poll open orders for matching USDC / $C7 payments.
// Public POST { orderId } polls that order (status page).
// Founder/test may POST { orderId, inject: { lane, tx } } with x-guardian-key to simulate a match.
// Also accepts GET ?orderId= for simple cron pings.

import { watchOrders } from './_badge-pay-watch.js';
import { resolveOrder, saveOrder, publicOrderView, verifyOrderToken } from './_badge-order.js';

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

function founderAuthorized(req) {
  const key = process.env.BADGE_FOUNDER_KEY || process.env.X402_INTERNAL_KEY || '';
  if (!key) {
    return process.env.VERCEL_ENV !== 'production' && process.env.BADGE_FOUNDER_OPEN === '1';
  }
  const hdr =
    (req.headers && (req.headers['x-guardian-key'] || req.headers['X-Guardian-Key'])) || '';
  return String(hdr) === key;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-guardian-key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const body = req.method === 'POST' ? readBody(req) || {} : {};
  const orderId = String(
    (body.orderId || body.id || (req.query && (req.query.orderId || req.query.id)) || '')
  ).trim();
  const token = String(
    (body.token || (req.query && req.query.token) || '')
  ).trim();

  // Hydrate ephemeral store from signed token before watching.
  if (token) {
    const hydrated = verifyOrderToken(token);
    if (hydrated) await saveOrder(hydrated);
  }

  let inject = null;
  if (body.inject && founderAuthorized(req)) {
    inject = {
      lane: String(body.inject.lane || ''),
      tx: String(body.inject.tx || ''),
      from: body.inject.from || null
    };
  } else if (body.inject && !founderAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'inject requires founder key' });
  }

  try {
    const results = await watchOrders({ orderId: orderId || undefined, inject });
    const order = await resolveOrder({ id: orderId, token });
    return res.status(200).json({
      ok: true,
      watched: results.length,
      results,
      order: order ? publicOrderView(order) : null
    });
  } catch (e) {
    console.error('order-watch failed', e && e.message);
    return res.status(500).json({ ok: false, error: (e && e.message) || 'watch failed' });
  }
}
