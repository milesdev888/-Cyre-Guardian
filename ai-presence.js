/* ai-presence.js — SUPER AI idle: portrait orb breathe/pulse + denser cinematic glow
   Bolt-on. respects prefers-reduced-motion. */
(function () {
  'use strict';
  if (window.__cyAiPresence) return;
  window.__cyAiPresence = true;

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var css = document.createElement('style');
  css.id = 'cy-ai-presence-css';
  css.textContent =
    '.hero::before{content:"";position:absolute;inset:-20% -10% auto -10%;height:120%;pointer-events:none;z-index:0;' +
    'background:radial-gradient(ellipse 55% 45% at 70% 35%,rgba(155,123,255,.18),transparent 60%),' +
    'radial-gradient(ellipse 50% 40% at 30% 50%,rgba(95,208,255,.14),transparent 55%);' +
    'filter:blur(40px);opacity:.9}' +
    '.hero .wrap,.hero .hero-grid{position:relative;z-index:1}' +
    '@keyframes cy-ai-spin{to{transform:rotate(360deg)}}' +
    '@keyframes cy-ai-breathe{' +
    '0%,100%{transform:scale(1);box-shadow:0 0 28px rgba(95,208,255,.28),0 0 60px rgba(155,123,255,.14),inset 0 0 22px rgba(95,208,255,.08)}' +
    '50%{transform:scale(1.035);box-shadow:0 0 48px rgba(95,208,255,.48),0 0 90px rgba(155,123,255,.28),inset 0 0 36px rgba(155,123,255,.14)}}' +
    '@keyframes cy-ai-ring-pulse{' +
    '0%,100%{opacity:.55;filter:drop-shadow(0 0 6px rgba(95,208,255,.4))}' +
    '50%{opacity:1;filter:drop-shadow(0 0 14px rgba(155,123,255,.55))}}' +
    '.orbit{isolation:isolate}' +
    '.orbit .ring.r1{animation:cy-ai-spin 56s linear infinite, cy-ai-ring-pulse 5.5s ease-in-out infinite !important;' +
    'border-color:rgba(95,208,255,.35) !important}' +
    '.orbit .ring.r2{animation:cy-ai-spin 38s linear infinite reverse, cy-ai-ring-pulse 4.2s ease-in-out infinite .6s !important;' +
    'border-color:rgba(155,123,255,.4) !important}' +
    '.orbit .ring.r3{animation:cy-ai-breathe 4.8s ease-in-out infinite !important;' +
    'border-color:rgba(95,208,255,.65) !important}' +
    '.portrait{animation:cy-ai-breathe 5.2s ease-in-out infinite !important;' +
    'border-color:rgba(95,208,255,.55) !important;' +
    'box-shadow:0 0 42px rgba(95,208,255,.4),0 0 80px rgba(155,123,255,.22) !important}' +
    '.cy-ai-orb{position:relative;width:min(320px,78vw);aspect-ratio:1;margin:0 auto;' +
    'border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(238,250,255,.35),rgba(95,208,255,.12) 35%,rgba(8,10,18,.9) 70%);' +
    'border:1px solid rgba(95,208,255,.4);box-shadow:0 0 50px rgba(95,208,255,.35),0 0 90px rgba(155,123,255,.2),inset 0 0 40px rgba(155,123,255,.12);' +
    'animation:cy-ai-breathe 5s ease-in-out infinite}' +
    '.cy-ai-orb::before,.cy-ai-orb::after{content:"";position:absolute;inset:12%;border-radius:50%;border:1px dashed rgba(95,208,255,.35);' +
    'animation:cy-ai-spin 28s linear infinite}' +
    '.cy-ai-orb::after{inset:22%;border-style:solid;border-color:rgba(155,123,255,.4);animation-direction:reverse;animation-duration:20s}' +
    '@media (prefers-reduced-motion:reduce){' +
    '.orbit .ring.r1,.orbit .ring.r2,.orbit .ring.r3,.portrait,.cy-ai-orb,.cy-ai-orb::before,.cy-ai-orb::after{animation:none !important}' +
    '.hero::before{opacity:.55}}';
  document.head.appendChild(css);

  function ensureOrb() {
    if (document.querySelector('.portrait, .cy-ai-orb')) return;
    var host = document.querySelector('.hero .orbit') || document.querySelector('.hero-grid > div:last-child') || document.querySelector('.hero .wrap');
    if (!host) return;
    var orb = document.createElement('div');
    orb.className = 'cy-ai-orb';
    orb.setAttribute('aria-hidden', 'true');
    host.appendChild(orb);
  }

  function boot() {
    ensureOrb();
    var rings = document.querySelectorAll('.orbit .ring');
    for (var i = 0; i < rings.length; i++) rings[i].classList.add('cy-ai-alive');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
