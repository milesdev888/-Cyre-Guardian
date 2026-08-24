#!/usr/bin/env node
// CYRE bot smoke test — checks bridge health, mention fetch, and address grading.
// Usage:
//   BRIDGE_URL=https://cyre-x-bridge.onrender.com/mcp/<secret> node scripts/bot-smoke.js
// Optional:
//   CYRE_API=https://cyre.dev/api/address
//   TEST_ADDRESS=5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9

const BRIDGE = process.env.BRIDGE_URL;
const CYRE_API = process.env.CYRE_API || "https://cyre.dev/api/address";
const TEST_ADDRESS = process.env.TEST_ADDRESS || "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9";
const BRIDGE_ORIGIN = BRIDGE ? BRIDGE.replace(/\/mcp\/.*$/, "") : "";

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function ok(msg) {
  console.log("OK:", msg);
}

async function callTool(name, args) {
  const res = await fetch(BRIDGE, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name, arguments: args || {} },
    }),
  });
  const raw = await res.text();
  let payload = raw;
  if (raw.startsWith("event:") || raw.includes("\ndata:")) {
    const m = raw.match(/data:\s*(\{[\s\S]*\})/);
    if (m) payload = m[1];
  }
  let j;
  try {
    j = JSON.parse(payload);
  } catch {
    throw new Error("bridge non-JSON: " + raw.slice(0, 200));
  }
  if (j.error) throw new Error("bridge error: " + JSON.stringify(j.error).slice(0, 300));
  const c = j.result && j.result.content;
  const text = Array.isArray(c) ? c.map((b) => b.text || "").join("\n") : "";
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

(async () => {
  console.log("[bot-smoke] CYRE Guardian bot stack check\n");

  if (!BRIDGE) fail("Set BRIDGE_URL (https://cyre-x-bridge.onrender.com/mcp/<secret>)");

  if (BRIDGE_ORIGIN) {
    try {
      const hres = await fetch(BRIDGE_ORIGIN + "/health");
      const h = await hres.json();
      if (!h.ok) fail("bridge /health: " + JSON.stringify(h));
      ok("bridge health — " + (h.xAuth || "connected"));
    } catch (e) {
      fail("bridge /health unreachable: " + e.message);
    }
  }

  let verify;
  try {
    verify = await callTool("verify_connection", {});
  } catch (e) {
    fail("verify_connection: " + e.message);
  }
  if (typeof verify === "string" && verify.startsWith("Connected as @")) ok(verify);
  else fail("verify_connection unexpected: " + JSON.stringify(verify).slice(0, 200));

  let mentions;
  try {
    mentions = await callTool("get_mentions", { max_results: 5 });
  } catch (e) {
    fail("get_mentions: " + e.message);
  }
  ok("get_mentions returned (" + (typeof mentions === "string" ? mentions.split("\n").length : 0) + " lines)");

  const gradeRes = await fetch(CYRE_API + "?address=" + encodeURIComponent(TEST_ADDRESS));
  const grade = await gradeRes.json();
  if (!grade || !grade.ok) fail("CYRE API grade failed: " + JSON.stringify(grade).slice(0, 200));
  ok("CYRE API grade — score " + grade.score + ", risk " + grade.riskLevel);

  console.log("\n[bot-smoke] all checks passed. To go live on Render:");
  console.log("  1. guardian-mention-grader: set DRY_RUN=false (keep BRIDGE_URL)");
  console.log("  2. optional: BRAIN=true + ANTHROPIC_API_KEY on mention-grader");
  console.log("  3. guardian-watcher: set WATCHLIST + DRY_RUN=false when ready");
  console.log("  Posting remains founder-approval-gated per SPEC §2.");
})();
