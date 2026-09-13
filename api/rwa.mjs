// api/rwa.mjs — CoinGecko proxy for the RWA market strip
// Env: COINGECKO_API_KEY (optional), COINGECKO_PLAN=pro (optional)
import { PINNED_IDS, mapMarkets, assetsUsable } from './_rwa.js';

const CACHE_MS = 60 * 1000;

/** Process-local last-good payload (warm isolate only; matches SPEC). */
let lastGood = null;
let lastGoodAt = 0;

function cgConfig() {
  const KEY = process.env.COINGECKO_API_KEY || '';
  const PRO = KEY.startsWith('CG-') && process.env.COINGECKO_PLAN === 'pro';
  const BASE = PRO
    ? 'https://pro-api.coingecko.com/api/v3'
    : 'https://api.coingecko.com/api/v3';
  const H = { accept: 'application/json' };
  if (KEY) H[PRO ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key'] = KEY;
  return { KEY, PRO, BASE, H };
}

function payload(assets, extra = {}) {
  return {
    ok: true,
    sector: null,
    assets,
    updatedAt: new Date().toISOString(),
    source: 'CoinGecko',
    ...extra
  };
}

export default async function handler(req, res) {
  const { KEY, BASE, H } = cgConfig();
  const ids = PINNED_IDS.join(',');
  const path =
    '/coins/markets?vs_currency=usd&ids=' +
    ids +
    '&order=market_cap_desc&per_page=' +
    PINNED_IDS.length +
    '&page=1&sparkline=false';

  try {
    const r = await fetch(BASE + path, { headers: H });
    if (!r.ok) {
      const t = await r.text();
      const status = r.status;
      const rateLimited = status === 429;
      console.warn('[rwa] CoinGecko HTTP', status, {
        rateLimited,
        hasKey: KEY.length > 0,
        body: t.slice(0, 200)
      });

      if (lastGood && assetsUsable(lastGood.assets)) {
        res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
        return res.status(200).json({
          ...lastGood,
          ok: true,
          degraded: true,
          reason: rateLimited ? 'coingecko_rate_limited' : 'coingecko_http_' + status,
          stale: true,
          staleAt: lastGood.updatedAt
        });
      }

      return res.status(200).json({
        ok: false,
        status,
        rateLimited,
        hasKey: KEY.length > 0,
        reason: rateLimited ? 'coingecko_rate_limited' : 'coingecko_http_' + status,
        body: t.slice(0, 200),
        assets: []
      });
    }

    const list = await r.json();
    // Log raw shape next to mapping (diagnosis step 2).
    try {
      const sample = Array.isArray(list)
        ? list.slice(0, 2).map((c) => ({
            id: c && c.id,
            name: c && c.name,
            symbol: c && c.symbol,
            current_price: c && c.current_price,
            price_change_percentage_24h: c && c.price_change_percentage_24h
          }))
        : list;
      console.log('[rwa] CoinGecko raw sample', JSON.stringify(sample));
    } catch (_) { /* ignore */ }

    const { assets, complete, incomplete } = mapMarkets(list);
    console.log('[rwa] mapped', {
      count: assets.length,
      complete,
      incomplete,
      prices: assets.map((a) => [a.symbol, a.price, a.change24h])
    });

    if (!assetsUsable(assets)) {
      if (lastGood && assetsUsable(lastGood.assets)) {
        res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
        return res.status(200).json({
          ...lastGood,
          ok: true,
          degraded: true,
          reason: 'coingecko_empty_prices',
          stale: true,
          staleAt: lastGood.updatedAt
        });
      }
      return res.status(200).json({
        ok: false,
        reason: 'coingecko_empty_prices',
        assets,
        complete,
        incomplete
      });
    }

    const body = payload(assets, {
      degraded: incomplete > 0,
      reason: incomplete > 0 ? 'partial_prices' : undefined,
      complete,
      incomplete
    });
    lastGood = body;
    lastGoodAt = Date.now();

    res.setHeader(
      'Cache-Control',
      's-maxage=' + Math.floor(CACHE_MS / 1000) + ', stale-while-revalidate=300'
    );
    return res.status(200).json(body);
  } catch (e) {
    console.warn('[rwa] fetch error', e && e.message);
    if (lastGood && assetsUsable(lastGood.assets) && Date.now() - lastGoodAt < 30 * 60 * 1000) {
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
      return res.status(200).json({
        ...lastGood,
        ok: true,
        degraded: true,
        reason: 'coingecko_fetch_error',
        stale: true,
        staleAt: lastGood.updatedAt
      });
    }
    return res.status(200).json({
      ok: false,
      reason: 'coingecko_fetch_error',
      message: String(e && e.message),
      assets: []
    });
  }
}
