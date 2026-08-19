// watcher.js — CYRE Guardian on-chain watcher
// Runs on a schedule (Render Cron). Scans a watchlist of Solana addresses,
// detects anomalies with the same signal philosophy as api/address.js,
// and drafts a neutral observation tweet for each fresh anomaly.
//
// DRY_RUN=true (default): tweets are LOGGED ONLY, never posted.
// DRY_RUN=false + X keys set: posts via X API v2.
//
// Env vars:
//   WATCHLIST   comma-separated Solana addresses (required)
//   RPC         Solana RPC url (default: public mainnet)
//   INTERVAL_MIN  how often this cron runs, in minutes (default 15) —
//                 anomalies only fire if the triggering tx landed inside
//                 this window, so the same event never tweets twice
//   DRY_RUN     "true" (default) or "false"
//   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET  (only for live mode)

const crypto = require('crypto');

const RPC = process.env.RPC || 'https://api.mainnet-beta.solana.com';
const WATCHLIST = (process.env.WATCHLIST || '').split(',').map(s => s.trim()).filter(Boolean);
const INTERVAL = (parseInt(process.env.INTERVAL_MIN, 10) || 15) * 60; // seconds
const DRY_RUN = (process.env.DRY_RUN || 'true').toLowerCase() !== 'false';
const DAY = 86400, HOUR = 3600;

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || 'RPC error');
  return d.result;
}

const short = (a) => a.slice(0, 4) + '…' + a.slice(-4);
const fmt = (n) => n.toLocaleString('en-US');

// ---- anomaly detection (stateless: only fires on events inside this run's window) ----
function detect(address, sigs, now) {
  const times = sigs.map(s => s.blockTime).filter(Boolean).sort((a, b) => a - b);
  if (!times.length) return [];
  const latest = times[times.length - 1];
  const inWindow = now - latest < INTERVAL;      // something happened since last run
  if (!inWindow) return [];

  const out = [];
  const lastHour = times.filter(t => now - t < HOUR);
  const failsHour = sigs.filter(s => s.err && s.blockTime && now - s.blockTime < HOUR).length;

  // 1) dormant wallet suddenly active: gap before the newest tx >= 90 days
  if (times.length >= 2) {
    const gap = latest - times[times.length - 2];
    if (gap >= 90 * DAY) {
      const gapDays = Math.floor(gap / DAY);
      out.push(
        `⚡ Watching: a wallet quiet for ${fmt(gapDays)} days just moved again.\n\n` +
        `${short(address)} — first activity in ${fmt(gapDays)} days, detected within minutes.\n\n` +
        `Pattern: dormant-then-active. Guardian is watching Solana live.\n` +
        `Check any address → cyre.dev/check`
      );
    }
  }

  // 2) activity burst: heavy tx volume in the last hour
  if (lastHour.length >= 40) {
    out.push(
      `⚡ Watching: ${fmt(lastHour.length)} transactions from one wallet in the last hour.\n\n` +
      `${short(address)} — sustained high-velocity activity, still ongoing.\n\n` +
      `Pattern: activity burst. Guardian is watching Solana live.\n` +
      `Check any address → cyre.dev/check`
    );
  }

  // 3) failure spike: high fail rate in the last hour (bot-like behaviour)
  if (lastHour.length >= 10 && failsHour / lastHour.length >= 0.4) {
    const pct = Math.round((failsHour / lastHour.length) * 100);
    out.push(
      `⚡ Watching: ${pct}% of one wallet's transactions failed in the last hour (${failsHour}/${fmt(lastHour.length)}).\n\n` +
      `${short(address)} — repeated failures at this rate are usually automated.\n\n` +
      `Pattern: failure spike. Guardian is watching Solana live.\n` +
      `Check any address → cyre.dev/check`
    );
  }

  return out;
}

// ---- X API v2 posting with OAuth 1.0a (no dependencies) ----
function pctEnc(s) {
  return encodeURIComponent(s).replace(/[!*'()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}
async function postTweet(text) {
  const url = 'https://api.twitter.com/2/tweets';
  const oauth = {
    oauth_consumer_key: process.env.X_API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: process.env.X_ACCESS_TOKEN,
    oauth_version: '1.0'
  };
  const paramStr = Object.keys(oauth).sort().map(k => `${pctEnc(k)}=${pctEnc(oauth[k])}`).join('&');
  const base = `POST&${pctEnc(url)}&${pctEnc(paramStr)}`;
  const key = `${pctEnc(process.env.X_API_SECRET)}&${pctEnc(process.env.X_ACCESS_SECRET)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', key).update(base).digest('base64');
  const header = 'OAuth ' + Object.keys(oauth).sort().map(k => `${pctEnc(k)}="${pctEnc(oauth[k])}"`).join(', ');

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': header, 'content-type': 'application/json' },
    body: JSON.stringify({ text })
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`X API ${r.status}: ${JSON.stringify(body)}`);
  return body?.data?.id;
}

// ---- main ----
(async () => {
  const now = Math.floor(Date.now() / 1000);
  console.log(`[guardian-watcher] ${new Date().toISOString()} — mode=${DRY_RUN ? 'DRY RUN (log only)' : 'LIVE (posting)'} — watching ${WATCHLIST.length} address(es), window ${INTERVAL / 60}min`);

  if (!WATCHLIST.length) { console.log('WATCHLIST is empty — nothing to do.'); return; }

  let drafts = 0;
  for (const address of WATCHLIST) {
    try {
      const sigs = await rpc('getSignaturesForAddress', [address, { limit: 1000 }]);
      const list = Array.isArray(sigs) ? sigs : [];
      console.log(`  ${short(address)}: ${list.length} recent txs read`);
      const tweets = detect(address, list, now);
      if (!tweets.length) { console.log(`  ${short(address)}: no fresh anomalies`); continue; }

      for (const text of tweets) {
        drafts++;
        console.log(`\n===== GUARDIAN DRAFT #${drafts} =====\n${text}\n===============================\n`);
        if (!DRY_RUN) {
          const missing = ['X_API_KEY','X_API_SECRET','X_ACCESS_TOKEN','X_ACCESS_SECRET'].filter(k => !process.env[k]);
          if (missing.length) { console.log(`  LIVE mode but missing env: ${missing.join(', ')} — not posting.`); continue; }
          try {
            const id = await postTweet(text);
            console.log(`  POSTED — tweet id ${id}`);
          } catch (e) {
            console.error(`  POST FAILED: ${e.message}`);
          }
        }
      }
    } catch (e) {
      console.error(`  ${short(address)}: error — ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 800)); // be gentle with the RPC
  }

  console.log(`[guardian-watcher] done — ${drafts} draft(s) this run.`);
})();
