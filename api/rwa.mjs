export default async function handler(req, res) {
  const KEY = process.env.COINGECKO_API_KEY || '';
  const H = { accept: 'application/json' };
  if (KEY) H['x-cg-demo-api-key'] = KEY;

  const B = 'https://api.coingecko.com/api/v3';
  const C = 'real-world-assets-rwa';

  try {
    const u = B + '/coins/markets?vs_currency=usd&category=' + C + '&order=market_cap_desc&per_page=6&page=1&sparkline=false';
    const r = await fetch(u, { headers: H });
    if (!r.ok) {
      const t = await r.text();
      return res.status(200).json({ ok: false, status: r.status, hasKey: KEY.length > 0, body: t.slice(0, 200) });
    }
    const list = await r.json();
    const assets = list.slice(0, 6).map(function (c) {
      return { name: c.name, symbol: String(c.symbol || '').toUpperCase(), price: c.current_price, change24h: c.price_change_percentage_24h };
    });

    let sector = null;
    try {
      const cr = await fetch(B + '/coins/categories', { headers: H });
      if (cr.ok) {
        const row = (await cr.json()).find(function (x) { return x.id === C; });
        if (row) sector = { marketCap: row.market_cap, change24h: row.market_cap_change_24h };
      }
    } catch (e) {}

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ ok: true, sector: sector, assets: assets, updatedAt: new Date().toISOString(), source: 'CoinGecko' });
  } catch (e) {
    return res.status(200).json({ ok: false, message: String(e && e.message) });
  }
}
