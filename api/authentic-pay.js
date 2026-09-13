// api/authentic-pay.js — $25 Base USDC via existing x402 rail (baseOnly).

import { createX402Gate, applyX402Result } from './_x402.js';
import { getAccount, markPaid, normalizeWallet } from './_authentic-store.js';
import { cors, readJson, sessionFromReq } from './_authentic-auth.js';

export const config = { maxDuration: 60 };

const PRICE = String(process.env.X402_PRICE_AUTHENTIC || '25000000');

const x402Gate = createX402Gate({
  price: PRICE,
  resourcePath: '/api/authentic/pay',
  description:
    'Guardian Authentic — unlock seal generation ($25 USDC on Base). One payment per wallet; reissue stays free.',
  serviceName: 'Guardian Authentic',
  tags: ['authentic', 'seal', 'base', 'usdc', 'identity'],
  baseOnly: true,
  isFree: () => false
});

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const sess = sessionFromReq(req);
  let body = {};
  try {
    body = await readJson(req);
  } catch {
    body = {};
  }
  const wallet = (sess && sess.wallet) || normalizeWallet(body.wallet);
  if (!wallet) return res.status(401).json({ ok: false, error: 'auth_required' });

  const acct = await getAccount(wallet);
  if (!acct) return res.status(404).json({ ok: false, error: 'not_registered' });
  if (acct.paidAt) {
    return res.status(200).json({
      ok: true,
      alreadyPaid: true,
      paymentTx: acct.paymentTx,
      paidAt: acct.paidAt,
      network: acct.paymentNetwork || 'base'
    });
  }

  const internal = process.env.X402_INTERNAL_KEY || '';
  if (internal && req.headers['x-guardian-key'] === internal) {
    const updated = await markPaid(wallet, {
      txHash: 'internal:' + Date.now().toString(16),
      network: 'base'
    });
    return res.status(200).json({
      ok: true,
      paid: true,
      paymentTx: updated.paymentTx,
      paidAt: updated.paidAt,
      network: 'base',
      via: 'internal'
    });
  }

  const gate = await x402Gate(req);
  if (applyX402Result(res, gate)) return;

  if (!gate) {
    return res.status(503).json({
      ok: false,
      error: 'payments_unavailable',
      detail: 'Base USDC x402 rail is not armed (X402_ENABLED / X402_PAY_TO_BASE).'
    });
  }

  const settled = gate.settled || {};
  const txHash = settled.transaction || settled.txHash || settled.tx || null;
  const updated = await markPaid(wallet, { txHash, network: 'base' });
  return res.status(200).json({
    ok: true,
    paid: true,
    paymentTx: updated.paymentTx,
    paidAt: updated.paidAt,
    network: 'base',
    amountAtomic: PRICE,
    amountUsd: 25
  });
}
