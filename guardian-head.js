/* guardian-head.js — dust → robot → her photo → dust
   Sapphire glass burst: beads explode past the portrait disc on assemble/dissolve.
   Robot=/robot.jpg, her=/guardian2.jpg. prefers-reduced-motion → static mesh.
   QA: ?phase=dust|assemble|dissolve|burst freezes that moment. */
(function () {
  var canvas = document.getElementById('guardian-head');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dpr = Math.min(Math.max(window.devicePixelRatio || 1, 3), 4);
  var W = 640, H = 800, points = [], facets = [];
  var t0 = performance.now(), raf = 0, visible = true;
  var robotImg = null, herImg = null, robotReady = false, herReady = false;
  var freezeP = null;

  var COL = {
    deep:  [18,  72,  190],
    mid:   [72, 140, 255],
    ice:   [186, 224, 255]
  };

  function pickHue() {
    var r = Math.random();
    if (r < 0.3) return 0;
    if (r < 0.7) return 1;
    return 2;
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function hueColor(hue, a) {
    var c = hue === 0 ? COL.deep : hue === 1 ? COL.mid : COL.ice;
    return rgba(c, a);
  }
  function dist3(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function pushPoint(out, x, y, z, scatterMin, scatterMax) {
    var ds = scatterMin + Math.random() * (scatterMax - scatterMin);
    var da = Math.random() * Math.PI * 2;
    var elev = (Math.random() - 0.45) * 0.95;
    out.push({
      x: x, y: y, z: z,
      gx: x * (0.96 + (Math.random() - 0.5) * 0.06),
      gy: y * (0.98 + (Math.random() - 0.5) * 0.05),
      gz: z * (1.02 + (Math.random() - 0.5) * 0.08),
      dx: x + Math.cos(da) * ds,
      dy: y + Math.sin(da) * ds * 0.7 + elev * 0.3,
      dz: z + (Math.random() - 0.5) * ds * 0.8,
      boom: 0.75 + Math.random() * 0.5,
      hue: pickHue(),
      s: 0.42 + Math.random() * 0.85,
      facet: Math.random(),
      spark: 0.55 + Math.random() * 0.45
    });
  }

  function seed(n) {
    var out = [], i, u, v, th, ph, x, y, z, r, band;
    /* Head-shaped form points */
    for (i = 0; i < n; i++) {
      u = Math.random(); v = Math.random();
      th = u * Math.PI * 2; ph = Math.acos(2 * v - 1);
      x = Math.sin(ph) * Math.cos(th) * 0.78;
      y = Math.cos(ph) * 1.05 - 0.08;
      z = Math.sin(ph) * Math.sin(th) * 0.72;
      if (y < -0.15) {
        r = 0.72 + (y + 0.15) * 0.55;
        x *= Math.max(0.42, r); z *= Math.max(0.48, r + 0.05);
      }
      if (y > 0.55) { x *= 0.92; z *= 0.9; }
      if (z < -0.25 && Math.random() > 0.35) continue;
      band = Math.random();
      if (band < 0.12) {
        x = (Math.random() - 0.5) * 0.55; y = 0.18 + (Math.random() - 0.5) * 0.12; z = 0.55 + Math.random() * 0.18;
      } else if (band < 0.2) {
        x = (Math.random() - 0.5) * 0.12; y = 0.02 + (Math.random() - 0.5) * 0.28; z = 0.62 + Math.random() * 0.16;
      } else if (band < 0.28) {
        x = (Math.random() - 0.5) * 0.38; y = -0.28 + (Math.random() - 0.5) * 0.1; z = 0.58 + Math.random() * 0.14;
      }
      pushPoint(out, x, y, z, 0.95, 2.05);
    }
    /* Extra filled burst cloud — reads as glass shatter, not a hollow shell */
    for (i = 0; i < Math.floor(n * 0.45); i++) {
      var rr = Math.pow(Math.random(), 0.55) * 1.55;
      th = Math.random() * Math.PI * 2;
      ph = Math.acos(2 * Math.random() - 1);
      x = Math.sin(ph) * Math.cos(th) * rr * 0.55;
      y = Math.cos(ph) * rr * 0.7;
      z = Math.sin(ph) * Math.sin(th) * rr * 0.5;
      pushPoint(out, x, y, z, 1.05, 2.2);
    }
    return out;
  }

  function buildFacets(pts, count) {
    var out = [], i, i0, i1, i2;
    for (i = 0; i < count; i++) {
      i0 = (Math.random() * pts.length) | 0;
      i1 = (i0 + 1 + ((Math.random() * 18) | 0)) % pts.length;
      i2 = (i0 + 3 + ((Math.random() * 24) | 0)) % pts.length;
      if (dist3(pts[i0], pts[i1]) > 0.62 || dist3(pts[i0], pts[i2]) > 0.62) continue;
      out.push({ i0: i0, i1: i1, i2: i2, hue: pts[i0].hue });
    }
    return out;
  }

  points = seed(780);
  facets = buildFacets(points, 100);

  function loadImg(src, onOk) {
    try {
      var im = new Image();
      im.decoding = 'async';
      im.onload = function () { onOk(im); };
      im.onerror = function () { onOk(null); };
      im.src = src;
    } catch (e) { onOk(null); }
  }
  loadImg('/robot.jpg', function (im) { robotImg = im; robotReady = !!im; });
  loadImg('/guardian2.jpg', function (im) { herImg = im; herReady = !!im; });

  function resize() {
    var rect = canvas.getBoundingClientRect();
    var cssW = Math.max(1, rect.width);
    var cssH = Math.max(1, rect.height);
    dpr = Math.min(Math.max(window.devicePixelRatio || 1, 3), 4);
    var scale = Math.max(dpr, 2000 / Math.max(cssW, cssH));
    scale = Math.min(scale, 4);
    W = Math.max(1, Math.floor(cssW * scale));
    H = Math.max(1, Math.floor(cssH * scale));
    canvas.width = W; canvas.height = H;
    ctx.imageSmoothingEnabled = true;
    if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
  }

  var PERIOD = 26;
  try {
    var q = new URLSearchParams(location.search);
    var phase = q.get('phase');
    if (phase === 'dust') freezeP = 0.08;
    else if (phase === 'assemble') freezeP = 0.23;
    else if (phase === 'dissolve' || phase === 'burst') freezeP = 0.88;
  } catch (e) {}

  function phaseWeights(elapsed) {
    if (reduce) return { dust: 0, form: 1, robot: 0, her: 0, burst: 0 };
    var p = freezeP != null ? freezeP : (elapsed % PERIOD) / PERIOD;
    var dust = 0, form = 0, robot = 0, her = 0, burst = 0;
    if (p < 0.14) {
      dust = 1;
      burst = 0.55 + 0.2 * Math.sin((p / 0.14) * Math.PI * 2);
    } else if (p < 0.32) {
      var t = smoothstep((p - 0.14) / 0.18);
      dust = 1 - t; form = t; robot = t;
      burst = Math.sin(t * Math.PI);
    } else if (p < 0.48) {
      form = 1; robot = 1;
    } else if (p < 0.60) {
      var t2 = smoothstep((p - 0.48) / 0.12);
      form = 1; robot = 1 - t2; her = t2;
    } else if (p < 0.76) {
      form = 1; her = 1;
    } else {
      var t3 = smoothstep((p - 0.76) / 0.24);
      form = 1 - t3; her = 1 - t3; dust = t3;
      burst = Math.sin(t3 * Math.PI);
    }
    return { dust: dust, form: form, robot: robot, her: her, burst: burst };
  }

  function projectPoint(p, rot, breathe, w) {
    var fa = w.form;
    var x0 = lerp(p.dx, p.gx, fa);
    var y0 = lerp(p.dy, p.gy, fa);
    var z0 = lerp(p.dz, p.gz, fa);

    if (w.burst > 0.02) {
      var boom = w.burst * (p.boom || 1) * 0.95;
      x0 = lerp(x0, p.dx, boom);
      y0 = lerp(y0, p.dy, boom);
      z0 = lerp(z0, p.dz, boom);
    }

    if (fa > 0 && w.burst < 0.35) {
      y0 *= 1 + fa * 0.03;
      if (y0 < -0.1) { x0 *= 1 - fa * 0.1; z0 *= 1 - fa * 0.08; }
    }
    var c = Math.cos(rot), s = Math.sin(rot);
    var xr = x0 * c - z0 * s, zr = x0 * s + z0 * c, yr = y0 * breathe;
    var persp = 2.6 / (2.6 + zr);
    return {
      x: W * 0.5 + xr * persp * W * 0.33,
      y: H * 0.5 + yr * persp * H * 0.31,
      z: zr, a: Math.max(0.12, Math.min(1, (zr + 1.1) / 1.8)),
      hue: p.hue, s: p.s * persp, facet: p.facet, spark: p.spark
    };
  }

  function drawPortrait(img, ready, weight, maxAlpha) {
    if (!ready || !img || weight < 0.05) return;
    var alpha = Math.pow(clamp(weight, 0, 1), 0.9) * maxAlpha;
    var iw = img.naturalWidth || 600, ih = img.naturalHeight || 600;
    var size = Math.min(W, H) * 0.52, dw = size, dh = size * (ih / iw);
    if (dh > H * 0.56) { dh = H * 0.56; dw = dh * (iw / ih); }
    var dx = (W - dw) * 0.5, dy = (H - dh) * 0.42;
    var cx = W * 0.5, cy = H * 0.48;
    var R = Math.max(8, Math.min(dw, dh) * 0.49);

    ctx.save();
    /* Round portrait — soft edge, no ring/border stroke */
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.globalAlpha = alpha * 0.28;
    ctx.fillStyle = 'rgba(8,6,18,1)';
    ctx.fillRect(dx, dy, dw, dh);
    ctx.globalAlpha = alpha * 0.22;
    var eg = ctx.createLinearGradient(0, dy + dh * 0.28, 0, dy + dh * 0.52);
    eg.addColorStop(0, 'rgba(5,8,18,0)');
    eg.addColorStop(0.45, 'rgba(5,8,18,0.85)');
    eg.addColorStop(1, 'rgba(5,8,18,0)');
    ctx.fillStyle = eg;
    ctx.fillRect(dx, dy + dh * 0.22, dw, dh * 0.4);

    /* Feather the rim so it doesn't read as a hard disc */
    var rg = ctx.createRadialGradient(cx, cy, R * 0.78, cx, cy, R);
    rg.addColorStop(0, 'rgba(0,0,0,0)');
    rg.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = rg;
    ctx.fillRect(cx - R - 2, cy - R - 2, R * 2 + 4, R * 2 + 4);
    ctx.restore();
  }

  function drawFacets(projected, w) {
    var m = w.form * (1 - Math.max(w.robot, w.her) * 0.75) * (1 - w.burst * 0.6);
    if (m < 0.08) return;
    var i, f, a, b, c, alpha;
    ctx.lineWidth = Math.max(0.6, dpr * (0.7 + m * 0.5));
    for (i = 0; i < facets.length; i++) {
      f = facets[i]; a = projected[f.i0]; b = projected[f.i1]; c = projected[f.i2];
      if (!a || !b || !c) continue;
      alpha = m * 0.18 * Math.min(a.a, b.a, c.a);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath();
      ctx.fillStyle = 'rgba(40,90,200,' + (alpha * 0.18).toFixed(3) + ')'; ctx.fill();
      ctx.strokeStyle = hueColor(f.hue, alpha); ctx.stroke();
    }
  }

  function drawFrame(now) {
    var elapsed = (now - t0) / 1000;
    var w = phaseWeights(elapsed);
    var rot = reduce ? 0.35 : Math.sin(elapsed * 0.18) * 0.35 + elapsed * 0.045;
    if (freezeP != null) rot = 0.28;
    var breathe = reduce || freezeP != null ? 1 : 1 + Math.sin(elapsed * 0.9) * 0.016;
    var projected = [], i, j, a, b, dx, dy, dist, alpha, col;
    var faceAmt = Math.max(w.robot, w.her) * (1 - w.burst * 0.85);
    var particleAlpha = (1 - faceAmt * 0.75) * (0.42 + w.form * 0.35 + w.dust * 0.55 + w.burst * 0.65);
    var linkAlphaScale = (1 - faceAmt * 0.8) * (0.16 + w.form * 0.35 + w.dust * 0.45 + w.burst * 0.5);

    ctx.clearRect(0, 0, W, H);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    for (i = 0; i < points.length; i++) projected.push(projectPoint(points[i], rot, breathe, w));

    drawFacets(projected, w);
    drawPortrait(robotImg, robotReady, w.robot * (1 - w.burst * 0.7), 0.72);
    drawPortrait(herImg, herReady, w.her * (1 - w.burst * 0.7), 0.88);

    ctx.lineWidth = Math.max(0.35, dpr * 0.35);
    var maxDist = (24 - faceAmt * 10 + w.dust * 12 + w.burst * 16) * dpr;
    var step = faceAmt > 0.55 ? 4 : (w.burst > 0.35 ? 1 : 2);
    for (i = 0; i < projected.length; i += step) {
      a = projected[i]; var linked = 0;
      for (j = i + 1; j < projected.length && linked < 3; j++) {
        b = projected[j]; dx = a.x - b.x; if (dx > maxDist || dx < -maxDist) continue;
        dy = a.y - b.y; if (dy > maxDist || dy < -maxDist) continue;
        dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxDist || dist < 2) continue;
        alpha = (1 - dist / maxDist) * Math.min(a.a, b.a) * 0.2 * linkAlphaScale;
        if (alpha < 0.02) continue;
        if (a.hue === 2 || b.hue === 2) col = rgba(COL.ice, alpha * 0.95);
        else if (a.hue === 0 || b.hue === 0) col = rgba(COL.deep, alpha * 0.95);
        else col = rgba(COL.mid, alpha * 0.9);
        ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        linked++;
      }
    }

    for (i = 0; i < projected.length; i++) {
      a = projected[i];
      var burst = Math.max(w.burst, w.dust * 0.75, 1 - w.form);
      var sz = a.s * (0.65 + dpr * 0.26) * (0.72 + burst * 0.95 + w.form * 0.1);
      if (faceAmt > 0.4 && w.burst < 0.25) sz *= 1 - faceAmt * 0.5;
      var cRgb = a.hue === 0 ? COL.deep : a.hue === 1 ? COL.mid : COL.ice;
      var glass = 0.36 + a.a * 0.26 + burst * 0.34;
      var pa = glass * Math.max(0.16, particleAlpha);
      var spark = (a.spark || 0.7) * (0.8 + burst * 0.95);

      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      ctx.beginPath();
      ctx.arc(a.x, a.y, sz, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + cRgb[0] + ',' + cRgb[1] + ',' + cRgb[2] + ',' + pa.toFixed(3) + ')';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(a.x, a.y, sz, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,' + Math.min(0.9, pa * 1.6 * spark).toFixed(3) + ')';
      ctx.lineWidth = Math.max(0.5, sz * 0.28);
      ctx.stroke();

      var hx = a.x - sz * 0.32;
      var hy = a.y - sz * 0.35;
      ctx.beginPath();
      ctx.arc(hx, hy, Math.max(0.4, sz * 0.32), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.98, 0.45 + spark * 0.55).toFixed(3) + ')';
      ctx.fill();

      if (burst > 0.45) {
        ctx.beginPath();
        ctx.arc(a.x, a.y, sz * (1.35 + burst * 0.35), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(' + cRgb[0] + ',' + cRgb[1] + ',' + cRgb[2] + ',' +
          (0.08 + burst * 0.16).toFixed(3) + ')';
        ctx.lineWidth = Math.max(0.35, sz * 0.1);
        ctx.stroke();
      }
    }
  }

  function loop(now) {
    if (!visible && !reduce) { raf = requestAnimationFrame(loop); return; }
    drawFrame(now || performance.now());
    if (!reduce) raf = requestAnimationFrame(loop);
  }

  resize(); drawFrame(performance.now());
  if (!reduce) raf = requestAnimationFrame(loop);
  window.addEventListener('resize', function () { resize(); if (reduce) drawFrame(performance.now()); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0] && entries[0].isIntersecting;
    }, { threshold: 0.05 }).observe(canvas);
  }
})();
