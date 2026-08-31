// lib/peers.js — peer agent registry for networks Guardian does not cover.
// Machine-readable routing hints only. Guardian does not vouch for peer results.

export const peers = {
  xrpl: {
    name: 'cloudpayX',
    agentCard: 'https://api.cloudpayxagent.xyz/.well-known/agent-card.json',
    x402: 'https://api.cloudpayxagent.xyz/.well-known/x402',
    openapi: 'https://api.cloudpayxagent.xyz/openapi.json',
    skills: ['xrpl-risk-check', 'xrpl-stablecoin-route', 'xrpl-asset-analysis', 'xrpl-ledger-status']
  }
};

const XRPL_CLASSIC = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
const XRPL_XADDR = /^X[1-9A-HJ-NP-Za-km-z]{46}$/;
const XRPL_NETWORKS = new Set(['xrpl', 'xrpl:mainnet', 'xrpl:testnet', 'xrpl:0']);
const XRPL_CURRENCY = new Set(['XRP', 'RLUSD']);

function str(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function valuesFrom(obj, out) {
  if (!obj || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    out.push({ key: String(k).toLowerCase(), value: str(v) });
    if (v && typeof v === 'object' && !Array.isArray(v)) valuesFrom(v, out);
  }
}

/** Collect query + body fields from a Vercel/Express-style req. */
export function collectRequestFields(req) {
  const out = [];
  valuesFrom(req && req.query, out);
  valuesFrom(req && req.body, out);
  return out;
}

/**
 * Detect XRPL intent from request fields / free-text.
 * Returns "xrpl" or null. Solana base58 and 0x EVM must not match.
 */
export function detectNetwork(input) {
  if (input == null) return null;

  // Free-text string (hint q=, etc.)
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return null;
    if (XRPL_CLASSIC.test(s) || XRPL_XADDR.test(s)) return 'xrpl';
    const low = s.toLowerCase();
    if (/\bxrpl\b/.test(low) || /\bripple\b/.test(low) || /\brlusd\b/.test(low)) return 'xrpl';
    // bare currency tokens
    if (XRPL_CURRENCY.has(s.toUpperCase())) return 'xrpl';
    // scan for embedded classic address
    const m = s.match(/\br[1-9A-HJ-NP-Za-km-z]{24,34}\b/);
    if (m && XRPL_CLASSIC.test(m[0])) return 'xrpl';
    return null;
  }

  // req-like or plain object
  const fields = Array.isArray(input)
    ? input
    : input.query || input.body
      ? collectRequestFields(input)
      : (() => {
          const o = [];
          valuesFrom(input, o);
          return o;
        })();

  for (const { key, value } of fields) {
    if (!value) continue;
    if (key === 'network' || key === 'chain') {
      if (XRPL_NETWORKS.has(value.toLowerCase())) return 'xrpl';
    }
    if (key === 'currency' || key === 'asset') {
      if (XRPL_CURRENCY.has(value.toUpperCase())) return 'xrpl';
    }
    if (XRPL_CLASSIC.test(value) || XRPL_XADDR.test(value)) return 'xrpl';
  }

  // Free-text join of all values (e.g. q=rlusd route)
  const joined = fields.map((f) => f.value).filter(Boolean).join(' ');
  if (joined && detectNetwork(joined) === 'xrpl') return 'xrpl';

  return null;
}

export function xrplPeerBlock() {
  const p = peers.xrpl;
  return {
    name: p.name,
    agentCard: p.agentCard,
    x402: p.x402,
    skills: [...p.skills]
  };
}

/** 400 body for paid routes — never include PAYMENT-REQUIRED. */
export function xrplHandoffBody() {
  return {
    ok: false,
    unsupported_network: 'xrpl',
    reason: 'Guardian covers Base and Solana. XRPL intelligence is provided by a peer.',
    peer: xrplPeerBlock(),
    pattern_note: 'Routing hint only. Guardian does not vouch for peer results.'
  };
}

export default { peers, detectNetwork, xrplPeerBlock, xrplHandoffBody, collectRequestFields };
