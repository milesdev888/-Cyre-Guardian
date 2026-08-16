(function(){
  var hero = document.querySelector('.hero');
  if (!hero) return;

  var CFG = {
    tilt: 0.52,
    rings: 13,
    innerR: 0.20,
    outerR: 1.45,
    spin: 0.055,
    dim: 0.55,
    glyphs: [
      '7f3ac9','RISK 0.94','ADDR','4bE1…q8','SIG VALID','RWA','0x00d4','FLAG',
      'a91f2c','SETTLED','LP','e77b30','SCORE','b1c4…8a','TRACE','ONDO','6d2e91',
      'CHAINLINK','PAXG','HOLD','c30f7a','ATTEST','delta 1.2','SYRUP','9ab4e2'
    ]
  };

  hero.style.position = 'relative';
  hero.style.overflow = 'hidden';
  var kids = hero.children;
  for (var i = 0; i < kids.length; i++){
    kids[i].style.position = 'relative';
    kids[i].style.zIndex = '2';
  }

  var cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden','true');
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;display:block';
  hero.insertBefore(cv, hero.firstChild);

  var veil = document.createElement('div');
  veil.style.cssText = 'position:absolute;inset:0;z-index:1;pointer-events:none;background:' +
    'radial-gradient(closest-side at 50% 50%, rgba(7,8,11,.9) 0%, rgba(7,8,11,.5) 40%, rgba(7,8,11,0) 72%),' +
    'linear-gradient(to bottom, rgba(7,8,11,.8) 0%, rgba(7,8,11,.15) 30%, rgba(7,8,11,.15) 70%, #07080b 100%)';
  hero.insertBefore(veil, cv.nextSibling);

  var ctx = cv.getContext('2d', { alpha: true });
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rings = [], W = 0, H = 0, dpr = 1, raf = null, t = 0;

  var CYAN = [79,227,208], GOLD = [217,179,108], HOT = [255,241,214];
  var RED = 'rgb(255,77,94)', GREEN = 'rgb(61,220,132)';
  var RED_WORDS = { 'FLAG':1, 'HOLD':1, 'RISK 0.94':1 };
  var GREEN_WORDS = { 'SETTLED':1, 'SIG VALID':1, 'ATTEST':1 };
  function statusColor(word){
    if (RED_WORDS[word]) return RED;
    if (GREEN_WORDS[word]) return GREEN;
    return null;
  }
  function mix(a,b,k){ return [0,1,2].map(function(i){ return Math.round(a[i]+(b[i]-a[i])*k); }); }
  function ringColor(k){
    var c = k < 0.45 ? mix(HOT, GOLD, k/0.45) : mix(GOLD, CYAN, (k-0.45)/0.55);
    return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
  }

  function buildRing(radius, k){
    var size = Math.ceil(radius*2 + 60);
    var font = Math.max(9, 20 - k*9);
    var col = ringColor(k);
    var meas = document.createElement('canvas').getContext('2d');
    meas.font = '400 ' + font + "px ui-monospace, Menlo, monospace";
    var words = [], used = 0, circ = 2 * Math.PI * radius;
    while (used < circ - 20){
      var word = CFG.glyphs[(Math.random()*CFG.glyphs.length)|0];
      var w = meas.measureText(word).width + font*1.4;
      words.push({ word: word, a: (used + w/2) / radius });
      used += w;
    }
    function paint(glow){
      var off = document.createElement('canvas');
      off.width = off.height = size;
      var c = off.getContext('2d');
      c.font = '400 ' + font + "px ui-monospace, Menlo, monospace";
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.translate(size/2, size/2);
      for (var j = 0; j < words.length; j++){
        var sc = statusColor(words[j].word);
        if (glow){
          c.fillStyle = sc || '#fff1d6';
          c.shadowColor = sc || col;
          c.shadowBlur = font * (sc ? 2.1 : 1.6);
          c.globalAlpha = 1;
        } else {
          c.fillStyle = sc || col;
          c.globalAlpha = (sc ? 0.55 : 0.30 + (1-k)*0.65) * CFG.dim * (sc ? 1.6 : 1);
        }
        c.save();
        c.rotate(words[j].a);
        c.translate(0, -radius);
        c.fillText(words[j].word, 0, 0);
        c.restore();
      }
      return off;
    }
    return { base: paint(false), glow: paint(true) };
  }

  function layout(){
    var r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = W*dpr; cv.height = H*dpr;
    var base = Math.min(W, H);
    rings = [];
    for (var i = 0; i < CFG.rings; i++){
      var k = i / (CFG.rings - 1);
      var radius = base * (CFG.innerR + (CFG.outerR - CFG.innerR) * Math.pow(k, 1.35));
      var imgs = buildRing(radius, k);
      rings.push({
        radius: radius, k: k,
        img: imgs.base, glowImg: imgs.glow,
        speed: CFG.spin / Math.pow(radius / (base*CFG.innerR), 0.9),
        phase: Math.random() * Math.PI * 2,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.015 + Math.random() * 0.02
      });
    }
  }

  function drawHorizon(base){
    var r = base * CFG.innerR;
    ctx.save();
    ctx.scale(1, CFG.tilt);
    var g = ctx.createRadialGradient(0,0, r*0.55, 0,0, r*1.5);
    g.addColorStop(0, 'rgba(7,8,11,1)');
    g.addColorStop(0.62, 'rgba(7,8,11,1)');
    g.addColorStop(0.72, 'rgba(255,241,214,0.5)');
    g.addColorStop(1, 'rgba(217,179,108,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0,0, r*1.5, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function frame(){
    var base = Math.min(W, H);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,W,H);
    ctx.translate(W/2, H/2);
    for (var i = rings.length - 1; i >= 0; i--){
      var ring = rings[i];
      var rot = ring.phase + t * ring.speed;
      var half = ring.img.width / 2;
      ctx.save();
      ctx.scale(1, CFG.tilt);
      ctx.rotate(rot);
      ctx.drawImage(ring.img, -half, -half);
      var breathe = 0.5 + 0.5 * Math.sin(ring.pulse + t * ring.pulseSpeed);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (0.12 + 0.30 * breathe) * (1 - ring.k * 0.6) * CFG.dim;
      ctx.drawImage(ring.glowImg, -half, -half);
      var arcA = (t * 0.012 + ring.pulse) % (Math.PI * 2);
      ctx.rotate(-rot);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, half, arcA, arcA + 0.9);
      ctx.closePath();
      ctx.clip();
      ctx.rotate(rot);
      ctx.globalAlpha = 0.85 * (1 - ring.k * 0.5) * CFG.dim;
      ctx.drawImage(ring.glowImg, -half, -half);
      ctx.restore();
    }
    drawHorizon(base);
    ctx.setTransform(1,0,0,1,0,0);
    if (!reduce){ t += 1; raf = requestAnimationFrame(frame); }
  }

  function start(){ if (raf === null) raf = requestAnimationFrame(frame); }
  function stop(){ if (raf !== null) { cancelAnimationFrame(raf); raf = null; } }

  layout();
  if (reduce){ frame(); } else { start(); }

  var rt;
  window.addEventListener('resize', function(){
    clearTimeout(rt);
    rt = setTimeout(function(){ stop(); layout(); reduce ? frame() : start(); }, 200);
  });
  if ('IntersectionObserver' in window && !reduce){
    new IntersectionObserver(function(es){ es[0].isIntersecting ? start() : stop(); }, {threshold:0}).observe(cv);
  }
  document.addEventListener('visibilitychange', function(){
    if (document.hidden) stop(); else if (!reduce) start();
  });
})();
