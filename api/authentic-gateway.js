// api/authentic-gateway.js — single Authentic entry so /tmp fallback shares one isolate.
// When Redis is armed (production), all isolates share durable state.
// When not (some previews), one function avoids cross-lambda /tmp misses.

import account from './authentic-account.js';
import pay from './authentic-pay.js';
import jobs from './authentic-jobs.js';
import worker from './authentic-worker.js';
import check from './authentic-check.js';
import image from './authentic-image.js';
import revoke from './authentic-revoke.js';
import { isDurableRedis } from './_redis.js';

export const config = { maxDuration: 60 };

const ROUTES = {
  account,
  pay,
  jobs,
  worker,
  check,
  image,
  revoke
};

function actionFromReq(req) {
  const q = (req.query && (req.query.action || req.query.op)) || '';
  if (q) return String(q).toLowerCase();
  const url = String(req.url || '');
  const m = url.match(/\/api\/authentic(?:-gateway)?\/?([^/?#]+)/i);
  if (m && m[1] && m[1].toLowerCase() !== 'authentic-gateway') return m[1].toLowerCase();
  const path = String((req.query && req.query.path) || '');
  return path.toLowerCase();
}

export default async function handler(req, res) {
  res.setHeader('X-Authentic-Durable', isDurableRedis() ? '1' : '0');
  const action = actionFromReq(req);
  const fn = ROUTES[action];
  if (!fn) {
    return res.status(404).json({
      ok: false,
      error: 'unknown_action',
      actions: Object.keys(ROUTES),
      durable: isDurableRedis()
    });
  }
  return fn(req, res);
}
