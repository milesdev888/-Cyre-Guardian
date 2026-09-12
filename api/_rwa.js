// api/_rwa.js — CoinGecko → RWA market strip mapping (pure helpers)

/** Pinned market ids (CoinGecko). Keep in display order. */
export const PINNED_IDS = [
  'chainlink',
  'ondo-finance',
  'pax-gold',
  'syrup', // Maple Finance (SYRUP)
  'centrifuge-2'
];

export function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Map a CoinGecko /coins/markets row to the widget shape.
 * Logs raw vs mapped when price/change are missing so prod logs catch shape drift.
 */
export function mapMarketRow(c, log = console) {
  const raw = {
    id: c && c.id,
    name: c && c.name,
    symbol: c && c.symbol,
    current_price: c && c.current_price,
    price_change_percentage_24h: c && c.price_change_percentage_24h
  };
  const mapped = {
    id: raw.id || null,
    name: String((c && c.name) || raw.id || 'Unknown'),
    symbol: String((c && c.symbol) || '').toUpperCase(),
    price: numOrNull(c && c.current_price),
    change24h: numOrNull(c && c.price_change_percentage_24h)
  };
  if (mapped.price == null || mapped.change24h == null) {
    try {
      log.warn('[rwa] incomplete market row', { raw, mapped });
    } catch (_) { /* ignore */ }
  }
  return mapped;
}

/**
 * @param {unknown} list CoinGecko markets array
 * @returns {{ assets: object[], complete: number, incomplete: number }}
 */
export function mapMarkets(list, log = console) {
  if (!Array.isArray(list)) {
    try {
      log.warn('[rwa] markets response is not an array', {
        type: list == null ? 'null' : typeof list,
        keys: list && typeof list === 'object' ? Object.keys(list).slice(0, 12) : []
      });
    } catch (_) { /* ignore */ }
    return { assets: [], complete: 0, incomplete: 0 };
  }

  const byId = new Map();
  for (const row of list) {
    if (!row || !row.id) continue;
    byId.set(row.id, mapMarketRow(row, log));
  }

  // Prefer pinned order; append any unexpected extras after.
  const assets = [];
  const seen = new Set();
  for (const id of PINNED_IDS) {
    const a = byId.get(id);
    if (a) {
      assets.push(a);
      seen.add(id);
    }
  }
  for (const [id, a] of byId) {
    if (!seen.has(id)) assets.push(a);
  }

  let complete = 0;
  let incomplete = 0;
  for (const a of assets) {
    if (a.price != null && a.change24h != null) complete += 1;
    else incomplete += 1;
  }
  return { assets, complete, incomplete };
}

export function assetsUsable(assets) {
  return Array.isArray(assets) && assets.some((a) => a && a.price != null);
}
