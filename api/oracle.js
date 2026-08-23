// api/oracle.js — CYRE Oracle Pulse v1
// Mint/oracle-level RWA feed monitor via public Hermes HTTP.
// Patterns only: stale / spike / divergence — no health scores, no verdicts.
// Soft-fail; Cache-Control: no-store; no LLM.
// Endpoints documented in SPEC.md (Hermes latest + historical publish_time).

const HERMES = 'https://hermes.pyth.network';
const DISCLAIMER = 'Patterns, not verdicts.';
const MOVE_WINDOW_SEC = 3600;
const STALE_THRESHOLD_SEC = 300;
const SPIKE_THRESHOLD_PCT = 2;
const DIVERGENCE_THRESHOLD_PCT = 1.5;

// SPEC Watch seed mints → Pyth Hermes feed IDs (researched Aug 2026).
// Unknown / unmatched issuer feeds stay deferred (evaluated:false).
const SEED_FEEDS = [
  {
    symbol: 'USDY',
    mint: 'A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6',
    source: 'pyth',
    feedId: 'e393449f6aff8a4b6d3e1165a7c9ebec103685f3b41e60db4277b5b6d10e7326',
    feedLabel: 'Crypto.USDY/USD',
    peer: null
  },
  {
    symbol: 'OUSG',
    mint: 'i7u4r16TcsJTgq1kAG8opmVZyVnAKBwLKu6ZPMwzxNc',
    source: 'deferred',
    feedId: null,
    feedLabel: null,
    peer: null,
    deferDetail:
      'No public Pyth/Switchboard feed ID matched for OUSG in Hermes lookup (Aug 2026). Issuer feed deferred.'
  },
  {
    symbol: 'syrupUSDC',
    mint: 'AvZZF1YaZDziPY2RCK4oJrRVrbN3mTD9NL24hPeaZeUj',
    source: 'pyth',
    feedId: '2ad31d1c4a85fbf2156ce57fab4104124c5ef76a6386375ecfc8da1ed5ce1486',
    feedLabel: 'Crypto.SYRUPUSDC/USDC.RR',
    peer: null
  },
  {
    symbol: 'AAPLx',
    mint: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp',
    source: 'pyth',
    feedId: '978e6cc68a119ce066aa830017318563a9ed04ec3a0a6439010fc11296a58675',
    feedLabel: 'Crypto.AAPLX/USD',
    peer: {
      symbol: 'AAPL',
      feedId: '49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
      feedLabel: 'Equity.US.AAPL/USD'
    }
  },
  {
    symbol: 'TSLAx',
    mint: 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB',
    source: 'pyth',
    feedId: '47a156470288850a440df3a6ce85a55917b813a19bb5b31128a33a986566a362',
    feedLabel: 'Crypto.TSLAX/USD',
    peer: {
      symbol: 'TSLA',
      feedId: '16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
      feedLabel: 'Equity.US.TSLA/USD'
    }
  },
  {
    symbol: 'SPYx',
    mint: 'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W',
    source: 'pyth',
    feedId: '2817b78438c769357182c04346fddaad1178c82f4048828fe0997c3c64624e14',
    feedLabel: 'Crypto.SPYX/USD',
    peer: {
      symbol: 'SPY',
      feedId: '19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5',
      feedLabel: 'Equity.US.SPY/USD'
    }
  }
];

function toNum(priceObj) {
  if (!priceObj || priceObj.price == null || priceObj.expo == null) return null;
  const p = Number(priceObj.price);
  const e = Number(priceObj.expo);
  if (!Number.isFinite(p) || !Number.isFinite(e)) return null;
  return p * Math.pow(10, e);
}

function confNum(priceObj) {
  if (!priceObj || priceObj.conf == null || priceObj.expo == null) return null;
  const c = Number(priceObj.conf);
  const e = Number(priceObj.expo);
  if (!Number.isFinite(c) || !Number.isFinite(e)) return null;
  return c * Math.pow(10, e);
}

function pctMove(from, to) {
  if (from == null || to == null || from === 0) return null;
  return ((to - from) / Math.abs(from)) * 100;
}

function pctSpread(a, b) {
  if (a == null || b == null) return null;
  const mid = (Math.abs(a) + Math.abs(b)) / 2;
  if (mid === 0) return null;
  return (Math.abs(a - b) / mid) * 100;
}

function parseHermes(json) {
  const map = Object.create(null);
  const parsed = (json && json.parsed) || [];
  for (const row of parsed) {
    if (!row || !row.id) continue;
    const id = String(row.id).replace(/^0x/, '').toLowerCase();
    map[id] = row.price || null;
  }
  return map;
}

