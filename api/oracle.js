// api/oracle.js — CYRE Oracle Pulse v1
// Mint/oracle-level RWA feed monitor.
// Seed IDs: NestUSD contracts oracle table (Pyth Lazer numeric) — never invent Hermes hex.
// Patterns only: stale / spike / divergence — no health scores, no verdicts.
// Soft-fail; Cache-Control: no-store; no LLM.

const LAZER = 'https://pyth-lazer.dourolabs.app';
const HERMES = 'https://hermes.pyth.network';
const DISCLAIMER = 'Patterns, not verdicts.';
const MOVE_WINDOW_SEC = 3600;
const STALE_THRESHOLD_SEC = 300;
const SPIKE_THRESHOLD_PCT = 2;
const DIVERGENCE_THRESHOLD_PCT = 1.5;

const SEED_FEEDS = [
  {
    symbol: 'USDY',
    mint: 'A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6',
    source: 'deferred',
    feedId: null,
    feedLabel: null,
    peer: null,
    deferDetail:
      'No verified public Pyth Lazer / Hermes feed ID for USDY in v1 research seeds (Aug 2026). Deferred — do not invent Hermes hex.'
  },
  {
    symbol: 'OUSG',
    mint: 'i7u4r16TcsJTgq1kAG8opmVZyVnAKBwLKu6ZPMwzxNc',
    source: 'deferred',
    feedId: null,
    feedLabel: null,
    peer: null,
    deferDetail: 'No verified public feed ID for OUSG (Aug 2026). Deferred.'
  },
  {
    symbol: 'syrupUSDC',
    mint: 'AvZZF1YaZDziPY2RCK4oJrRVrbN3mTD9NL24hPeaZeUj',
    source: 'deferred',
    feedId: null,
    feedLabel: null,
    peer: null,
    deferDetail:
      'No verified public feed ID for syrupUSDC in v1 research seeds (Aug 2026). Deferred — do not invent Hermes hex.'
  },
  {
    symbol: 'AAPLx',
    mint: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp',
    source: 'pyth-lazer',
    feedId: 1792,
    feedLabel: 'NestUSD Lazer AAPLx',
    peer: {
      symbol: 'AAPL',
      feedId: '49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
      feedLabel: 'Equity.US.AAPL/USD',
      source: 'hermes'
    }
  },
  {
    symbol: 'TSLAx',
    mint: 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB',
    source: 'pyth-lazer',
    feedId: 1847,
    feedLabel: 'NestUSD Lazer TSLAx',
    peer: {
      symbol: 'TSLA',
      feedId: '16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
      feedLabel: 'Equity.US.TSLA/USD',
      source: 'hermes'
    }
  },
  {
    symbol: 'SPYx',
    mint: 'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W',
    source: 'pyth-lazer',
    feedId: 1843,
    feedLabel: 'NestUSD Lazer SPYx',
    peer: {
      symbol: 'SPY',
      feedId: '19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5',
      feedLabel: 'Equity.US.SPY/USD',
      source: 'hermes'
    }
  }
];
