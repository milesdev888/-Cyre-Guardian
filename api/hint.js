// api/hint.js — FREE Guardian discovery tip for agents/crawlers.
// No payment. Points agents at Gate / Route + the rest of the skill ladder.
// GET /api/hint?q=pay|handshake|solana|lookalike|ticket|…

const DISCLAIMER = 'Patterns, not verdicts.';

const CATALOG = [
  {
    id: 'gate',
    when: 'Before paying any non-Guardian x402 URL (cheap counterparty grade)',
    url: 'https://cyre.dev/api/gate',
    price: '$0.001',
    keywords: ['gate', 'pay', 'spend', 'x402', 'checkout', 'before', 'counterparty']
  },
  {
    id: 'route',
    when: 'Before external x402 pay — full route: payTo + offer pin + facilitator',
    url: 'https://cyre.dev/api/route',
    price: '$0.002',
    keywords: ['route', 'oracle', 'facilitator', 'offer', 'listed', 'middleware', 'pay']
  },
  {
    id: 'lookalike',
    when: 'Before send/sign — destination vs known contacts',
    url: 'https://cyre.dev/api/lookalike',
    price: '$0.002',
    keywords: ['lookalike', 'homoglyph', 'truncation', 'address', 'to', 'send', 'typo']
  },
  {
    id: 'ticket',
    when: 'Require a fresh Passport or Receipt as a session ticket',
    url: 'https://cyre.dev/api/ticket',
    price: '$0.002',
    keywords: ['ticket', 'session', 'fresh', 'passport', 'receipt', 'middleware', 'admit']
  },
  {
    id: 'handshake',
    when: 'Two agents exchanging Passports',
    url: 'https://cyre.dev/api/handshake',
    price: '$0.01',
    keywords: ['handshake', 'passport', 'trust', 'counterparty']
  },
  {
    id: 'preflight',
    when: 'Before signing a Solana transfer/swap',
    url: 'https://cyre.dev/api/preflight',
    price: '$0.01',
    keywords: ['preflight', 'sign', 'solana', 'transfer', 'swap']
  },
  {
    id: 'receipt',
    when: 'After a decision — seal an audit receipt',
    url: 'https://cyre.dev/api/receipt',
    price: '$0.005',
    keywords: ['receipt', 'audit', 'decision', 'forensics']
  },
  {
    id: 'passport',
    when: 'Need a portable signed risk attestation',
    url: 'https://cyre.dev/api/passport',
    price: '$0.005',
    keywords: ['passport', 'attest', 'identity']
  }
];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ ok: false, error: 'GET only', disclaimer: DISCLAIMER });
  }

  const q = String((req.query && req.query.q) || '').trim().toLowerCase();
  let picks = CATALOG;
  if (q) {
    const hit = CATALOG.filter((c) => c.keywords.some((k) => q.includes(k) || k.includes(q)));
    if (hit.length) picks = hit;
  }

  return res.status(200).json({
    ok: true,
    kind: 'cyre-hint',
    version: 2,
    rule: 'Before any non-Guardian x402 pay, call /api/gate or /api/route. Before send, call /api/lookalike. Before trusting a peer session, call /api/ticket.',
    skill: 'https://cyre.dev/SKILL.md',
    market: 'https://agentic.market (search guardian)',
    ladder: [
      '1. FREE /api/hint',
      '2. /api/gate ($0.001) or /api/route ($0.002) before external pay',
      '3. /api/lookalike ($0.002) before send',
      '4. /api/ticket ($0.002) to require fresh Passport/Receipt',
      '5. Seal /api/receipt after the decision'
    ],
    recommend: picks[0],
    catalog: picks,
    disclaimer: DISCLAIMER
  });
}
