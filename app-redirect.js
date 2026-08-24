/* app-redirect.js — send standalone product URLs to Guardian App (keeps ?embed=1 for iframes) */
(function () {
  'use strict';

  if (new URLSearchParams(location.search).get('embed') === '1') return;
  if (window.self !== window.top) return;

  var PATH_TO_VIEW = {
    '/scan': 'scan',
    '/check': 'check',
    '/watch': 'watch',
    '/score': 'score',
    '/passport': 'passport',
    '/forensics': 'forensics',
    '/oracle': 'oracle',
    '/signals': 'signals',
    '/tokenomics': 'tokenomics',
    '/roadmap': 'roadmap',
    '/airdrop': 'airdrop',
    '/apps': 'home',
  };

  var path = location.pathname.replace(/\.html$/i, '').replace(/\/$/, '') || '/';
  if (path === '/app' || path === '/' || path === '/index-legacy') return;

  var view = PATH_TO_VIEW[path];
  if (!view) return;

  var target = '/app' + (view === 'home' ? '' : '#' + view) + (location.search || '');
  location.replace(target);
})();
