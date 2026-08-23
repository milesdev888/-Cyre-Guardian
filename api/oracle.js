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
