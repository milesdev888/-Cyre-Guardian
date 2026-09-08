// api/badge-order.js — Create / read paid Guardian Verified orders.
// POST { mint } — live-scan qualify; if eligible and unissued → create ORDER (30m lock).
// Non-qualifying mints get 422 with no checkout — money cannot buy a non-qualifying badge.
// GET ?id=ORD-… — order status (public).

import {
  createPaidOrder,
  resolveOrder,
  publicOrderView,
  USDC_USD,
  C7_USD,
  BASE_TREASURY,
  C7_TREASURY
} from './_badge-order.js';
import { qualifyFromScan, QUALIFY_PATHS } from './_badge-qualify.js';
import { getBadgeByMint, hasRevocationHistory, isDurableBadgeStore } from './_badge-registry.js';

const DISCLAIMER =
  'Guardian Verified is a measured qualifying-path seal with live re-check — patterns and lock evidence, not investment advice. Digital assets are volatile. Payment does not guarantee issuance; founder brand-safety approval is required.';
const SCAN_BASE = process.env.GUARDIAN_SCAN_URL || 'https://scan.cyre.dev';
const SITE = process.env.GUARDIAN_SITE_URL || 'https://cyre.dev';

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

async function fetchScan(mint) {
  const url = `${SCAN_BASE}/api/scan?address=${encodeURIComponent(mint)}`;
  const r = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'GuardianBadge/order' },
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`scan HTTP ${r.status}`);
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-guardian-key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    const id = String((req.query && (req.query.id || req.query.order)) || '').trim();
    const token = String((req.query && req.query.token) || '').trim();
    if (id || token) {
      const order = await resolveOrder({ id, token });
      if (!order) return res.status(404).json({ ok: false, error: 'order not found' });
      return res.status(200).json(publicOrderView(order));
    }
    return res.status(200).json({
      ok: true,
      howTo: {
        create: 'POST /api/badge/order { mint } — only when live scan qualifies and mint is unissued',
        status: 'GET /api/badge/order?id=ORD-YYYY-NNNNN',
        checkout: `${SITE}/order?mint=<mint>`,
        watch: 'POST /api/badge/order/watch { orderId? }',
        founder: 'POST /api/badge/founder { action: approve|reject|list, orderId }',
        comp: 'POST /api/badge/register — founder comps bypass payment; never creates an order'
      },
      pricing: {
        usdcUsd: USDC_USD,
        c7Usd: C7_USD,
        lockMinutes: 30,
        usdcTreasuryBase: BASE_TREASURY,
        c7TreasurySolana: C7_TREASURY
      },
      paths: QUALIFY_PATHS,
      durable: isDurableBadgeStore(),
      disclaimer: DISCLAIMER
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  const body = readBody(req) || {};
  const mint = String(body.mint || '').trim();
  if (!mint) return res.status(400).json({ ok: false, error: 'mint required' });
  const chainId = String(body.chainId || 'solana').trim();

  try {
    const existing = await getBadgeByMint(mint, chainId);
    if (existing && existing.status === 'VALID') {
      return res.status(409).json({
        ok: false,
        error: 'already issued',
        badge: { serial: existing.serial, status: existing.status },
        verifyUrl: `${SITE}/verify/${existing.serial}`,
        disclaimer: DISCLAIMER
      });
    }

    const scan = await fetchScan(mint);
    const revokedHistory = await hasRevocationHistory(mint, chainId);
    const qualify = qualifyFromScan(scan, { hasRevocationHistory: revokedHistory });

    // Hard gate: non-qualifying tokens NEVER get an order / buy path.
    if (!qualify.eligible) {
      return res.status(422).json({
        ok: false,
        error: 'not badge eligible — checkout unavailable',
        detail: qualify.reason,
        qualify,
        paths: QUALIFY_PATHS,
        disclaimer: DISCLAIMER
      });
    }

    const order = await createPaidOrder({ mint, chainId, qualify, siteUrl: SITE });
    return res.status(201).json({
      ...publicOrderView(order),
      checkoutUrl: order.statusUrl,
      cta: `Get Guardian Verified — $${USDC_USD} USDC or $${C7_USD} in $C7.`,
      paths: QUALIFY_PATHS
    });
  } catch (e) {
    console.error('badge-order create failed', e && e.message);
    return res.status(500).json({
      ok: false,
      error: (e && e.message) || 'order create failed',
      disclaimer: DISCLAIMER
    });
  }
}
