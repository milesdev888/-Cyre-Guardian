// api/verify-page.js — server-rendered verify UI with twitter:card / og tags from LIVE check.
// Rewritten from /verify so crawlers see OG without JS.

import { getBadgeBySerial, normalizeSerial } from './_badge-registry.js';
import { formatUtc, formatVerifiedOgTitle } from './_badge-og-render.js';
import { withOgArtRev } from './_og-art-rev.js';

const SITE = process.env.GUARDIAN_SITE_URL || 'https://cyre.dev';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  const serialRaw = String((req.query && req.query.serial) || '').trim();
  const serial = normalizeSerial(serialRaw) || '';
  const badge = serial ? await getBadgeBySerial(serial) : null;

  // 1200×630 verify OG card — crawlers must see this in SSR HTML (no JS).
  // Full-res seal remains at /api/seal/<serial>.png; seal OG at /api/seal/<serial>/og.png.
  // `r=` busts X/Telegram caches when seal/card art changes (see api/_og-art-rev.js).
  const ogImage = withOgArtRev(
    serial
      ? `${SITE}/api/verify/${encodeURIComponent(serial)}/og.png`
      : `${SITE}/brand/guardian-og-1200x630.jpg`
  );
  const title = badge
    ? formatVerifiedOgTitle({
        name: badge.name,
        symbol: badge.symbol,
        serial: badge.serial
      })
    : 'Guardian badge verify';
  const desc = badge
    ? `${badge.symbol ? '$' + badge.symbol + ' · ' : ''}Path ${badge.pathLabel || badge.qualifyPath || '—'} · issued ${badge.issuedAt ? formatUtc(badge.issuedAt) : ''} · live re-check on view`
    : 'Look up a Guardian badge serial and run a live qualifying-path re-check.';

  const canonical = serial ? `${SITE}/verify/${serial}` : `${SITE}/verify`;
  const ogAlt = badge
    ? `${title} · ${badge.status || 'VALID'} — checkable at cyre.dev/verify`
    : 'Guardian badge verify — checkable at cyre.dev/verify';
  const ogW = '1200';
  const ogH = '630';

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Guardian">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:width" content="${ogW}">
<meta property="og:image:height" content="${ogH}">
<meta property="og:image:alt" content="${esc(ogAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/theme-guardian.css?v=gf1">
<style>
  :root {
    --ink: #0b1210; --panel: #121a16; --line: #243028; --gold: #c9a227;
    --live: #3ddc84; --bad: #d96a5e; --warn: #d4a017; --text: #e7efe8; --dim: #8a9a90;
  }
  * { box-sizing: border-box; margin: 0; }
  body {
    min-height: 100vh;
    background:
      radial-gradient(1200px 600px at 20% -10%, rgba(61, 220, 132, 0.12), transparent 55%),
      radial-gradient(900px 500px at 90% 10%, rgba(201, 162, 39, 0.1), transparent 50%),
      linear-gradient(160deg, #0b1210 0%, #101816 45%, #0c1411 100%);
    color: var(--text);
    font: 400 16px/1.55 "IBM Plex Sans", system-ui, sans-serif;
    padding: 40px 20px 72px;
  }
  .wrap { max-width: 720px; margin: 0 auto; }
  .brand { font: 700 34px/1.1 "Cormorant Garamond", Georgia, serif; color: var(--gold); }
  h1 { font: 600 22px/1.25 "Cormorant Garamond", Georgia, serif; margin: 18px 0 8px; }
  .sub { color: var(--dim); margin-bottom: 28px; }
  /* In-flow layout: form | seal side-by-side when room; wraps below when not.
     Flex-wrap (not absolute) so intermediate widths never overlap controls. */
  .verify-layout {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 20px 28px;
  }
  .verify-form {
    flex: 1 1 280px;
    min-width: 0;
  }
  .seal-slot {
    flex: 0 0 auto;
    /* When the seal wraps onto its own row, center it under the form */
    margin-inline: auto;
    background: transparent;
  }
  .seal-slot:has(#seal[hidden]) { display: none; }
  label { display: block; font-size: 13px; color: var(--dim); margin-bottom: 8px; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; }
  input {
    flex: 1 1 220px; background: var(--panel); border: 1px solid var(--line); color: var(--text);
    font: 500 15px/1.4 "IBM Plex Mono", ui-monospace, monospace; padding: 12px 14px; border-radius: 8px;
  }
  button {
    background: var(--gold); color: var(--ink); border: 0;
    font: 600 14px/1 "IBM Plex Sans", system-ui, sans-serif; padding: 12px 18px; border-radius: 8px; cursor: pointer;
  }
  button:disabled { opacity: 0.5; cursor: default; }
  .card { margin-top: 28px; padding: 20px 0 0; border-top: 1px solid var(--line); }
  .status { font: 600 15px/1.3 "IBM Plex Sans", system-ui, sans-serif; }
  .status.ok { color: var(--live); } .status.bad { color: var(--bad); } .status.warn { color: var(--warn); }
  .mono { font-family: "IBM Plex Mono", ui-monospace, monospace; word-break: break-all; }
  .meta { margin-top: 14px; color: var(--dim); font-size: 14px; }
  .meta div { margin: 6px 0; } .meta b { color: var(--text); font-weight: 600; }
  .live-box {
    margin-top: 18px; padding: 14px 16px; border: 1px solid var(--line);
    border-radius: 10px; background: rgba(18, 26, 22, 0.85);
  }
  .live-box h2 { font: 600 14px/1.3 "IBM Plex Sans", system-ui, sans-serif; margin-bottom: 8px; }
  .pulse { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--live); margin-right: 8px; vertical-align: middle; animation: blink 1.2s ease-in-out infinite; }
  .pulse.off { background: var(--dim); animation: none; } .pulse.bad { background: var(--bad); }
  @keyframes blink { 50% { opacity: 0.35; } }
  @media (prefers-reduced-motion: reduce) { .pulse { animation: none; } }
  /* Dime-sized seal mark — ornament only; phone scan uses .qr-plate. */
  .seal {
    display: block;
    width: min(88px, 18vw);
    max-width: 88px;
    height: auto;
    aspect-ratio: 1;
    object-fit: contain;
    background: transparent !important;
    border: 0 !important;
    border-radius: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    outline: 0;
    filter: drop-shadow(0 4px 10px rgba(0,0,0,.4));
  }
  .seal.revoked { filter: grayscale(1) drop-shadow(0 4px 10px rgba(0,0,0,.4)); opacity: .85; }
  .qr-plate {
    display: block;
    margin-top: 14px;
    width: min(200px, 52vw);
    max-width: 200px;
    height: auto;
    aspect-ratio: 1;
    object-fit: contain;
    background: #fff;
    border: 0;
    border-radius: 0;
    padding: 0;
    image-rendering: pixelated;
  }
  .qr-plate[hidden] { display: none; }
  .qr-caption {
    margin-top: 8px;
    font: 600 12px/1.3 "IBM Plex Sans", system-ui, sans-serif;
    color: var(--gold);
    letter-spacing: 0.04em;
  }
  .qr-caption[hidden] { display: none; }
  .path-pill {
    display: inline-block; margin-top: 8px; padding: 4px 10px; border-radius: 999px;
    border: 1px solid var(--gold); color: var(--gold); font-size: 12px; font-weight: 600;
  }
  .vintage {
    margin-top: 14px; font: 700 28px/1.15 "Cormorant Garamond", Georgia, serif; color: var(--gold);
  }
  .vintage span { display: block; font: 500 14px/1.4 "IBM Plex Sans", system-ui, sans-serif; color: var(--dim); margin-top: 4px; font-weight: 500; }
  a { color: var(--gold); }
  .tiny { margin-top: 36px; color: var(--dim); font-size: 13px; }
  .stamp {
    display: none; margin-top: 12px; padding: 8px 14px; background: rgba(180,40,40,.9);
    color: #ffe8e4; font: 700 14px/1 "IBM Plex Sans", system-ui, sans-serif; letter-spacing: .08em;
    transform: rotate(-6deg); width: fit-content;
  }
  .stamp.on { display: inline-block; }
  .share-row { margin-top: 18px; display: flex; flex-wrap: wrap; gap: 10px; }
  a.share-x {
    display: inline-flex; align-items: center; gap: 8px;
    background: transparent; color: var(--gold); border: 1px solid var(--gold);
    font: 600 14px/1 "IBM Plex Sans", system-ui, sans-serif; padding: 11px 16px; border-radius: 8px;
    text-decoration: none;
  }
  a.share-x:hover { background: rgba(201, 162, 39, 0.12); }
  a.share-x[hidden] { display: none; }
</style>
</head>
<body>
  <div class="wrap">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap">
      <div class="brand">Guardian</div>
      <nav style="display:flex;gap:14px;font-size:14px;color:var(--dim)" aria-label="Primary">
        <a href="/builders" style="color:var(--gold);text-decoration:none">Builders</a>
        <a href="/order" style="color:var(--gold);text-decoration:none">Get Verified</a>
        <a href="/" style="color:var(--dim);text-decoration:none">Home</a>
      </nav>
    </div>
    <h1>Badge verify</h1>
    <p class="sub">Issued path + live qualifying-path re-check. Dates in UTC.</p>
    <div class="verify-layout">
      <div class="verify-form">
        <label for="serial">Serial</label>
        <div class="row">
          <input id="serial" name="serial" spellcheck="false" autocomplete="off" placeholder="GRD-2026-00001" value="${esc(serial)}" />
          <button id="go" type="button">Verify</button>
        </div>
      </div>
      <div class="seal-slot">
        <img id="seal" class="seal" alt="Guardian Verified seal" width="88" height="88" hidden />
        <img id="qr" class="qr-plate" alt="Scan to verify" width="200" height="200" hidden />
        <div id="qrCap" class="qr-caption" hidden>Scan to verify</div>
      </div>
    </div>
    <div class="card" id="out" hidden>
      <div class="status" id="status"></div>
      <div class="path-pill" id="pathPill" hidden></div>
      <div class="vintage" id="vintage" hidden></div>
      <div class="stamp" id="stamp">REVOKED</div>
      <div class="meta" id="meta"></div>
      <div class="live-box" id="liveBox" hidden>
        <h2><span class="pulse" id="livePulse"></span>Live re-check</h2>
        <div class="meta" id="liveMeta"></div>
      </div>
      <div class="share-row">
        <a id="shareX" class="share-x" href="#" target="_blank" rel="noopener noreferrer" hidden>Share on X</a>
      </div>
    </div>
    <p class="tiny">Two equal paths: Secured (Lifetime / Timed locks) · Established (Battle-Tested — age, pools, decentralization). Age alone never qualifies.</p>
  </div>
<script>
(function () {
  var SITE = ${JSON.stringify(SITE)};
  var input = document.getElementById('serial');
  var go = document.getElementById('go');
  var out = document.getElementById('out');
  var status = document.getElementById('status');
  var meta = document.getElementById('meta');
  var liveBox = document.getElementById('liveBox');
  var liveMeta = document.getElementById('liveMeta');
  var livePulse = document.getElementById('livePulse');
  var pathPill = document.getElementById('pathPill');
  var vintage = document.getElementById('vintage');
  var stamp = document.getElementById('stamp');
  var seal = document.getElementById('seal');
  var qr = document.getElementById('qr');
  var qrCap = document.getElementById('qrCap');
  var shareX = document.getElementById('shareX');
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function fmtUsd(n) {
    if (n == null || !isFinite(n)) return '—';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function setBusy(b) { go.disabled = b; go.textContent = b ? 'Checking…' : 'Verify'; }
  function setShare(serial, badge) {
    if (!serial || !badge) { shareX.hidden = true; shareX.removeAttribute('href'); return; }
    var verifyUrl = SITE + '/verify/' + encodeURIComponent(serial);
    var path = badge.pathLabel || badge.qualifyPath || 'Badge';
    var text = 'Guardian ' + path + ' · ' + serial + '\\n' + verifyUrl;
    shareX.href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
    shareX.hidden = false;
  }
  async function verify(raw) {
    var serial = String(raw || '').trim().toUpperCase();
    if (!serial) return;
    input.value = serial;
    out.hidden = false; liveBox.hidden = true; stamp.classList.remove('on'); seal.hidden = true;
    if (qr) qr.hidden = true; if (qrCap) qrCap.hidden = true;
    pathPill.hidden = true; vintage.hidden = true; vintage.innerHTML = '';
    shareX.hidden = true;
    status.className = 'status'; status.textContent = 'Looking up serial…';
    meta.innerHTML = ''; liveMeta.innerHTML = ''; livePulse.className = 'pulse'; setBusy(true);
    try {
      var r = await fetch('/api/badge/verify?serial=' + encodeURIComponent(serial), { headers: { accept: 'application/json' }, cache: 'no-store' });
      var j = await r.json();
      if (!j.badge) {
        status.className = 'status bad'; status.textContent = j.error || 'Serial not found'; livePulse.className = 'pulse bad'; return;
      }
      var b = j.badge;
      var st = j.status || (j.valid ? 'VALID' : 'INVALID');
      status.className = 'status ' + (st === 'VALID' ? 'ok' : 'bad');
      status.textContent = st === 'VALID' ? 'Issued serial · VALID' : ('Issued serial · ' + st);
      if (st === 'REVOKED') stamp.classList.add('on');
      var pathText = b.pathLabel || b.qualifyPath || '—';
      var established = b.pathFamily === 'established';
      pathPill.hidden = false;
      pathPill.textContent = established
        ? 'Path earned: Established (Battle-Tested)'
        : ('Path earned: ' + pathText + (b.pathFamily === 'secured' ? ' (Secured)' : ''));
      seal.hidden = false;
      // Dime UI seal (no QR) + separate phone-scannable plate (≥5px/module).
      seal.src = j.sealUrlUi || ('/api/seal/' + encodeURIComponent(b.serial) + '/ui.png');
      seal.className = 'seal' + (st === 'VALID' ? '' : ' revoked');
      if (qr) {
        qr.hidden = false;
        qr.src = j.qrUrl || ('/api/seal/' + encodeURIComponent(b.serial) + '/qr.png');
      }
      if (qrCap) qrCap.hidden = false;
      setShare(b.serial, b);
      var live = j.live;
      var est = (live && live.established) || b.established || null;
      if (established) {
        var ageDays = est && est.ageDays != null ? est.ageDays : null;
        var years = ageDays != null ? Math.max(1, Math.floor(ageDays / 365)) : null;
        var sinceYear = ageDays != null ? (new Date().getUTCFullYear() - years) : null;
        if (years != null) {
          vintage.hidden = false;
          vintage.innerHTML = 'On-chain since ' + esc(sinceYear) + ' · ' + esc(years) + ' year' + (years === 1 ? '' : 's') +
            '<span>Battle-tested · decentralized liquidity</span>';
        }
        var liq = est && est.totalLiquidityUsd != null ? fmtUsd(est.totalLiquidityUsd) : '—';
        var pools = est && est.poolCount != null ? est.poolCount : '—';
        meta.innerHTML =
          '<div><b>Serial</b> <span class="mono">' + esc(b.serial) + '</span></div>' +
          '<div><b>Mint</b> <span class="mono">' + esc(b.mint) + '</span></div>' +
          '<div><b>Verified age</b> ' + (years != null ? (esc(years) + ' years on-chain') : '—') + '</div>' +
          '<div><b>Liquidity</b> ' + esc(liq) + ' across ' + esc(pools) + ' independent pools — no single pool majority</div>' +
          '<div><b>Decentralization</b> No single party can pull this token\\'s liquidity.</div>' +
          '<div><b>Authorities</b> mint revoked, freeze revoked' + (sinceYear ? (' — revoked since ' + esc(sinceYear)) : '') + '</div>' +
          '<div><b>Clean history</b> no revocations, no fraud flags on record</div>' +
          '<div><b>Grade at issue</b> ' + esc(b.grade || '—') + (b.score != null ? ' · ' + esc(b.score) : '') + '</div>' +
          '<div><b>Issued (UTC)</b> ' + esc(b.issuedAtUtc || b.issuedAt || '—') + '</div>' +
          (b.scanUrl ? '<div><a href="' + esc(b.scanUrl) + '">Open scan</a></div>' : '');
      } else {
        meta.innerHTML =
          '<div><b>Serial</b> <span class="mono">' + esc(b.serial) + '</span></div>' +
          '<div><b>Mint</b> <span class="mono">' + esc(b.mint) + '</span></div>' +
          '<div><b>Path</b> ' + esc(pathText) + '</div>' +
          '<div><b>Grade at issue</b> ' + esc(b.grade || '—') + (b.score != null ? ' · ' + esc(b.score) : '') + '</div>' +
          '<div><b>LP tier at issue</b> ' + esc(b.lpTier || '—') + '</div>' +
          '<div><b>Issued (UTC)</b> ' + esc(b.issuedAtUtc || b.issuedAt || '—') + '</div>' +
          (b.expiresAt ? '<div><b>Expires (UTC)</b> ' + esc(b.expiresAt) + '</div>' : '') +
          (b.scanUrl ? '<div><a href="' + esc(b.scanUrl) + '">Open scan</a></div>' : '');
      }

      liveBox.hidden = false;
      if (!live) { livePulse.className = 'pulse off'; liveMeta.innerHTML = '<div>Live re-check skipped.</div>'; return; }
      if (!live.ok) { livePulse.className = 'pulse bad'; liveMeta.innerHTML = '<div class="status bad">Re-check failed — ' + esc(live.error || 'error') + '</div>'; return; }
      if (live.eligible) {
        livePulse.className = 'pulse';
        if (established || live.pathFamily === 'established') {
          var le = live.established || {};
          liveMeta.innerHTML =
            '<div class="status ok">Still qualifies · Established path</div>' +
            '<div><b>Live grade</b> ' + esc(live.grade || '—') + (live.score != null ? ' · ' + esc(live.score) : '') + '</div>' +
            '<div><b>Liquidity</b> ' + esc(fmtUsd(le.totalLiquidityUsd)) + ' · ' + esc(le.poolCount != null ? le.poolCount : '—') + ' pools</div>' +
            '<div><b>Checked (UTC)</b> ' + esc(live.scannedAtUtc || live.scannedAt || '—') + '</div>' +
            (live.scanUrl ? '<div><a href="' + esc(live.scanUrl) + '">Fresh scan</a></div>' : '');
        } else {
          liveMeta.innerHTML =
            '<div class="status ok">Still qualifies · ' + esc(live.pathLabel || live.path) + ' path</div>' +
            '<div><b>Live grade</b> ' + esc(live.grade || '—') + (live.score != null ? ' · ' + esc(live.score) : '') + '</div>' +
            '<div><b>Live LP</b> ' + esc(live.lpTier || '—') + '</div>' +
            '<div><b>Checked (UTC)</b> ' + esc(live.scannedAtUtc || live.scannedAt || '—') + '</div>' +
            '<div><b>Reason</b> ' + esc(live.reason || '') + '</div>' +
            (live.scanUrl ? '<div><a href="' + esc(live.scanUrl) + '">Fresh scan</a></div>' : '');
        }
      } else {
        livePulse.className = 'pulse bad';
        liveMeta.innerHTML =
          '<div class="status warn">No longer qualifies — badge REVOKED</div>' +
          '<div><b>Reason</b> ' + esc(live.reason || 'not eligible') + '</div>' +
          '<div><b>Checked (UTC)</b> ' + esc(live.scannedAtUtc || live.scannedAt || '—') + '</div>' +
          (live.scanUrl ? '<div><a href="' + esc(live.scanUrl) + '">Fresh scan</a></div>' : '');
      }
    } catch (e) {
      status.className = 'status bad'; status.textContent = 'Verify failed'; livePulse.className = 'pulse bad';
    } finally { setBusy(false); }
  }
  go.addEventListener('click', function () { verify(input.value); });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') verify(input.value); });
  if (input.value) verify(input.value);
})();
</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).end(html);
}
