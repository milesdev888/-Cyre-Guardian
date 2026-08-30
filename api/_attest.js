// api/_attest.js — Guardian passport + decision-receipt attestation (Ed25519, zero-dep).
// Issues a signed, expiring receipt over measured claims so any agent can prove
// "Guardian graded this" or "this agent sealed a decision" to a third party.
//
// Env:
//   PASSPORT_SIGNING_KEY  base64 Ed25519 private seed (32 bytes) or seed+pub (64 bytes).
//                         When missing the passport still serves — just unsigned (fail-safe).
//   PASSPORT_TTL_SECONDS  passport lifetime (default 86400 = 24h)
//   RECEIPT_TTL_SECONDS   decision-receipt lifetime (default 2592000 = 30d)
//
// Token format (portable, header-safe):  base64url(claimsJSON) + "." + base64url(signature)
// Claims are canonicalised (sorted keys) before signing; verifiers must do the same.

import { createPrivateKey, createPublicKey, sign, verify, randomBytes } from 'crypto';

export const ISSUER = 'cyre.dev';
export const ALG = 'Ed25519';
export const PASSPORT_KIND = 'cyre-passport-attestation';
export const RECEIPT_KIND = 'cyre-decision-receipt';
const TTL = Math.max(60, Number(process.env.PASSPORT_TTL_SECONDS) || 86400);
const RECEIPT_TTL = Math.max(60, Number(process.env.RECEIPT_TTL_SECONDS) || 2592000);

// PKCS#8 DER prefix for an Ed25519 private key (RFC 8410) — lets us load a raw 32-byte seed.
const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function fromB64url(s) {
  const t = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(t + '==='.slice((t.length + 3) % 4), 'base64');
}

let cached = null; // { priv, pub, pubB64 } | false
function keys() {
  if (cached !== null) return cached;
  const raw = String(process.env.PASSPORT_SIGNING_KEY || '').trim();
  if (!raw) return (cached = false);
  try {
    const bytes = Buffer.from(raw, 'base64');
    const seed = bytes.length === 64 ? bytes.subarray(0, 32) : bytes;
    if (seed.length !== 32) throw new Error('seed must be 32 bytes');
    const priv = createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, seed]), format: 'der', type: 'pkcs8' });
    const spki = createPublicKey(priv).export({ format: 'der', type: 'spki' });
    const pub = spki.subarray(spki.length - 32);
    return (cached = { priv, pub, pubB64: b64url(pub) });
  } catch (e) {
    console.error('attest: bad PASSPORT_SIGNING_KEY —', e && e.message);
    return (cached = false);
  }
}

/** Public key (base64url) the world uses to verify — null when signing is not configured. */
export function issuerPublicKey() {
  const k = keys();
  return k ? k.pubB64 : null;
}

/** Deterministic JSON — sorted keys at every level. */
export function canonical(obj) {
  if (Array.isArray(obj)) return '[' + obj.map(canonical).join(',') + ']';
  if (obj && typeof obj === 'object') {
    return '{' + Object.keys(obj).sort().map((k) => JSON.stringify(k) + ':' + canonical(obj[k])).join(',') + '}';
  }
  return JSON.stringify(obj);
}

function signClaims(claims) {
  const k = keys();
  if (!k) return { attestation: null, token: null, unsigned: 'signing key not configured' };
  const msg = Buffer.from(canonical(claims));
  const sig = sign(null, msg, k.priv);
  const token = b64url(msg) + '.' + b64url(sig);
  return {
    attestation: { alg: ALG, issuer: ISSUER, publicKey: k.pubB64, claims, signature: b64url(sig), token },
    token
  };
}

/** Pull the attestable claims out of a measured passport. */
export function claimsFor(passport) {
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + TTL * 1000).toISOString();
  return {
    kind: PASSPORT_KIND,
    v: 1,
    iss: ISSUER,
    id: b64url(randomBytes(12)),
    address: passport.address,
    chain: 'solana',
    score: passport.score,
    riskLevel: passport.riskLevel,
    signalsTriggered: passport.signalsTriggered,
    signalsEvaluated: passport.signalsEvaluated,
    measuredAt: passport.fetchedAt,
    issuedAt,
    expiresAt
  };
}

