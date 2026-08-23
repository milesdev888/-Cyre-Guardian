/* nav-tools.js — bolt-on Tools/Product dropdown + secondary-page tool strip
   Links: Watch / Check / Score / Auto / Tokenomics / Roadmap / Airdrop
   Styled by theme-ai-vibe.css (cyan/violet glass). */
(function () {
  'use strict';
  if (window.__cyAiNavTools) return;
  window.__cyAiNavTools = true;

  var LINKS = [
    { href: '/watch', label: 'Watch', hint: 'Monitor' },
    { href: '/check', label: 'Check', hint: 'Address' },
    { href: '/score', label: 'Score', hint: 'Wallet' },
    { href: '/auto', label: 'Auto', hint: 'Use case' },
    { href: '/tokenomics', label: 'Tokenomics', hint: '$C7' },
    { href: '/roadmap', label: 'Roadmap', hint: 'Plan' },
    { href: '/airdrop', label: 'Airdrop', hint: '3M' }
  ];

  function ensureTheme() {
    if (document.getElementById('cy-ai-vibe')) return;
    var l = document.createElement('link');
    l.id = 'cy-ai-vibe';
    l.rel = 'stylesheet';
    l.href = '/theme-ai-vibe.css';
    document.head.appendChild(l);
  }

  function pathOf(href) {
    try {
      return new URL(href, location.origin).pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
    } catch (e) {
      return href;
    }
  }

  function currentPath() {
    return location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  }

  function alreadyHas(nav, href) {
    var want = pathOf(href);
    var as = nav.querySelectorAll('a[href]');
    for (var i = 0; i < as.length; i++) {
      if (pathOf(as[i].getAttribute('href')) === want) return true;
    }
    return false;
  }

  function buildPanel() {
    var panel = document.createElement('div');
    panel.className = 'cy-ai-dd-panel';
    panel.setAttribute('role', 'menu');
    var lab = document.createElement('div');
    lab.className = 'cy-ai-dd-label';
    lab.textContent = 'Tools';
    panel.appendChild(lab);
    LINKS.forEach(function (L) {
      var a = document.createElement('a');
      a.href = L.href;
      a.setAttribute('role', 'menuitem');
      a.innerHTML = L.label + '<small>' + L.hint + '</small>';
      if (pathOf(L.href) === currentPath()) {
        a.setAttribute('aria-current', 'page');
        a.style.boxShadow = 'inset 0 0 0 1px rgba(95,208,255,.35)';
      }
      panel.appendChild(a);
    });
    return panel;
  }

  function mountDropdown(nav) {
    if (nav.querySelector('.cy-ai-dd')) return;
    var wrap = document.createElement('div');
    wrap.className = 'cy-ai-dd';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cy-ai-dd-btn';
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = 'Tools <span class="cy-ai-caret" aria-hidden="true"></span>';
    var panel = buildPanel();
    wrap.appendChild(btn);
    wrap.appendChild(panel);

    function setOpen(on) {
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (on) panel.classList.add('is-open');
      else panel.classList.remove('is-open');
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(btn.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });

    var req = nav.querySelector('.req');
    if (req) nav.insertBefore(wrap, req);
    else nav.appendChild(wrap);

    LINKS.forEach(function (L) {
      if (alreadyHas(nav, L.href)) return;
      if (L.href === '/tokenomics' && nav.querySelector('#cy-nav-token, a[href="/tokenomics"]')) return;
      if (L.href === '/roadmap' && alreadyHas(nav, '/roadmap')) return;
    });
  }

  function mountFlatStrip(nav) {
    if (nav.querySelector('.cy-ai-tools')) return;
    var strip = document.createElement('div');
    strip.className = 'cy-ai-tools';
    LINKS.forEach(function (L) {
      if (alreadyHas(nav, L.href)) return;
      var a = document.createElement('a');
      a.href = L.href;
      a.textContent = L.label;
      if (pathOf(L.href) === currentPath()) a.setAttribute('aria-current', 'page');
      strip.appendChild(a);
    });
    if (!strip.childNodes.length) return;
    nav.appendChild(strip);
    nav.classList.add('cy-ai-nav');
  }

  function enhanceHome() {
    var nav = document.querySelector('nav.nav');
    if (!nav) return;
    mountDropdown(nav);
    var fix = nav.querySelectorAll('a[href="/check.html"], a[href="check.html"]');
    for (var i = 0; i < fix.length; i++) fix[i].setAttribute('href', '/check');
  }

  function enhanceSecondary() {
    if (document.querySelector('nav.nav .req')) return;
    var nav = document.querySelector('nav.nav, body > .wrap > nav, .wrap > nav, main > nav, nav');
    if (!nav) return;
    var links = nav.querySelectorAll('a').length;
    if (links <= 3) mountFlatStrip(nav);
    else mountDropdown(nav);
  }

  function boot() {
    ensureTheme();
    enhanceHome();
    enhanceSecondary();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
