// api/authentic-account.js

import {
  getAccount,
  getAccountForSession,
  getOrCreateAccount,
  normalizeHandle,
  normalizeWallet
} from './_authentic-store.js';
import {
  cors,
  readJson,
  loginMessage,
  newNonce,
  verifyWalletSignature,
  issueSession,
  sessionFromReq
} from './_authentic-auth.js';
import { isDurableRedis } from './_redis.js';

export const config = { maxDuration: 15 };

function publicAccount(a) {
  if (!a) return null;
  return {
    wallet: a.wallet,
    handle: a.handle,
    accountAgeLabel: a.accountAgeLabel,
    accountAgeSource: a.accountAgeSource,
    registeredAt: a.registeredAt,
    paid: !!a.paidAt,
    paidAt: a.paidAt,
    paymentTx: a.paymentTx,
    paymentNetwork: a.paymentNetwork,
    activeSerial: a.activeSerial,
    sealCount: a.sealCount || 0
  };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    const sess = sessionFromReq(req);
    const qWallet = normalizeWallet(req.query && req.query.wallet);
    const wallet = (sess && sess.wallet) || qWallet;
    if (!wallet) return res.status(401).json({ ok: false, error: 'auth_required' });
    if (sess && qWallet && sess.wallet !== qWallet) {
      return res.status(403).json({ ok: false, error: 'wallet_mismatch' });
    }
    const acct = sess ? await getAccountForSession(sess) : await getAccount(wallet);
    if (!acct) return res.status(404).json({ ok: false, error: 'not_registered' });
    return res.status(200).json({
      ok: true,
      account: publicAccount(acct),
      durable: isDurableRedis(),
      session: sess ? issueSession(acct.wallet, acct) : undefined
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  let body;
  try {
    body = await readJson(req);
  } catch {
    return res.status(400).json({ ok: false, error: 'bad_json' });
  }

  const action = String(body.action || 'register').toLowerCase();

  if (action === 'nonce') {
    const wallet = normalizeWallet(body.wallet);
    const handle = normalizeHandle(body.handle);
    if (!wallet) return res.status(400).json({ ok: false, error: 'invalid_wallet' });
    const nonce = newNonce();
    return res.status(200).json({ ok: true, nonce, message: loginMessage(wallet, nonce, handle) });
  }

  if (action === 'register' || action === 'login') {
    const wallet = normalizeWallet(body.wallet);
    const handle = normalizeHandle(body.handle);
    const age = String(body.accountAgeLabel || body.accountAge || '').trim().slice(0, 40);
    if (!wallet) return res.status(400).json({ ok: false, error: 'invalid_wallet' });
    const verified = verifyWalletSignature({
      wallet,
      message: body.message,
      signature: body.signature
    });
    if (!verified.ok) return res.status(401).json({ ok: false, error: verified.error });

    let acct = await getAccount(wallet);
    if (!acct) {
      if (!handle) return res.status(400).json({ ok: false, error: 'invalid_handle' });
      acct = await getOrCreateAccount(wallet, handle, age || null);
    }
    return res.status(200).json({
      ok: true,
      session: issueSession(wallet, acct),
      account: publicAccount(acct),
      durable: isDurableRedis()
    });
  }

  return res.status(400).json({ ok: false, error: 'unknown_action' });
}
