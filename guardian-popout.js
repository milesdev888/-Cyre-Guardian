(function () {
  'use strict';
  if (document.getElementById('gp-fab')) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var openedOnce = false;
  var panel = null;
  var fab = null;
  var video = null;
  var unmuted = false;
  var css = document.createElement('style');
  css.id = 'gp-style';
  css.textContent =
    '#gp-fab{position:fixed;right:22px;bottom:22px;z-index:9500;width:64px;height:64px;border-radius:50%;' +
    'padding:0;border:2px solid rgba(216,188,102,.55);background:#0a0f0a;cursor:pointer;overflow:visible;' +
    'box-shadow:0 0 0 2px rgba(216,188,102,.25),0 0 28px rgba(216,188,102,.4),0 0 48px rgba(216,188,102,.22);' +
    'transition:transform .2s,box-shadow .2s}' +
    '#gp-fab:hover,#gp-fab:focus-visible{transform:scale(1.05);box-shadow:0 0 0 2px rgba(216,188,102,.65),0 0 36px rgba(216,188,102,.55),0 0 60px rgba(216,188,102,.3);outline:none}' +
    '#gp-fab img{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block}' +
    '#gp-fab .gp-pulse{position:absolute;top:-2px;right:-2px;width:14px;height:14px;border-radius:50%;' +
    'background:#e6cc7e;border:2px solid #0a0f0a;box-shadow:0 0 10px rgba(216,188,102,.7)}' +
    '#gp-fab .gp-pulse::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:2px solid rgba(216,188,102,.55);' +
    'animation:gp-pulse-ring 2s ease-out infinite}' +
    '#gp-fab .gp-live{position:absolute;left:50%;bottom:-18px;transform:translateX(-50%);' +
    'font:700 9px JetBrains Mono,ui-monospace,monospace;letter-spacing:.14em;color:#d8bc66;' +
    'background:rgba(10,15,10,.85);padding:2px 7px;border-radius:999px;border:1px solid rgba(216,188,102,.35)}' +
    '@keyframes gp-pulse-ring{0%{transform:scale(.6);opacity:1}100%{transform:scale(1.6);opacity:0}}' +
    '#gp-panel{position:fixed;right:22px;bottom:100px;z-index:9501;width:min(380px,calc(100vw - 28px));' +
    'max-height:min(640px,calc(100vh - 120px));display:none;flex-direction:column;' +
    'background:rgba(10,15,10,.94);backdrop-filter:blur(20px) saturate(1.2);-webkit-backdrop-filter:blur(20px) saturate(1.2);' +
    'border:1px solid rgba(216,188,102,.28);border-radius:20px;' +
    'box-shadow:0 24px 60px -18px rgba(0,0,0,.9),0 0 32px rgba(216,188,102,.22),0 0 48px rgba(216,188,102,.12);' +
    'font-family:Inter,system-ui,sans-serif;color:#ede7d5;overflow:hidden}' +
    '#gp-panel.is-open{display:flex}' +
    '#gp-panel .gp-head{display:flex;align-items:center;justify-content:space-between;gap:10px;' +
    'padding:14px 16px;border-bottom:1px solid rgba(216,188,102,.18)}' +
    '#gp-panel .gp-head h3{margin:0;font:700 15px Cormorant Garamond,Georgia,serif;letter-spacing:.02em}' +
    '#gp-panel .gp-head h3 span{color:#d8bc66}' +
    '#gp-panel .gp-x{background:transparent;border:0;color:#97a08d;font-size:22px;line-height:1;cursor:pointer;padding:4px 8px;border-radius:8px}' +
    '#gp-panel .gp-x:hover{color:#ede7d5;background:rgba(216,188,102,.1)}' +
    '#gp-panel .gp-vid-wrap{position:relative;background:#0a0f0a;aspect-ratio:1;max-height:220px}' +
    '#gp-panel video{width:100%;height:100%;object-fit:cover;display:block;background:#0a0f0a}' +
    '#gp-panel .gp-hear{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);' +
    'font:600 12px Inter,system-ui,sans-serif;color:#0a0f0a;background:linear-gradient(135deg,#d8bc66,#e6cc7e);' +
    'border:0;border-radius:999px;padding:9px 16px;cursor:pointer;box-shadow:0 0 18px rgba(216,188,102,.4);' +
    'display:none}' +
    '#gp-panel .gp-hear.is-on{display:inline-flex}' +
    '#gp-panel .gp-chat{display:flex;flex-direction:column;flex:1;min-height:0;padding:12px 14px 14px}' +
    '#gp-panel .gp-log{flex:1;overflow-y:auto;max-height:200px;display:flex;flex-direction:column;gap:8px;margin-bottom:10px}' +
    '#gp-panel .gp-msg{padding:10px 12px;border-radius:12px;font-size:13px;line-height:1.5;max-width:95%}' +
    '#gp-panel .gp-msg.bot{background:rgba(16,23,16,.85);border:1px solid rgba(216,188,102,.18);align-self:flex-start}' +
    '#gp-panel .gp-msg.user{background:linear-gradient(135deg,rgba(216,188,102,.18),rgba(216,188,102,.14));' +
    'border:1px solid rgba(216,188,102,.28);align-self:flex-end}' +
    '#gp-panel .gp-form{display:flex;gap:8px}' +
    '#gp-panel .gp-form input{flex:1;background:rgba(13,19,13,.9);border:1px solid rgba(216,188,102,.22);' +
    'border-radius:999px;color:#ede7d5;font:400 13px Inter,system-ui,sans-serif;padding:11px 14px;outline:none}' +
    '#gp-panel .gp-form input:focus{border-color:rgba(216,188,102,.55);box-shadow:0 0 14px rgba(216,188,102,.2)}' +
    '#gp-panel .gp-form button{background:linear-gradient(135deg,#d8bc66,#e6cc7e);color:#0a0f0a;border:0;' +
    'border-radius:999px;padding:0 16px;font:700 13px Inter,system-ui,sans-serif;cursor:pointer}' +
    '#gp-panel .gp-form button:disabled{opacity:.55;cursor:wait}' +
    '@media (prefers-reduced-motion:reduce){#gp-fab .gp-pulse::after{animation:none!important}#gp-fab,#gp-panel{transition:none!important}}';
  document.head.appendChild(css);
  function addMsg(log, text, who) {
    var m = document.createElement('div');
    m.className = 'gp-msg ' + who;
    m.textContent = text;
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
  }
  function close() {
    if (!panel) return;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    if (fab) fab.setAttribute('aria-expanded', 'false');
    if (video) {
      try { video.pause(); } catch (e) {}
    }
  }
  function tryMutedAutoplay() {
    if (!video || reduce || openedOnce) return;
    openedOnce = true;
    video.muted = true;
    video.playsInline = true;
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
    var hear = panel.querySelector('.gp-hear');
    if (hear) hear.classList.add('is-on');
  }
  function unmute() {
    if (!video) return;
    unmuted = true;
    video.muted = false;
    video.play().catch(function () {});
    var hear = panel.querySelector('.gp-hear');
    if (hear) {
      hear.textContent = 'Playing';
      hear.classList.remove('is-on');
      setTimeout(function () { hear.style.display = 'none'; }, 600);
    }
  }
  function sendChat(input, btn, log) {
    var text = (input.value || '').trim();
    if (!text) return;
    input.value = '';
    addMsg(log, text, 'user');
    btn.disabled = true;
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: text }] })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('bad');
        return r.json();
      })
      .then(function (d) {
        var reply =
          (d && (d.reply || d.message || d.text || (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content))) ||
          null;
        addMsg(
          log,
          reply || "I'm watching the chain. Chat is warming up — try again shortly, or ask on the main Guardian panel.",
          'bot'
        );
      })
      .catch(function () {
        addMsg(
          log,
          "I couldn't reach the live chat just now. I'm still watching — try again in a moment, or use the Guardian panel on this page.",
          'bot'
        );
      })
      .finally(function () {
        btn.disabled = false;
        input.focus();
      });
  }
  function open() {
    if (!panel) return;
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    if (fab) fab.setAttribute('aria-expanded', 'true');
    tryMutedAutoplay();
    var input = panel.querySelector('.gp-form input');
    if (input) setTimeout(function () { input.focus(); }, 40);
  }
  function mount() {
    fab = document.createElement('button');
    fab.id = 'gp-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Open Guardian');
    fab.setAttribute('aria-expanded', 'false');
    fab.setAttribute('aria-controls', 'gp-panel');
    fab.innerHTML =
      '<img src="/guardian2.jpg" alt="" width="64" height="64">' +
      '<span class="gp-pulse" aria-hidden="true"></span>' +
      '<span class="gp-live">LIVE</span>';
    document.body.appendChild(fab);
    panel = document.createElement('aside');
    panel.id = 'gp-panel';
    panel.className = 'gp-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Guardian');
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML =
      '<div class="gp-head">' +
        '<h3>Guardian <span>LIVE</span></h3>' +
        '<button type="button" class="gp-x" aria-label="Close">\u00d7</button>' +
      '</div>' +
      '<div class="gp-vid-wrap">' +
        '<video src="/guardian-video.mp4" controls playsinline preload="metadata" title="Guardian intro"></video>' +
        '<button type="button" class="gp-hear">Unmute / Hear her</button>' +
      '</div>' +
      '<div class="gp-chat">' +
        '<div class="gp-log" aria-live="polite"></div>' +
        '<form class="gp-form" action="#">' +
          '<input type="text" name="q" autocomplete="off" maxlength="500" placeholder="Ask Guardian\u2026" aria-label="Message Guardian">' +
          '<button type="submit">Send</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(panel);
    video = panel.querySelector('video');
    var log = panel.querySelector('.gp-log');
    addMsg(log, "I'm Guardian. Ask me what I'm watching.", 'bot');
    fab.addEventListener('click', function () {
      if (panel.classList.contains('is-open')) close();
      else open();
    });
    panel.querySelector('.gp-x').addEventListener('click', close);
    panel.querySelector('.gp-hear').addEventListener('click', unmute);
    var form = panel.querySelector('.gp-form');
    var input = form.querySelector('input');
    var btn = form.querySelector('button');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      sendChat(input, btn, log);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
    document.addEventListener('click', function (e) {
      if (!panel.classList.contains('is-open')) return;
      var t = e.target;
      if (panel.contains(t) || fab.contains(t)) return;
      if (t && t.closest && t.closest('#talk-to-guardian,[data-guardian-open]')) return;
      close();
    });
    function bindTriggers() {
      document.querySelectorAll('#talk-to-guardian,[data-guardian-open]').forEach(function (btn) {
        if (btn.dataset.gpBound) return;
        btn.dataset.gpBound = '1';
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          open();
        });
      });
    }
    bindTriggers();
    window.CyreGuardianPopout = { open: open, close: close, toggle: function () {
      if (panel.classList.contains('is-open')) close();
      else open();
    }};
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