async function hermesLatest(ids) {
  if (!ids.length) return Object.create(null);
  const qs = ids.map((id) => 'ids[]=' + encodeURIComponent(id)).join('&');
  const r = await fetch(HERMES + '/v2/updates/price/latest?' + qs, {
    headers: { accept: 'application/json' }
  });
  if (!r.ok) throw new Error('Hermes latest HTTP ' + r.status);
  return parseHermes(await r.json());
}

async function hermesAt(publishTime, ids) {
  if (!ids.length) return Object.create(null);
  const qs = ids.map((id) => 'ids[]=' + encodeURIComponent(id)).join('&');
  const r = await fetch(
    HERMES + '/v2/updates/price/' + publishTime + '?' + qs,
    { headers: { accept: 'application/json' } }
  );
  if (!r.ok) return Object.create(null);
  try {
    return parseHermes(await r.json());
  } catch (_) {
    return Object.create(null);
  }
}

function deferredFeed(seed) {
  return {
    symbol: seed.symbol,
    mint: seed.mint,
    source: 'deferred',
    feedId: null,
    price: null,
    conf: null,
    publishTime: null,
    lastUpdateAgeSec: null,
    moveWindow: null,
    peerSpread: null,
    evaluated: false,
    detail:
      seed.deferDetail ||
      'Feed ID unknown — deferred (same posture as Forensics deferred patterns).'
  };
}

function buildFeed(seed, latestMap, priorMap, nowSec) {
  if (seed.source === 'deferred' || !seed.feedId) return deferredFeed(seed);

  const id = seed.feedId.toLowerCase();
  const priceObj = latestMap[id] || null;
  if (!priceObj) {
    return {
      symbol: seed.symbol,
      mint: seed.mint,
      source: seed.source,
      feedId: seed.feedId,
      feedLabel: seed.feedLabel || null,
      price: null,
      conf: null,
      publishTime: null,
      lastUpdateAgeSec: null,
      moveWindow: null,
      peerSpread: null,
      evaluated: false,
      detail: 'Hermes returned no latest price for this feed ID in this run.'
    };
  }

  const price = toNum(priceObj);
  const conf = confNum(priceObj);
  const publishTime = Number(priceObj.publish_time) || null;
  const lastUpdateAgeSec =
    publishTime != null ? Math.max(0, nowSec - publishTime) : null;

  const priorObj = priorMap[id] || null;
  const priorPrice = toNum(priorObj);
  const movePct = pctMove(priorPrice, price);
  const moveWindow =
    movePct == null
      ? null
      : {
          windowSec: MOVE_WINDOW_SEC,
          fromPrice: priorPrice,
          toPrice: price,
          movePct: Number(movePct.toFixed(4))
        };

  let peerSpread = null;
  if (seed.peer && seed.peer.feedId) {
    const peerObj = latestMap[seed.peer.feedId.toLowerCase()] || null;
    const peerPrice = toNum(peerObj);
    const spread = pctSpread(price, peerPrice);
    if (spread != null && peerPrice != null) {
      peerSpread = {
        peerSymbol: seed.peer.symbol,
        peerFeedId: seed.peer.feedId,
        peerPrice,
        spreadPct: Number(spread.toFixed(4))
      };
    }
  }

  return {
    symbol: seed.symbol,
    mint: seed.mint,
    source: seed.source,
    feedId: seed.feedId,
    feedLabel: seed.feedLabel || null,
    price,
    conf,
    publishTime,
    lastUpdateAgeSec,
    moveWindow,
    peerSpread,
    evaluated: true
  };
}

