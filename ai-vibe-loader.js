/* ai-vibe-loader.js — injects theme-ai-vibe.css + ensures nav-tools + guardian-popout */
(function () {
  'use strict';
  function once(id, tag, attrs) {
    if (document.getElementById(id)) return;
    var el = document.createElement(tag);
    el.id = id;
    Object.keys(attrs).forEach(function (k) { el[k] = attrs[k]; });
    if (tag === 'link' || tag === 'script') {
      (tag === 'link' ? document.head : (document.body || document.documentElement)).appendChild(el);
    }
  }

  once('cy-ai-vibe', 'link', { rel: 'stylesheet', href: '/theme-ai-vibe.css' });

  function ensureScript(id, src) {
    if (document.getElementById(id) || document.querySelector('script[src="' + src + '"]')) return;
    var s = document.createElement('script');
    s.id = id;
    s.src = src;
    s.defer = true;
    (document.body || document.documentElement).appendChild(s);
  }

  function boot() {
    ensureScript('cy-nav-tools', '/nav-tools.js');
    ensureScript('cy-guardian-popout', '/guardian-popout.js');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
