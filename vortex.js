(function(){
  var hero = document.querySelector('.hero');
  if (!hero) return;

  var CFG = {
    count: 230,          // glyph particles
    tiltDeg: 58,         // camera tilt (0 = edge-on, 90 = top-down)
    depth: 1.15,         // how deep the funnel drops (x canvas radius)
    focal: 1.9,          // perspective strength (x canvas radius, smaller = more warp)
    outerR: 1.55,        // spawn radius (x canvas radius)
    coreR: 0.16,         // event-horizon radius (x canvas radius)
    spin: 0.16,          // base angular speed
    fall: 0.028,         // inward pull
    dim: 0.8,            // overall intensity 0..1
    glyphs: [
      '7f3ac9','RISK 0.94','ADDR','4bE1\u2026q8','SIG VALID','RWA','0x00d4','FLAG',
      'a91f2c','SETTLED','LP','e77b30','SCORE','b1c4\u20268a','TRACE','ONDO','6d2e91',
      'CHAINLINK','PAXG','HOLD','c30f7a','ATTEST','delta 1.2','SYRUP','9ab4e2'
    ]
  };

  var CYAN = [79,227,208], GOLD = [217,179,108], HOT = [255,241,214];
  var RED = [255,77,94], GREEN = [61,220,132];
  var RED_WORDS = { 'FLAG':1, 'HOLD':1, 'RISK 0.94':1 };
  var GREEN_WORDS = { 'SETTLED':1, 'SIG VALID':1, 'ATTEST':1 };

  function mix(a,b,k){ return [0,1,2].map(function(i){ return Math.round(a[i]+(b[i]-a[i])*k); }); }
  function rgb(c){ return 'rgb('+c[0]+','+c[1]+','+c[2]+')'; }

  hero.style.position = 'relative';
  hero.style.overflow = 'hidden';
  var kids = hero.children, i;
  for (i = 0; i < kids.length; i++){
    if (getComputedStyle(kids[i]).position === 'static') kids[i].style.position = 'relative';
    kids[i].style.zIndex = '2';
  }

  var cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden','true');
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;display:block';
  hero.insertBefore(cv, hero.firstChild);

  var veil = document.createElement('div');
  veil.style.cssText = 'position:absolute;inset:0;z-index:1;pointer-events:none;background:' +
    'radial-gradient(closest-side at 50% 50%, rgba(7,8,11,.88) 0%, rgba(7,8,11,.45) 42%, rgba(7,8,11,0) 74%),' +
    'linear-gradient(to bottom, rgba(7,8,11,.8) 0%, rgba(7,8,11,.12) 30%, rgba(7,8,11,.12) 70%, #07080b 100%)';
  hero.insertBefore(veil, cv.nextSibling);

  var ctx = cv.getContext('2d');
  var W = 0, H = 0, dpr = 1, base = 0, raf = null, t = 0;
  var TILT = CFG.tiltDeg * Math.PI / 180;
  var cosT = Math.cos(TILT), sinT = Math.sin(TILT);

  // ---- sprite cache: one small canvas per word+color ----
  var FONT_PX = 22, PAD = 18;
  var sprites = {};
  function sprite(word, col, glow){
    var key = word + '|' + col + '|' + (glow?1:0);
    if (sprites[key]) return sprites[key];
    var m = document.createElement('canvas').getContext('2d');
    m.font = '400 ' + FONT_PX + 'px ui-monospace, Menlo, monospace';
    var w = Math.ceil(m.measureText(word).width) + PAD*2;
    var off = document.createElement('canvas');
    off.width = w; off.height = FONT_PX + PAD*2;
    var c = off.getContext('2d');
    c.font = '400 ' + FONT_PX + 'px ui-monospace, Menlo, monospace';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (glow){ c.shadowColor = col; c.shadowBlur = 14; }
    c.fillStyle = col;
    c.fillText(word, w/2, (FONT_PX + PAD*2)/2);
    sprites[key] = off;
    return off;
  }

  function colorFor(word, rNorm){
    if (RED_WORDS[word]) return { col: rgb(RED), status: true };
    if (GREEN_WORDS[word]) return { col: rgb(GREEN), status: true };
    var k = Math.min(1, Math.max(0, (rNorm - CFG.coreR) / (CFG.outerR - CFG.coreR)));
    var c = k < 0.45 ? mix(HOT, GOLD, k/0.45) : mix(GOLD, CYAN, (k-0.45)/0.55);
    return { col: rgb(c), status: false };
  }

  // ---- particles ----
  var parts = [];
  function spawn(p, fresh){
    p.word = CFG.glyphs[(Math.random()*CFG.glyphs.length)|0];
    p.a = Math.random() * Math.PI * 2;
    p.r = fresh ? (CFG.coreR + Math.random()*(CFG.outerR - CFG.coreR))
                : (CFG.outerR * (0.92 + Math.random()*0.16));
    p.wob = Math.random() * Math.PI * 2;
    return p;
  }
  for (i = 0; i < CFG.count; i++) parts.push(spawn({}, true));

  function layout(){
    var r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = Math.max(1, W*dpr); cv.height = Math.max(1, H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    base = Math.min(W, H) * 0.5;
  }

  // project a funnel point: rNorm (radius), a (angle) -> screen x,y,scale,zc
  function project(rNorm, a){
    var x = Math.cos(a) * rNorm;
    var z = Math.sin(a) * rNorm;
    var down = 1 - Math.min(1, (rNorm - CFG.coreR) / (CFG.outerR - CFG.coreR));
    var y = -Math.pow(down, 2.2) * CFG.depth;           // drop into the well near the core
    // tilt camera around X
    var y2 = y*cosT - z*sinT;
    var z2 = y*sinT + z*cosT;
    var s = CFG.focal / (CFG.focal + z2 + CFG.outerR);   // keep denominator positive
    return { x: W/2 + x*base*s, y: H*0.52 + y2*base*s, s: s, z: z2 };
  }

  function drawCore(){
    // event horizon: dark ellipse + glowing rim, drawn in the tilted plane
    var p = project(CFG.coreR, 0);
    var rim = CFG.coreR * base * p.s;
    ctx.save();
    ctx.translate(W/2, H*0.52);
    ctx.scale(1, cosT);
    var g = ctx.createRadialGradient(0,0, rim*0.5, 0,0, rim*1.7);
    g.addColorStop(0, 'rgba(7,8,11,1)');
    g.addColorStop(0.55, 'rgba(7,8,11,1)');
    g.addColorStop(0.72, 'rgba(255,241,214,' + (0.35 + 0.18*Math.sin(t*1.4)) + ')');
    g.addColorStop(1, 'rgba(217,179,108,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rim*1.7, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  function frame(){
    t += 0.016;
    ctx.clearRect(0, 0, W, H);

    var order = [];
    for (var j = 0; j < parts.length; j++){
      var p = parts[j];
      var rn = (p.r - CFG.coreR) / (CFG.outerR - CFG.coreR);
      p.a += CFG.spin * 0.016 * (0.35 + 1.3/(rn + 0.18));   // faster near the core
      p.r -= CFG.fall * 0.016 * (0.25 + (1 - rn));           // accelerating fall
      if (p.r <= CFG.coreR * 1.02) spawn(p, false);
      order.push(p);
    }

    // draw the far half, then the core, then the near half
    var proj = [];
    for (j = 0; j < order.length; j++){
      var q = order[j];
      var wobR = q.r + Math.sin(t*0.7 + q.wob) * 0.012;
      var pr = project(wobR, q.a);
      pr.p = q; pr.rn = (q.r - CFG.coreR) / (CFG.outerR - CFG.coreR);
      proj.push(pr);
    }
    proj.sort(function(a,b){ return b.z - a.z; });

    var coreDrawn = false;
    for (j = 0; j < proj.length; j++){
      var d = proj[j];
      if (!coreDrawn && d.z < 0){ drawCore(); coreDrawn = true; }
      var cf = colorFor(d.p.word, d.p.r);
      var sp = sprite(d.p.word, cf.col, cf.status);
      var sc = d.s * (cf.status ? 0.5 : 0.42);
      var swallow = Math.min(1, d.rn / 0.12);               // fade right at the horizon
      var fog = 0.25 + 0.75 * d.s;                           // depth fog
      ctx.globalAlpha = CFG.dim * fog * swallow * (cf.status ? 1 : 0.8);
      ctx.drawImage(sp, d.x - sp.width*sc/2, d.y - sp.height*sc/2, sp.width*sc, sp.height*sc);
    }
    if (!coreDrawn) drawCore();
    ctx.globalAlpha = 1;

    raf = requestAnimationFrame(frame);
  }

  function start(){ if (!raf){ layout(); raf = requestAnimationFrame(frame); } }
  function stop(){ if (raf){ cancelAnimationFrame(raf); raf = null; } }

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  layout();
  if (reduce){ t = 1; frame(); cancelAnimationFrame(raf); raf = null; }
  else start();

  addEventListener('resize', layout);
  if ('IntersectionObserver' in window){
    new IntersectionObserver(function(es){
      if (reduce) return;
      es[0].isIntersecting ? start() : stop();
    }).observe(cv);
  }
  document.addEventListener('visibilitychange', function(){
    if (document.hidden) stop(); else if (!reduce) start();
  });
})();