function buildPatterns(feeds) {
  const patterns = [];

  for (const f of feeds) {
    if (!f.evaluated) {
      patterns.push({
        id: 'deferred_' + f.symbol,
        pattern: 'deferred',
        symbol: f.symbol,
        triggered: false,
        evaluated: false,
        detail: f.detail || 'Feed not evaluated in this run.'
      });
      continue;
    }

    const age = f.lastUpdateAgeSec;
    const staleTriggered = age != null && age > STALE_THRESHOLD_SEC;
    patterns.push({
      id: 'stale_' + f.symbol,
      pattern: 'stale',
      symbol: f.symbol,
      triggered: staleTriggered,
      evaluated: true,
      detail:
        age == null
          ? 'No publishTime measured for ' + f.symbol + '.'
          : 'lastUpdateAgeSec=' +
            age +
            ' (threshold ' +
            STALE_THRESHOLD_SEC +
            's).',
      measured: {
        lastUpdateAgeSec: age,
        thresholdSec: STALE_THRESHOLD_SEC
      }
    });

    const move =
      f.moveWindow && typeof f.moveWindow.movePct === 'number'
        ? f.moveWindow.movePct
        : null;
    const spikeTriggered =
      move != null && Math.abs(move) >= SPIKE_THRESHOLD_PCT;
    patterns.push({
      id: 'spike_' + f.symbol,
      pattern: 'spike',
      symbol: f.symbol,
      triggered: spikeTriggered,
      evaluated: move != null,
      detail:
        move == null
          ? 'Move window not measured for ' +
            f.symbol +
            ' (no prior Hermes sample).'
          : 'moveWindow=' +
            move +
            '% over ' +
            MOVE_WINDOW_SEC +
            's (threshold ±' +
            SPIKE_THRESHOLD_PCT +
            '%).',
      measured: {
        movePct: move,
        windowSec: MOVE_WINDOW_SEC,
        thresholdPct: SPIKE_THRESHOLD_PCT
      }
    });

    if (f.peerSpread && typeof f.peerSpread.spreadPct === 'number') {
      const spread = f.peerSpread.spreadPct;
      const divTriggered = spread >= DIVERGENCE_THRESHOLD_PCT;
      patterns.push({
        id: 'divergence_' + f.symbol,
        pattern: 'divergence',
        symbol: f.symbol,
        triggered: divTriggered,
        evaluated: true,
        detail:
          'peerSpread=' +
          spread +
          '% vs ' +
          f.peerSpread.peerSymbol +
          ' (threshold ' +
          DIVERGENCE_THRESHOLD_PCT +
          '%).',
        measured: {
          spreadPct: spread,
          peerSymbol: f.peerSpread.peerSymbol,
          peerPrice: f.peerSpread.peerPrice,
          feedPrice: f.price,
          thresholdPct: DIVERGENCE_THRESHOLD_PCT
        }
      });
    } else if (f.symbol === 'AAPLx' || f.symbol === 'TSLAx' || f.symbol === 'SPYx') {
      patterns.push({
        id: 'divergence_' + f.symbol,
        pattern: 'divergence',
        symbol: f.symbol,
        triggered: false,
        evaluated: false,
        detail:
          'Peer equity feed unavailable in this run — divergence not measured.'
      });
    }
  }

  return patterns;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const fetchedAt = new Date().toISOString();
  const nowSec = Math.floor(Date.now() / 1000);
  const priorSec = nowSec - MOVE_WINDOW_SEC;

  try {
    const primaryIds = [];
    const peerIds = [];
    for (const s of SEED_FEEDS) {
      if (s.feedId) primaryIds.push(s.feedId);
      if (s.peer && s.peer.feedId) peerIds.push(s.peer.feedId);
    }
    const allLatestIds = primaryIds.concat(peerIds);

    let latestMap = Object.create(null);
    let priorMap = Object.create(null);
    try {
      latestMap = await hermesLatest(allLatestIds);
    } catch (e) {
      console.error('oracle hermes latest', e && e.message);
    }
    try {
      priorMap = await hermesAt(priorSec, primaryIds);
    } catch (e) {
      console.error('oracle hermes prior', e && e.message);
    }

    const feeds = SEED_FEEDS.map((s) =>
      buildFeed(s, latestMap, priorMap, nowSec)
    );
    const patterns = buildPatterns(feeds);
    const evaluatedFeeds = feeds.filter((f) => f.evaluated).length;
    const triggered = patterns.filter(
      (p) => p.evaluated !== false && p.triggered
    ).length;

    return res.status(200).json({
      ok: true,
      kind: 'cyre-oracle',
      version: 1,
      disclaimer: DISCLAIMER,
      fetchedAt,
      window: {
        moveWindowSec: MOVE_WINDOW_SEC,
        staleThresholdSec: STALE_THRESHOLD_SEC,
        spikeThresholdPct: SPIKE_THRESHOLD_PCT,
        divergenceThresholdPct: DIVERGENCE_THRESHOLD_PCT
      },
      endpoints: {
        hermesLatest: HERMES + '/v2/updates/price/latest?ids[]=…',
        hermesAt:
          HERMES + '/v2/updates/price/{unixPublishTime}?ids[]=…'
      },
      counters: {
        feedsConfigured: feeds.length,
        feedsEvaluated: evaluatedFeeds,
        patternsTriggered: triggered
      },
      feeds,
      patterns
    });
  } catch (e) {
    console.error('oracle', e && e.message);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      ok: false,
      kind: 'cyre-oracle',
      version: 1,
      disclaimer: DISCLAIMER,
      fetchedAt,
      error: 'Could not read oracle feeds right now. Try again in a moment.',
      feeds: [],
      patterns: []
    });
  }
}
