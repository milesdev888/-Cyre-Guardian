/* ai-presence.js — bolt-on presence layer.
   Purple hero bloom + violet glow tokens removed (solid forest chrome). */
(function () {
  'use strict';
  if (window.__cyAiPresence) return;
  window.__cyAiPresence = true;

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var css = document.createElement('style');
  css.id = 'cy-ai-presence-css';
  css.textContent =
    'body{--ai-glow:0 0 28px rgba(216,188,102,.22),0 0 48px rgba(216,188,102,.1);--ai-glow-sm:0 0 16px rgba(216,188,102,.18)}' +
    '.hud-bar,#cy-hud .hud-bar{box-shadow:0 12px 40px rgba(0,0,0,.5),inset 0 1px 1px rgba(255,255,255,.06),0 0 24px rgba(216,188,102,.12)!important}' +
    '.nav .req,.btn.b-main{box-shadow:0 0 24px rgba(216,188,102,.28)!important}' +
    /* No hero bloom / constellation wash — solid page background only */
    '.hero::before,.hero::after{content:none!important;display:none!important;background:none!important}' +
    '.hero{background:transparent!important}' +
    '#cy-ai-mesh{display:none!important}' +
    (reduce ? '*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}' : '');
  document.head.appendChild(css);

  // Scrub any leftover mesh canvas from older vortex builds
  function scrubMesh() {
    var mesh = document.getElementById('cy-ai-mesh');
    if (mesh && mesh.parentNode) mesh.parentNode.removeChild(mesh);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scrubMesh);
  } else {
    scrubMesh();
  }
})();
