// CYRE Guardian — Mention Grader
// Cron: polls @Cyredev888 mentions, finds a Solana address in the text,
// grades it via cyre.dev/api/address, replies with the score card summary.
// Zero dependencies. Talks to X through the existing cyre-x-bridge MCP server,
// so no API keys live here — only BRIDGE_URL (with its secret path).
//
// Env:
//   BRIDGE_URL    e.g. https://cyre-x-bridge.onrender.com/mcp/<secret>   (required)
//   CYRE_API      default https://cyre.dev/api/address
//   INTERVAL_MIN  dedup window in minutes, match cron schedule (default 10)
//   DRY_RUN       "true" (default) = log replies only, never post
//   MAX_PER_RUN   default 5

const BRIDGE = process.env.BRIDGE_URL;
const CYRE_API = process.env.CYRE_API || "https://cyre.dev/api/address";
const INTERVAL_MIN = parseInt(process.env.INTERVAL_MIN || "10", 10);
const DRY_RUN = (process.env.DRY_RUN || "true").toLowerCase() !== "false";
const MAX_PER_RUN = parseInt(process.env.MAX_PER_RUN || "5", 10);
const B58 = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

if (!BRIDGE) { console.error("FATAL: BRIDGE_URL not set"); process.exit(1); }

async function callTool(name, args) {
  const res = await fetch(BRIDGE, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call",
      params: { name, arguments: args || {} } })
  });
  const raw = await res.text();
  // bridge may answer plain JSON or SSE-framed JSON
  let payload = raw;
  if (raw.startsWith("event:") || raw.includes("\ndata:")) {
    const m = raw.match(/data:\s*(\{[\s\S]*\})/);
    if (m) payload = m[1];
  }
  let j;
  try { j = JSON.parse(payload); } catch { throw new Error("bridge non-JSON: " + raw.slice(0, 200)); }
  if (j.error) throw new Error("bridge error: " + JSON.stringify(j.error).slice(0, 300));
  const c = j.result && j.result.content;
  const text = Array.isArray(c) ? c.map(b => b.text || "").join("\n") : "";
  try { return JSON.parse(text); } catch { return text; }
}

function grade(s){ return s<15?"A":s<30?"B":s<45?"C":s<60?"D":"F"; }
function degen(p){ return Math.min(100, Math.round((p.last24h||0)/6 + (p.failedPercent||0)*0.6 + ((p.transactionsSeen||0)>=1000?15:0))); }
function archetype(p){
  const bal=p.balanceSol||0, day=p.last24h||0, fail=p.failedPercent||0,
        age=p.ageDays||0, old=p.ageIsMinimum||age>730, idle=p.idleDays||0, seen=p.transactionsSeen||0;
  if(bal>=100) return "THE WHALE";
  if(fail>=25&&day>=200) return "THE MACHINE";
  if(day>=500) return "TERMINAL DEGEN";
  if(day>=100) return "THE DEGEN";
  if(old) return "THE OG";
  if(age<8) return "FRESH SPAWN";
  if(idle>90) return "THE SLEEPER";
  if(seen<20) return "THE TOURIST";
  return "THE REGULAR";
}
function shortAddr(a){ return a.slice(0,4) + "…" + a.slice(-4); }

function extractTweets(x) {
  // tolerate several bridge response shapes
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  if (x && x.tweets && Array.isArray(x.tweets)) return x.tweets;
  return [];
}

async function gradeAddress(addr) {
  const r = await fetch(CYRE_API + "?address=" + encodeURIComponent(addr));
  const d = await r.json();
  if (!d || !d.ok) throw new Error("api: " + (d && d.error || r.status));
  return d;
}

function buildReply(addr, d) {
  const p = d.profile || {};
  return "Guardian's read on " + shortAddr(addr) + ":\n\n" +
    "Pattern grade: " + grade(d.score) + "\n" +
    "Archetype: " + archetype(p) + "\n" +
    "Degen level: " + degen(p) + "/100\n" +
    "Risk band: " + (d.riskLevel || "n/a") + "\n\n" +
    "Patterns, not verdicts. Full card → cyre.dev/score";
}

(async () => {
  console.log("[grader] start", new Date().toISOString(), "DRY_RUN=" + DRY_RUN);
  let mentionsRaw;
  try { mentionsRaw = await callTool("get_mentions", {}); }
  catch (e) { console.error("[grader] get_mentions failed:", e.message); process.exit(0); }

  const tweets = extractTweets(mentionsRaw);
  console.log("[grader] mentions fetched:", tweets.length);
  if (!tweets.length) { console.log("[grader] raw shape sample:", JSON.stringify(mentionsRaw).slice(0, 400)); process.exit(0); }

  const cutoff = Date.now() - (INTERVAL_MIN + 2) * 60 * 1000;
  let handled = 0;

  for (const t of tweets) {
    if (handled >= MAX_PER_RUN) break;
    const id = t.id || t.id_str;
    const text = t.text || t.full_text || "";
    if (!id || !text) continue;

    // dedup by time window when created_at is present; otherwise DRY_RUN logs guide us
    if (t.created_at) {
      const ts = Date.parse(t.created_at);
      if (!isNaN(ts) && ts < cutoff) continue;
    }

    const m = text.match(B58);
    if (!m) continue;
    // first plausible address that isn't obviously a tx signature (sigs are 87-88 chars, already excluded by regex)
    const addr = m[0];

    let d;
    try { d = await gradeAddress(addr); }
    catch (e) { console.error("[grader] grade failed for", shortAddr(addr), e.message); continue; }

    const reply = buildReply(addr, d);
    console.log("[grader] DRAFT for tweet", id, "\n" + reply + "\n---");

    if (!DRY_RUN) {
      try {
        const out = await callTool("post_tweet", { text: reply, in_reply_to_tweet_id: String(id) });
        console.log("[grader] POSTED:", JSON.stringify(out).slice(0, 200));
      } catch (e) { console.error("[grader] post failed:", e.message); }
    }
    handled++;
  }
  console.log("[grader] done. handled:", handled);
  process.exit(0);
})();