/**
 * Sign a passport. Returns { attestation, token } or { attestation: null, token: null, unsigned: reason }.
 */
export function attest(passport) {
  return signClaims(claimsFor(passport));
}

/**
 * Sign a decision receipt — intent hash + signals the agent saw + action taken.
 * Returns { attestation, token } or unsigned reason.
 */
export function attestReceipt(input) {
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + RECEIPT_TTL * 1000).toISOString();
  const counterparties = Array.isArray(input.counterparties)
    ? [...new Set(input.counterparties.map((x) => String(x || '').trim()).filter(Boolean))].slice(0, 10)
    : [];
  const claims = {
    kind: RECEIPT_KIND,
    v: 1,
    iss: ISSUER,
    id: b64url(randomBytes(12)),
    chain: 'solana',
    actor: String(input.actor || ''),
    intentHash: String(input.intentHash || ''),
    action: String(input.action || 'other').slice(0, 32),
    score: typeof input.score === 'number' ? input.score : null,
    riskLevel: input.riskLevel || null,
    signalsTriggered: typeof input.signalsTriggered === 'number' ? input.signalsTriggered : null,
    signalsEvaluated: typeof input.signalsEvaluated === 'number' ? input.signalsEvaluated : null,
    counterparties,
    note: input.note ? String(input.note).slice(0, 160) : null,
    measuredAt: input.measuredAt || null,
    issuedAt,
    expiresAt
  };
  return signClaims(claims);
}

/**
 * Verify a token (or an attestation object). Pure — works without the private key,
 * using either the embedded publicKey pinned to the issuer key when configured.
 *
 * @param {string|object} input
 * @param {number} [now]
 * @param {{ kinds?: string[], allowExpired?: boolean }} [opts]
 */
export function verifyToken(input, now = Date.now(), opts = {}) {
  const allowed = Array.isArray(opts.kinds) && opts.kinds.length ? opts.kinds : [PASSPORT_KIND];
  const allowExpired = !!opts.allowExpired;

  let token = null;
  let pubB64 = null;
  if (typeof input === 'string') token = input.trim();
  else if (input && typeof input === 'object') {
    token = input.token || null;
    pubB64 = input.publicKey || null;
    if (!token && input.claims && input.signature) token = b64url(canonical(input.claims)) + '.' + input.signature;
  }
  if (!token || !token.includes('.')) return { valid: false, reason: 'malformed token' };

  const [c, s] = token.split('.');
  let claims;
  try {
    claims = JSON.parse(fromB64url(c).toString('utf8'));
  } catch (e) {
    return { valid: false, reason: 'claims not JSON' };
  }
  if (!claims || claims.iss !== ISSUER || !allowed.includes(claims.kind)) {
    return { valid: false, reason: 'not a Guardian attestation', claims };
  }

  // Pin to the configured issuer key when we have one; otherwise accept the embedded key
  // only if it is the issuer's (an embedded foreign key is NOT trusted).
  const issuerKey = issuerPublicKey();
  const useKey = issuerKey || pubB64;
  if (!useKey) return { valid: false, reason: 'issuer public key unavailable', claims };
  if (pubB64 && issuerKey && pubB64 !== issuerKey) return { valid: false, reason: 'public key is not the Guardian issuer key', claims };

  let ok = false;
  try {
    const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), fromB64url(useKey)]);
    const pub = createPublicKey({ key: spki, format: 'der', type: 'spki' });
    // Signature covers the canonical form — re-canonicalise so whitespace/key-order changes don't matter.
    ok = verify(null, Buffer.from(canonical(claims)), pub, fromB64url(s));
  } catch (e) {
    return { valid: false, reason: 'signature check failed', claims };
  }
  if (!ok) return { valid: false, reason: 'bad signature — claims were altered or not issued by Guardian', claims };

  const exp = Date.parse(claims.expiresAt);
  if (!Number.isFinite(exp)) return { valid: false, reason: 'missing expiry', claims };
  if (exp <= now) {
    if (!allowExpired) return { valid: false, reason: 'expired', expired: true, claims };
    return { valid: true, expired: true, claims, expiresInSeconds: 0 };
  }

  return { valid: true, claims, expiresInSeconds: Math.floor((exp - now) / 1000) };
}
