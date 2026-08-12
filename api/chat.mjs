// api/chat.mjs — Guardian chatbot for cyre.dev
// Env var already set in Vercel: ANTHROPIC_API_KEY

const SYSTEM = `You are Guardian, the assistant on cyre.dev for Cyre 7.

Cyre 7 builds fraud detection, credit scoring and forensic analysis for on-chain real-world assets. One model, seven products.

Products: 1 Fraud Prediction (Live — rules-based transaction risk scoring, every score shows which rules fired and why; try it at https://cyre-fraud-prediction.vercel.app). 2 Credit Scores, 3 Behavior Passport, 4 Forensics, 5 Futures Market, 6 Sovereign AI — all in development. 7 Insurance Protocol — planned.

How it works: point a transaction stream at the API. No custody, no private keys. Each transaction is scored; your own logic decides whether to flag, hold or pass.

Pricing: Starter $500/mo, Professional $5,000/mo, Enterprise custom.

Rules you must follow:
- Never state revenue, MRR, customer or user counts, transaction volumes, accuracy rates, uptime, or protocol counts. Cyre 7 does not publish these. If asked, say the company is early stage and the team shares diligence detail directly.
- Never discuss a CYRE token, token price, presale or listing.
- Never give investment, legal, tax or financial advice.
- Do not invent features, dates, customers or integrations. If you don't know, say so and point to the access form.
- Be brief — two or three sentences unless more is genuinely needed.`;

const hits = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const ip = String(req.headers['x-forwarded-for'] || 'anon').split(',')[0];
  const now = Date.now();
  const rec = hits.get(ip) || { n: 0, t: now };
  if (now - rec.t > 60000) { rec.n = 0; rec.t = now; }
  rec.n += 1;
  hits.set(ip, rec);
  if (rec.n > 8) {
    return res.status(200).json({ reply: 'That is a lot of questions at once — give it a minute and try again.' });
  }

  try {
    const list = (((req.body || {}).messages) || [])
      .slice(-10)
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }));

    if (!list.length) return res.status(400).json({ error: 'No message' });

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 400,
        system: SYSTEM,
        messages: list
      })
    });

    const d = await r.json();
    if (!r.ok) {
      console.error('anthropic', r.status, JSON.stringify(d).slice(0, 300));
      return res.status(200).json({ reply: '' });
    }

    const reply = (d.content || []).map((c) => c.text || '').join('').trim();
    return res.status(200).json({ reply });
  } catch (e) {
    console.error('chat', e && e.message);
    return res.status(200).json({ reply: '' });
  }
}
