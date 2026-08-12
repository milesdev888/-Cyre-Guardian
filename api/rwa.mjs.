// api/rwa.mjs — CYRE 7 live RWA market feed
// Env var: COINGECKO_API_KEY

const PINNED_IDS = [];
const CATEGORY = 'real-world-assets-rwa';
const ROWS = 6;
const CACHE_MS = 60 * 1000;

const KEY = process.env.COINGECKO_API_KEY || '';
const PRO = KEY.startsWith('CG-') && process.env.COINGECKO_PLAN === 'pro';
const BASE = PRO ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3';

function headers() {
  const h = { accept: 'application/json' };
  if (KEY) h[PRO ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key'] = KEY;
  return h;
}

let cache = { at: 0, data: null };

async function get(path) {
  const r = await fetch(BASE + path, { headers: headers() });
  if (!r.ok) throw new Error('CoinGecko ' + r.status + ' on ' + path);
  return r.json();
}

async function loadSector() {
  const all = await get('/coins/categories');
  const row = Array.isArray(all) ? all.find((c) => c.id === CATEGORY) : null;
  if (!row) return null;
  return {
    marketCap: row.market_cap ?? null,
    change24h: row.market_cap_change_24h ?? null,
  };
}

async function loadAssets() {
  const q = PINNED_IDS.length ? 'ids=' + PINNED_IDS.join(',') : 'category=' + CATEGORY;
  const list = await get(
    '/coins/markets?vs_currency=usd&' + q +
    '&order=market_cap_desc&per_page=' + ROWS + '&page=1&sparkline=false'
  );
  if (!Array.isArray(list)) return [];
  return list.slice(0, ROWS).map((c) => ({
    name: c.name,
    symbol: (c.symbol || '').toUpper
