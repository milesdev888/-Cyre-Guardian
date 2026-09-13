// api/_authentic-auth.js — wallet ownership via personal_sign + session HMAC.

import crypto from 'node:crypto';
import { verifyMessage, getAddress } from 'ethers';
import { normalizeWallet } from './_authentic-store.js';

function secret() {
  return (
    process.env.AUTHENTIC_SESSION_SECRET ||
    process.env.GUARDIAN_INTERNAL_KEY ||
    process.env.X402_INTERNAL_KEY ||
    'authentic-dev-secret-change-me'
  );
}

export function loginMessage(wallet, nonce, handle) {
  const w = normalizeWallet(wallet);
  return [
    'Guardian Authentic — prove wallet ownership',
    `Wallet: ${w}`,
    `Nonce: ${nonce}`,
    handle ? `Handle: @${handle}` : null,
    'This signature does not move funds.'
  ]
    .filter(Boolean)
    .join('\n');
}

export function newNonce() {
  return crypto.randomBytes(16).toString('hex');
}

export function verifyWalletSignature({ wallet, message, signature }) {
  const w = normalizeWallet(wallet);
  if (!w) return { ok: false, error: 'invalid_wallet' };
  if (!signature || !message) return { ok: false, error: 'missing_signature' };
  try {
    const recovered = verifyMessage(message, signature);
    if (getAddress(recovered).toLowerCase() !== getAddress(w).toLowerCase()) {
      return { ok: false, error: 'bad_signer' };
    }
    return { ok: true, wallet: w };
  } catch (e) {
    return { ok: false, error: 'bad_signature', detail: String((e && e.message) || e).slice(0, 120) };
  }
}

export function issueSession(wallet, ttlSec = 60 * 60 * 24 * 14) {
  const w = normalizeWallet(wallet);
  const body = Buffer.from(
    JSON.stringify({ w, exp: Math.floor(Date.now() / 1000) + ttlSec })
  ).toString('base64url');
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function readSession(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expect = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    const w = normalizeWallet(payload.w);
    return w ? { wallet: w } : null;
  } catch {
    return null;
  }
}

export function sessionFromReq(req) {
  const h = String(req.headers.authorization || '');
  if (h.toLowerCase().startsWith('bearer ')) return readSession(h.slice(7).trim());
  const x = req.headers['x-authentic-session'];
  if (x) return readSession(String(x).trim());
  return null;
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'content-type, authorization, x-authentic-session, payment-signature, x-payment, x-guardian-key'
  );
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}
