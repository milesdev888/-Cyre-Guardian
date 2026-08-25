(function(){
  if (document.getElementById('cy-banner')) return;

  // Glass theme loader (Hedra design, crystal-recolored)
  if (!document.getElementById('cy-glass')){
    var gl = document.createElement('link');
    gl.id = 'cy-glass';
    gl.rel = 'stylesheet';
    gl.href = '/theme-glass.css';
    document.head.appendChild(gl);
  }

  // AI vibe layer (theme + Tools nav + Guardian pop-out + core bolt-ons)
  if (!document.querySelector('script[src="/ai-vibe-loader.js"]')){
    var av = document.createElement('script');
    av.src = '/ai-vibe-loader.js';
    av.defer = true;
    (document.body || document.documentElement).appendChild(av);
  }

  var css = document.createElement('style');
  css.textContent =
    '#cy-banner{position:relative;overflow:hidden;background:#07080b;border-top:1px solid #1f2634;border-bottom:1px solid #1f2634}' +
    '#cy-banner .cyb-in{position:relative;z-index:2;max-width:1080px;margin:0 auto;padding:72px 24px 56px;text-align:center}' +
    '#cy-banner h2{font-family:Sora,system-ui,sans-serif;font-weight:700;font-size:clamp(26px,4.5vw,44px);color:#e8ecf3;margin:0 0 14px;letter-spacing:-.01em}' +
    '#cy-banner p{color:#8892a4;font-size:clamp(14px,1.8vw,17px);max-width:640px;margin:0 auto 26px;line-height:1.7}' +
    '#cy-banner .cyb-frame{display:block;width:100%;height:70vh;border:1px solid rgba(196,181,253,.16);border-radius:16px;pointer-events:none;background:#05060a;box-sizing:border-box}' +
    '#cy-banner .cyb-full{display:inline-block;margin-top:16px;font:500 14px Inter,system-ui,sans-serif;color:var(--gold,#5fd0ff);text-decoration:none}' +
    '#cy-banner .cyb-full:hover,#cy-banner .cyb-full:focus-visible{color:#e8ecf3;text-decoration:underline}' +
    '@media (max-width:640px){#cy-banner .cyb-in{padding:56px 20px 44px}#cy-banner .cyb-frame{height:60vh}}';
  document.head.appendChild(css);

  var sec = document.createElement('section');
  sec.id = 'cy-banner';
  sec.innerHTML =
    '<div class="cyb-in">' +
      '<h2>Inside the Guardian.</h2>' +
      '<p>The agent graph, live \u2014 research, signals, execution, risk. Patterns, not verdicts.</p>' +
      '<iframe class="cyb-frame" src="/cortex.html" loading="lazy" title="Guardian Neural Cortex"></iframe>' +
      '<a class="cyb-full" href="/cortex">Open full screen \u2192</a>' +
    '</div>';

  // $CYRE nav tab — inserted before "Request access"
  var nav = document.querySelector('nav.nav');
  if (nav && !document.getElementById('cy-nav-token')){
    var tk = document.createElement('a');
    tk.id = 'cy-nav-token';
    tk.href = '/tokenomics';
    tk.textContent = '$C7';
    tk.style.cssText = 'color:var(--gold,#5fd0ff);font-weight:600';
    var rm = document.createElement('a');
    rm.href = '/roadmap';
    rm.textContent = 'Roadmap';
    nav.insertBefore(rm, nav.querySelector('.req'));
    var req = nav.querySelector('.req');
    if (req) nav.insertBefore(tk, req); else nav.appendChild(tk);
  }

  // $CYRE hero button — joins the CTA row next to "Check an address"
  var ctaRow = document.querySelector('.cta-row');
  if (ctaRow && !document.getElementById('cy-hero-token')){
    var wrapA = document.createElement('a');
    wrapA.href = '/tokenomics';
    wrapA.id = 'cy-hero-token';
    var btn = document.createElement('button');
    btn.className = 'btn b-ghost';
    btn.style.cssText = 'color:var(--gold,#5fd0ff);border-color:rgba(95,208,255,.5);display:inline-flex;align-items:center;gap:9px';
    var lg = document.createElement('img');
    lg.src = '/cyre-token-ticker-128.png';
    lg.alt = '';
    lg.style.cssText = 'width:22px;height:22px;border-radius:50%;display:block';
    lg.onerror = function(){ lg.remove(); };
    btn.appendChild(lg);
    btn.appendChild(document.createTextNode('$C7 Token'));
    wrapA.appendChild(btn);
    ctaRow.appendChild(wrapA);
  }

  // Telemetry HUD bar under the hero (claims-safe values only)
  var hero = document.querySelector('.hero');
  if (hero && !document.getElementById('cy-hud')){
    var hud = document.createElement('div');
    hud.id = 'cy-hud';
    hud.innerHTML = '<div class="wrap"><div class="hud-bar">' +
      '<div class="hud-item"><span class="hud-label">Guardian</span><span class="hud-val">Online <span class="up">\u25B2 LIVE</span></span></div>' +
      '<div class="hud-item"><span class="hud-label">Address Checker</span><span class="hud-val">Free \u2014 Live</span></div>' +
      '<div class="hud-item"><span class="hud-label">$C7 Launch</span><span class="hud-val">upcoming</span></div>' +
      '<div class="hud-item"><span class="hud-label">Network</span><span class="hud-val">Solana</span></div>' +
    '</div></div>';
    hero.parentNode.insertBefore(hud, hero.nextSibling);
  }

  // Use Case 01 link strip
  var uc = document.createElement('a');
  uc.id = 'cy-usecase';
  uc.href = '/check';
  uc.style.cssText = 'display:block;background:#0d1017;border-top:1px solid #1f2634;border-bottom:1px solid #1f2634;padding:18px 24px;text-align:center;text-decoration:none;font-family:Inter,system-ui,sans-serif;font-size:15px;color:#e8ecf3';
  uc.innerHTML = '<span style="font-family:\'JetBrains Mono\',Menlo,monospace;font-size:12px;color:#4fe3d0;letter-spacing:.1em;margin-right:14px">GUARDIAN CHECK</span>' +
    'Grade any Solana address free \u2014 patterns, not verdicts <span style="color:var(--gold,#5fd0ff)">\u2192</span>';

  var anchor = document.getElementById('guardian') ||
               document.querySelector('#pricing, section.sec:last-of-type');
  if (anchor && anchor.parentNode){
    anchor.parentNode.insertBefore(sec, anchor);
    anchor.parentNode.insertBefore(uc, anchor);
  } else { document.body.appendChild(sec); document.body.appendChild(uc); }
})();
