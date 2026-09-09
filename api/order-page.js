// api/order-page.js — Checkout + order-status UI for paid Guardian Verified.
// /order?mint=… creates (via API) when qualifying; /order/:id shows status + both payment lanes.
// Footer disclaimer; locked vocabulary; no investment-speak.

import { resolveOrder, publicOrderView, USDC_USD, C7_USD, applyExpiry } from './_badge-order.js';

const SITE = process.env.GUARDIAN_SITE_URL || 'https://cyre.dev';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  const q = req.query || {};
  const orderId = String(q.id || q.order || '').trim().toUpperCase();
  const mintParam = String(q.mint || '').trim();
  const tokenParam = String(q.token || '').trim();
  let order = null;
  if (orderId || tokenParam) {
    order = await resolveOrder({ id: orderId, token: tokenParam });
    if (order) order = applyExpiry(order);
  }

  const title = order
    ? `Order ${order.id} · Guardian Verified`
    : 'Get Guardian Verified · Checkout';
  const desc = `Pay $${USDC_USD} USDC on Base or $${C7_USD} in $C7 on Solana. Amounts locked 30 minutes. Founder brand-safety approval required after payment.`;

  const boot = order ? publicOrderView(order) : { mint: mintParam || null };

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(order ? SITE + '/order/' + order.id : SITE + '/order')}">
<link rel="icon" href="/c7-cobra-256.png?v=c7g2" type="image/png">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{--ink:#0b1210;--panel:#121a16;--line:#243028;--gold:#c9a227;--live:#3ddc84;--bad:#d96a5e;--text:#e7efe8;--dim:#8a9a90}
*{box-sizing:border-box;margin:0}
body{min-height:100vh;background:radial-gradient(1200px 600px at 50% -10%,rgba(201,162,39,.12),transparent 55%),linear-gradient(180deg,#0b1210,#0a100e 40%,#0b1210);color:var(--text);font:400 15px/1.55 "IBM Plex Sans",system-ui,sans-serif}
a{color:var(--gold)}
.wrap{max-width:720px;margin:0 auto;padding:28px 18px 64px}
nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;font-size:14px}
.brand{font-family:"Cormorant Garamond",serif;font-weight:700;font-size:22px;color:var(--text);text-decoration:none}
.brand span{color:var(--gold)}
h1{font-family:"Cormorant Garamond",serif;font-weight:700;font-size:clamp(26px,5vw,36px);line-height:1.15;margin:8px 0 10px}
.sub{color:var(--dim);max-width:540px}
.cta-line{margin-top:18px;font-family:"IBM Plex Mono",monospace;font-size:14px;color:var(--gold);letter-spacing:.02em}
.panel{margin-top:22px;padding:18px 16px;background:rgba(18,26,22,.92);border:1px solid var(--line);border-radius:10px}
.panel h2{font-family:"IBM Plex Mono",monospace;font-size:12px;letter-spacing:.1em;color:var(--gold);margin-bottom:12px}
.row{display:flex;flex-wrap:wrap;gap:10px 18px;margin:6px 0;font-size:14px}
.row b{color:var(--dim);font-weight:500;min-width:110px}
.mono{font-family:"IBM Plex Mono",monospace;font-size:13px;word-break:break-all}
.lanes{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
@media(max-width:640px){.lanes{grid-template-columns:1fr}}
.lane{padding:14px;border:1px solid var(--line);border-radius:8px;background:rgba(10,16,14,.65)}
.lane h3{font-family:"IBM Plex Mono",monospace;font-size:12px;letter-spacing:.08em;color:var(--gold);margin-bottom:8px}
.lane .amt{font-size:22px;font-weight:600;margin:4px 0 8px}
.lane .amt span{font-size:13px;color:var(--dim);font-weight:500}
.lane p{font-size:13px;color:var(--dim);line-height:1.5}
.btn{display:inline-flex;align-items:center;justify-content:center;margin-top:14px;padding:12px 18px;border-radius:8px;border:0;background:var(--gold);color:var(--ink);font:600 14px/1 "IBM Plex Sans",system-ui,sans-serif;cursor:pointer}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn-ghost{background:transparent;color:var(--gold);border:1px solid rgba(201,162,39,.45);margin-left:8px}
.status{display:inline-block;padding:3px 10px;border-radius:999px;border:1px solid var(--line);font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.06em}
.status.live{border-color:rgba(61,220,132,.45);color:var(--live)}
.status.wait{border-color:rgba(201,162,39,.45);color:var(--gold)}
.status.bad{border-color:rgba(217,106,94,.45);color:var(--bad)}
.copy{cursor:pointer;text-decoration:underline;text-underline-offset:2px}
#msg{margin-top:14px;color:var(--dim);font-size:13.5px;min-height:1.2em}
.issued a{display:inline-block;margin-top:8px;margin-right:12px}
footer{margin-top:36px;padding-top:18px;border-top:1px solid var(--line);color:var(--dim);font-size:12.5px;line-height:1.65}
.lock-note{margin-top:10px;font-size:12.5px;color:var(--dim)}
</style>
</head>
<body>
<div class="wrap">
  <nav>
    <a class="brand" href="/">Guardian <span>Verified</span></a>
    <a href="/verify">Verify</a>
  </nav>
  <p class="cta-line" id="cta">Get Guardian Verified — $${USDC_USD} USDC or $${C7_USD} in $C7.</p>
  <h1 id="heading">${order ? esc(order.id) : 'Checkout'}</h1>
  <p class="sub" id="sub">${
    order
      ? 'Amounts are locked for 30 minutes. Pay from any wallet — no wallet-connect. After payment, the order enters founder brand-safety approval before a serial is issued.'
      : 'Enter a mint that already passed Guardian qualifying-path gates on a live scan. Non-qualifying tokens cannot open checkout.'
  }</p>

  <div class="panel" id="startPanel" style="${order ? 'display:none' : ''}">
    <h2>MINT</h2>
    <input id="mintInput" class="mono" style="width:100%;padding:12px 14px;border-radius:8px;border:1px solid var(--line);background:#0a100e;color:var(--text)" placeholder="Token mint address" value="${esc(mintParam)}" />
    <button class="btn" id="startBtn" type="button">Create locked order</button>
    <p class="lock-note">Price and $C7 amount lock for 30 minutes at order creation. Unpaid orders expire.</p>
  </div>

  <div class="panel" id="orderPanel" style="${order ? '' : 'display:none'}">
    <h2>ORDER</h2>
    <div class="row"><b>Status</b> <span class="status wait" id="statusPill">${esc(order ? order.status : '')}</span></div>
    <div class="row"><b>Mint</b> <span class="mono" id="mintOut">${esc(order ? order.mint : '')}</span></div>
    <div class="row"><b>Token</b> <span id="tokenOut">${esc(order ? [order.name, order.symbol && '$' + order.symbol].filter(Boolean).join(' · ') : '')}</span></div>
    <div class="row"><b>Path</b> <span id="pathOut">${esc(order && order.qualifySnapshot ? order.qualifySnapshot.pathLabel || order.qualifySnapshot.path : '')}</span></div>
    <div class="row"><b>Locked until</b> <span class="mono" id="lockOut">${esc(order ? order.expiresAt : '')}</span></div>

    <div class="lanes" id="lanes">
      <div class="lane" id="laneUsdc">
        <h3>LANE A · USDC ON BASE</h3>
        <div class="amt" id="usdcAmt">— <span>USDC</span></div>
        <p>Send the <b>exact</b> locked amount (unique cent-amount) to the Base treasury from any wallet.</p>
        <p class="mono"><span class="copy" data-copy-id="usdcTo" id="usdcTo">—</span></p>
        <p class="mono">Amount: <span class="copy" data-copy-id="usdcDisplay" id="usdcDisplay">—</span></p>
      </div>
      <div class="lane" id="laneC7">
        <h3>LANE B · $C7 ON SOLANA</h3>
        <div class="amt" id="c7Amt">— <span>$C7</span></div>
        <p>Send the locked $C7 amount (≈ $${C7_USD} at order time) with the Solana Pay reference for exact matching. Recorded in the burn ledger · burned weekly.</p>
        <p class="mono">Treasury: <span class="copy" data-copy-id="c7To" id="c7To">—</span></p>
        <p class="mono">Amount: <span class="copy" data-copy-id="c7Display" id="c7Display">—</span></p>
        <p class="mono">Reference: <span class="copy" data-copy-id="c7Ref" id="c7Ref">—</span></p>
      </div>
    </div>

    <button class="btn" id="watchBtn" type="button">I paid — check matching</button>
    <button class="btn btn-ghost" id="refreshBtn" type="button">Refresh status</button>

    <div class="issued" id="issuedBox" style="display:none;margin-top:16px">
      <p>Serial issued. Your links:</p>
      <a id="verifyLink" href="#">Verify page</a>
      <a id="sealLink" href="#">Seal PNG</a>
      <div style="margin-top:14px">
        <a class="btn" id="shareSealBtn" href="#" target="_blank" rel="noreferrer">Share your seal on X</a>
      </div>
    </div>
  </div>

  <p id="msg"></p>

  <footer>
    Guardian Verified is a measured qualifying-path seal with live re-check — patterns and lock evidence, not investment advice.
    Digital assets are volatile. Payment locks an amount for matching only; it does not guarantee issuance.
    Founder brand-safety approval is required after payment. Unpaid orders expire after 30 minutes.
    $C7 payments are recorded in the burn ledger and burned weekly (tx published).
    Verify serials only at cyre.dev/verify. Comp issuance uses a separate registry path and never appears as a paid order.
  </footer>
</div>
<script>
(function(){
  var boot = ${JSON.stringify(boot)};
  var msg = document.getElementById('msg');
  function setMsg(t, bad){ msg.textContent = t || ''; msg.style.color = bad ? 'var(--bad)' : 'var(--dim)'; }
  function pillClass(st){
    if (st === 'ISSUED' || st === 'PENDING_FOUNDER_APPROVAL' || st === 'PAID') return 'status live';
    if (st === 'EXPIRED' || st === 'REJECTED' || st === 'QUALIFY_LOST' || st === 'REFUNDED') return 'status bad';
    return 'status wait';
  }
  function render(o){
    if (!o || !o.id) return;
    document.getElementById('startPanel').style.display = 'none';
    document.getElementById('orderPanel').style.display = '';
    document.getElementById('heading').textContent = o.id;
    var st = o.status || '';
    var pill = document.getElementById('statusPill');
    pill.textContent = st;
    pill.className = pillClass(st);
    document.getElementById('mintOut').textContent = o.mint || '';
    document.getElementById('tokenOut').textContent = [o.name, o.symbol ? ('$'+o.symbol) : ''].filter(Boolean).join(' · ');
    document.getElementById('pathOut').textContent = (o.qualifySnapshot && (o.qualifySnapshot.pathLabel || o.qualifySnapshot.path)) || '';
    document.getElementById('lockOut').textContent = o.expiresAt || (o.locked && o.locked.lockedUntil) || '';
    var usdc = o.payment && o.payment.usdcBase;
    var c7 = o.payment && o.payment.c7Solana;
    if (usdc){
      document.getElementById('usdcAmt').innerHTML = (usdc.amountDisplay || '') + ' <span>USDC</span>';
      document.getElementById('usdcTo').textContent = usdc.to || '';
      document.getElementById('usdcDisplay').textContent = usdc.amountDisplay || '';
    }
    if (c7){
      document.getElementById('c7Amt').innerHTML = (c7.amountDisplay || '') + ' <span>$C7</span>';
      document.getElementById('c7To').textContent = c7.to || '';
      document.getElementById('c7Display').textContent = c7.amountDisplay || '';
      document.getElementById('c7Ref').textContent = c7.reference || '';
    }
    var awaiting = st === 'AWAITING_PAYMENT';
    document.getElementById('lanes').style.opacity = awaiting ? '1' : '.55';
    document.getElementById('watchBtn').disabled = !awaiting;
    if (o.issuance && o.issuance.serial){
      document.getElementById('issuedBox').style.display = '';
      var vUrl = o.issuance.verifyUrl || ('https://cyre.dev/verify/' + o.issuance.serial);
      document.getElementById('verifyLink').href = vUrl;
      document.getElementById('verifyLink').textContent = 'Verify · ' + o.issuance.serial;
      document.getElementById('sealLink').href = o.issuance.sealUrl || ('/api/seal/' + o.issuance.serial + '.png');
      var shareText = 'Guardian Verified · ' + o.issuance.serial + '\\n' + vUrl;
      document.getElementById('shareSealBtn').href =
        'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText);
    }
    if (o.id && location.pathname.indexOf(o.id) < 0){
      try { history.replaceState(null, '', '/order/' + o.id); } catch (e) {}
    }
  }
  async function createOrder(){
    var mint = (document.getElementById('mintInput').value || '').trim();
    if (!mint){ setMsg('Mint required.', true); return; }
    setMsg('Checking qualifying-path gates…');
    document.getElementById('startBtn').disabled = true;
    try {
      var r = await fetch('/api/badge/order', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ mint: mint })
      });
      var j = await r.json();
      if (!r.ok){
        setMsg(j.error || j.detail || 'Checkout unavailable for this mint.', true);
        document.getElementById('startBtn').disabled = false;
        return;
      }
      setMsg('Order locked for 30 minutes.');
      boot = j;
      if (j.token) {
        try { history.replaceState(null, '', '/order/' + j.id + '?token=' + encodeURIComponent(j.token)); } catch (e) {}
      }
      render(j);
    } catch (e){
      setMsg('Could not create order.', true);
      document.getElementById('startBtn').disabled = false;
    }
  }
  async function ensureToken(id){
    if (boot.token) return boot.token;
    if (!id) return null;
    try {
      var r = await fetch('/api/badge/order?id=' + encodeURIComponent(id), { headers: { accept: 'application/json' } });
      var j = await r.json();
      if (r.ok && j.token){ boot = j; return j.token; }
    } catch (e) {}
    return null;
  }
  async function refresh(){
    if (!boot.id && !(document.getElementById('mintOut').textContent)) return;
    var id = boot.id || document.getElementById('heading').textContent;
    var q = '/api/badge/order?id=' + encodeURIComponent(id);
    if (boot.token) q += '&token=' + encodeURIComponent(boot.token);
    var r = await fetch(q, { headers: { accept: 'application/json' } });
    var j = await r.json();
    if (r.ok){ boot = j; render(j); setMsg('Status refreshed.'); }
  }
  async function watch(){
    var id = boot.id || document.getElementById('heading').textContent;
    setMsg('Watching for matching transfer…');
    var tok = await ensureToken(id);
    var r = await fetch('/api/badge/order/watch', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ orderId: id, token: tok || boot.token || null })
    });
    var j = await r.json();
    if (j.order){ boot = j.order; render(j.order); }
    if (!j.ok && j.needToken){
      setMsg(j.error || 'Order not registered in watcher — reopen checkout from the create response (signed token).', true);
      return;
    }
    var hit = (j.results || []).find(function(x){ return x.matched; });
    if (hit && hit.accepted) setMsg('Payment matched · queued for founder approval.');
    else if (hit && !hit.accepted) setMsg(hit.reason || 'Payment seen but mint no longer qualifies — refund path.', true);
    else if (j.watched === 0 && !j.order) setMsg(j.error || 'Watcher could not load this order. Refresh status, then check matching again.', true);
    else setMsg('No matching transfer yet. Pay the exact locked amount, then check again.');
  }
  document.getElementById('startBtn').addEventListener('click', createOrder);
  document.getElementById('watchBtn').addEventListener('click', watch);
  document.getElementById('refreshBtn').addEventListener('click', refresh);
  document.querySelectorAll('.copy').forEach(function(el){
    el.addEventListener('click', function(){
      var t = el.textContent;
      if (!t || t === '—') return;
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(function(){ setMsg('Copied.'); });
    });
  });
  try {
    var qt = new URLSearchParams(location.search).get('token');
    if (qt && boot) boot.token = qt;
  } catch (e) {}
  (async function bootLoad(){
    if (boot && boot.id){ render(boot); return; }
    // Use RegExp ctor — \/ inside the outer template literal collapses to / and yields //order/… (parse error, dead page).
    var pathId = (location.pathname.match(new RegExp('/order/(ORD-[A-Za-z0-9-]+)', 'i')) || [])[1];
    if (pathId){
      var tok = await ensureToken(pathId);
      if (tok || (boot && boot.id)){ render(boot); return; }
    }
    if (boot && boot.mint){
      document.getElementById('mintInput').value = boot.mint;
    }
  })();
})();
</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(html);
}
