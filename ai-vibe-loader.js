/* ai-vibe-loader.js — injects theme-ai-vibe.css + ensures nav/popout + core bolt-ons */
(function () {
  'use strict';
  function onceLink(id, href) {
    if (document.getElementById(id) || document.querySelector('link[href="' + href + '"]')) return;
    var el = document.createElement('link');
    el.id = id;
    el.rel = 'stylesheet';
    el.href = href;
    document.head.appendChild(el);
  }
  function onceScript(id, src) {
    if (document.getElementById(id) || document.querySelector('script[src="' + src + '"]')) return;
    var s = document.createElement('script');
    s.id = id;
    s.src = src;
    s.defer = true;
    (document.body || document.documentElement).appendChild(s);
  }
  onceLink('cy-ai-vibe', '/theme-ai-vibe.css');
  onceLink('cy-purple-deep', '/theme-purple-deep.css');
  function boot() {
    // Core bolt-ons (may be missing after index restores)
    onceScript('cy-rwa-widget', '/rwa-widget.js');
    onceScript('cy-vortex', '/vortex.js');
    onceScript('cy-guardian-voice', '/guardian-voice.js');
    onceScript('cy-access-form', '/access-form.js');
    // AI vibe layer
    onceScript('cy-nav-tools', '/nav-tools.js');
    onceScript('cy-guardian-popout', '/guardian-popout.js');
    onceScript('cy-ai-presence', '/ai-presence.js');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
