// api/_rwa.test.js — RWA CoinGecko mapping + empty-price detection
import { PINNED_IDS, mapMarkets, mapMarketRow, numOrNull, assetsUsable } from './_rwa.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assert failed');
}

const silent = { warn() {}, log() {} };

{
  assert(PINNED_IDS.includes('syrup'), 'Maple Finance id is syrup');
  assert(PINNED_IDS.includes('centrifuge-2'), 'Centrifuge id is centrifuge-2');
  assert(PINNED_IDS.includes('chainlink'), 'chainlink pinned');
}

{
  assert(numOrNull(11.5) === 11.5, 'number');
  assert(numOrNull('0.22') === 0.22, 'numeric string');
  assert(numOrNull('') == null, 'empty string');
  assert(numOrNull(null) == null, 'null');
  assert(numOrNull(undefined) == null, 'undefined');
  assert(numOrNull(NaN) == null, 'NaN');
  assert(numOrNull('nope') == null, 'junk');
}

{
  const row = mapMarketRow(
    {
      id: 'chainlink',
      name: 'Chainlink',
      symbol: 'link',
      current_price: 11.53,
      price_change_percentage_24h: -0.46
    },
    silent
  );
  assert(row.symbol === 'LINK', 'symbol upper');
  assert(row.price === 11.53, 'price');
  assert(row.change24h === -0.46, 'chg');
}

{
  const row = mapMarketRow(
    { id: 'x', name: 'X', symbol: 'x', current_price: '1.25', price_change_percentage_24h: '2.5' },
    silent
  );
  assert(row.price === 1.25, 'coerce price string');
  assert(row.change24h === 2.5, 'coerce chg string');
}

{
  const row = mapMarketRow(
    { id: 'x', name: 'X', symbol: 'x', current_price: null, price_change_percentage_24h: null },
    silent
  );
  assert(row.price == null && row.change24h == null, 'null prices stay null');
  assert(row.name === 'X', 'name still present when prices missing');
}

{
  const cg = [
    {
      id: 'syrup',
      name: 'Maple Finance',
      symbol: 'syrup',
      current_price: 0.22,
      price_change_percentage_24h: 1.2
    },
    {
      id: 'chainlink',
      name: 'Chainlink',
      symbol: 'link',
      current_price: 11.5,
      price_change_percentage_24h: -0.5
    },
    {
      id: 'ondo-finance',
      name: 'Ondo',
      symbol: 'ondo',
      current_price: 0.34,
      price_change_percentage_24h: -1.1
    },
    {
      id: 'pax-gold',
      name: 'PAX Gold',
      symbol: 'paxg',
      current_price: 4300,
      price_change_percentage_24h: 0.01
    },
    {
      id: 'centrifuge-2',
      name: 'Centrifuge',
      symbol: 'cfg',
      current_price: 0.1,
      price_change_percentage_24h: 3.4
    }
  ];
  const { assets, complete, incomplete } = mapMarkets(cg, silent);
  assert(assets.length === 5, 'five assets');
  assert(assets[0].id === 'chainlink', 'pinned order starts with chainlink');
  assert(assets[3].id === 'syrup', 'maple/syrup in pin order');
  assert(complete === 5 && incomplete === 0, 'all complete');
  assert(assetsUsable(assets), 'usable');
}

{
  const { assets, complete, incomplete } = mapMarkets(
    [
      { id: 'chainlink', name: 'Chainlink', symbol: 'link', current_price: null, price_change_percentage_24h: null },
      { id: 'syrup', name: 'Maple Finance', symbol: 'syrup', current_price: null, price_change_percentage_24h: null }
    ],
    silent
  );
  assert(assets.length === 2, 'rows kept when prices null');
  assert(assets.every((a) => a.name && a.symbol), 'name+ticker present');
  assert(complete === 0 && incomplete === 2, 'all incomplete');
  assert(!assetsUsable(assets), 'not usable without prices');
}

{
  const { assets } = mapMarkets({ status: { error_code: 429 } }, silent);
  assert(assets.length === 0, 'non-array → empty');
  assert(!assetsUsable(assets), 'empty not usable');
}

console.log('_rwa.test.js ok');
