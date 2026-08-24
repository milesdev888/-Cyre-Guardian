/* guardian-head.js — dust → robot → her photo → dust
   Soft, no bright eyes / no eye bloom. Robot=/robot.jpg, her=/guardian2.jpg.
   prefers-reduced-motion → static soft mesh. FAB popout unchanged. */
(function () {
  var canvas = document.getElementById('guardian-head');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dpr = Math.min(Math.max(window.devicePixelRatio || 1, 2.5), 4);
  var W = 640, H = 800, points = [], facets = [];
  var t0 = performance.now(), raf = 0, visible = true;
  var robotImg = null, herImg = null, robotReady = false, herReady = false;

  var COL = {
    cyan:   [95,  208, 255],
    violet: [155, 123, 255],
    dviolet:[112,  72, 220],
    gold:   [212, 168, 75]
  };

  function pickHue() {
    var r = Math.random();
    if (r < 0.10) return 3;
    if (r < 0.28) return 0;
    if (r < 0.60) return 1;
    return 2;
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function hueColor(hue, a) {
    var c = hue === 3 ? COL.gold : hue === 0 ? COL.cyan : hue === 1 ? COL.violet : COL.dviolet;
    return rgba(c, a);
  }
  function dist3(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function seed(n) {
    var out = [], i, u, v, th, ph, x, y, z, r, band;
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
      var ds = 0.35 + Math.random() * 0.85;
      var da = Math.random() * Math.PI * 2;
      out.push({
        x: x, y: y, z: z,
        gx: x * (0.96 + (Math.random() - 0.5) * 0.06),
        gy: y * (0.98 + (Math.random() - 0.5) * 0.05),
        gz: z * (1.02 + (Math.random() - 0.5) * 0.08),
        dx: x + Math.cos(da) * ds,
        dy: y + Math.sin(da) * ds * 0.55,
        dz: z + (Math.random() - 0.5) * ds * 0.7,
        hue: pickHue(), s: 0.7 + Math.random() * 1.5, facet: Math.random()
      });
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

  points = seed(640);
  facets = buildFacets(points, 140);

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

  function resize() {
    var rect = canvas.getBoundingClientRect();
    var cssW = Math.max(1, rect.width);
    var cssH = Math.max(1, rect.height);
    var scale = Math.max(dpr, 1600 / Math.max(cssW, cssH));
    scale = Math.min(scale, 4);
    W = Math.max(1, Math.floor(cssW * scale));
    H = Math.max(1, Math.floor(cssH * scale));
    canvas.width = W; canvas.height = H;
    ctx.imageSmoothingEnabled = true;
    if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
  }

  /* dust → robot → dust  (~20s) — no photo morph (C7 profile face lives in ticker only)
     0–15% dust | 15–30% dust→robot | 30–60% robot | 60–85% robot→dust | 85–100% dust */
  var PERIOD = 20;
  function phaseWeights(elapsed) {
    if (reduce) return { dust: 0, form: 1, robot: 0, her: 0 };
    var p = (elapsed % PERIOD) / PERIOD;
    var dust = 0, form = 0, robot = 0, her = 0;
    if (p < 0.15) {
      dust = 1;
    } else if (p < 0.30) {
      var t = smoothstep((p - 0.15) / 0.15);
      dust = 1 - t; form = t; robot = t;
    } else if (p < 0.60) {
      form = 1; robot = 1;
    } else if (p < 0.85) {
      var t2 = smoothstep((p - 0.60) / 0.25);
      form = 1 - t2 * 0.35; robot = 1 - t2; dust = t2;
    } else {
      dust = 1; form = 0.25;
    }
    return { dust: dust, form: form, robot: robot, her: her };
  }

  function projectPoint(p, rot, breathe, w) {
    var fa = w.form;
    var x0 = lerp(p.dx, p.gx, fa);
    var y0 = lerp(p.dy, p.gy, fa);
    var z0 = lerp(p.dz, p.gz, fa);
    if (fa > 0) {
      y0 *= 1 + fa * 0.03;
      if (y0 < -0.1) { x0 *= 1 - fa * 0.1; z0 *= 1 - fa * 0.08; }
    }
    var c = Math.cos(rot), s = Math.sin(rot);
    var xr = x0 * c - z0 * s, zr = x0 * s + z0 * c, yr = y0 * breathe;
    var persp = 2.6 / (2.6 + zr);
    return {
      x: W * 0.5 + xr * persp * W * 0.38,
      y: H * 0.48 + yr * persp * H * 0.34,
      z: zr, a: Math.max(0.12, Math.min(1, (zr + 1.1) / 1.8)),
      hue: p.hue, s: p.s * persp, facet: p.facet
    };
  }

  function drawPortrait(img, ready, weight, maxAlpha) {
    if (!ready || !img || weight < 0.05) return;
    var alpha = Math.pow(clamp(weight, 0, 1), 0.9) * maxAlpha;
    var iw = img.naturalWidth || 600, ih = img.naturalHeight || 600;
    var size = Math.min(W, H) * 0.82, dw = size, dh = size * (ih / iw);
    if (dh > H * 0.88) { dh = H * 0.88; dw = dh * (iw / ih); }
    var dx = (W - dw) * 0.5, dy = H * 0.06;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(img, dx, dy, dw, dh);
    // Soft dim overlay — kills hot spots / bright baked-in eyes without drawing eyes
    ctx.globalAlpha = alpha * 0.28;
    ctx.fillStyle = 'rgba(8,6,18,1)';
    ctx.fillRect(dx, dy, dw, dh);
    // Extra soft shade over upper face (eye band) only
    ctx.globalAlpha = alpha * 0.22;
    var eg = ctx.createLinearGradient(0, dy + dh * 0.28, 0, dy + dh * 0.52);
    eg.addColorStop(0, 'rgba(5,8,18,0)');
    eg.addColorStop(0.45, 'rgba(5,8,18,0.85)');
    eg.addColorStop(1, 'rgba(5,8,18,0)');
    ctx.fillStyle = eg;
    ctx.fillRect(dx, dy + dh * 0.22, dw, dh * 0.4);
    ctx.restore();
  }

  function drawFacets(projected, w) {
    var m = w.form * (1 - Math.max(w.robot, w.her) * 0.75);
    if (m < 0.08) return;
    var i, f, a, b, c, alpha;
    ctx.lineWidth = Math.max(0.6, dpr * (0.7 + m * 0.5));
    for (i = 0; i < facets.length; i++) {
      f = facets[i]; a = projected[f.i0]; b = projected[f.i1]; c = projected[f.i2];
      if (!a || !b || !c) continue;
      alpha = m * 0.18 * Math.min(a.a, b.a, c.a);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath();
      ctx.fillStyle = 'rgba(112,72,220,' + (alpha * 0.2).toFixed(3) + ')'; ctx.fill();
      ctx.strokeStyle = hueColor(f.hue, alpha); ctx.stroke();
    }
  }

  function drawFrame(now) {
    var elapsed = (now - t0) / 1000;
    var w = phaseWeights(elapsed);
    var rot = reduce ? 0.35 : Math.sin(elapsed * 0.22) * 0.45 + elapsed * 0.06;
    var breathe = reduce ? 1 : 1 + Math.sin(elapsed * 0.9) * 0.016;
    var projected = [], i, j, a, b, dx, dy, dist, alpha, col;
    var faceAmt = Math.max(w.robot, w.her);
    var particleAlpha = (1 - faceAmt * 0.9) * (0.32 + w.form * 0.55 + w.dust * 0.4);
    var linkAlphaScale = (1 - faceAmt * 0.88) * (0.2 + w.form * 0.55 + w.dust * 0.35);

    ctx.clearRect(0, 0, W, H);

    // Softer ambient — no hot white core
    var g = ctx.createRadialGradient(W * 0.5, H * 0.42, 10, W * 0.5, H * 0.48, W * 0.44);
    g.addColorStop(0, 'rgba(112,72,220,' + (0.08 + w.form * 0.05).toFixed(3) + ')');
    g.addColorStop(0.45, 'rgba(155,123,255,' + (0.05 + w.form * 0.03).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(5,8,18,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    for (i = 0; i < points.length; i++) projected.push(projectPoint(points[i], rot, breathe, w));

    if (w.dust > 0.05) {
      var dg = ctx.createRadialGradient(W * 0.5, H * 0.48, 5, W * 0.5, H * 0.5, W * 0.52);
      dg.addColorStop(0, 'rgba(112,72,220,' + (0.1 * w.dust).toFixed(3) + ')');
      dg.addColorStop(0.5, 'rgba(155,123,255,' + (0.05 * w.dust).toFixed(3) + ')');
      dg.addColorStop(1, 'rgba(5,8,18,0)');
      ctx.fillStyle = dg; ctx.fillRect(0, 0, W, H);
    }

    drawFacets(projected, w);
    drawPortrait(robotImg, robotReady, w.robot, 0.72);

    ctx.lineWidth = Math.max(0.5, dpr * 0.7);
    var maxDist = (32 - faceAmt * 14 + w.dust * 14) * dpr;
    var step = faceAmt > 0.5 ? 3 : 1;
    for (i = 0; i < projected.length; i += step) {
      a = projected[i]; var linked = 0;
      for (j = i + 1; j < projected.length && linked < 8; j++) {
        b = projected[j]; dx = a.x - b.x; if (dx > maxDist || dx < -maxDist) continue;
        dy = a.y - b.y; if (dy > maxDist || dy < -maxDist) continue;
        dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxDist || dist < 2) continue;
        alpha = (1 - dist / maxDist) * Math.min(a.a, b.a) * 0.42 * linkAlphaScale;
        if (alpha < 0.02) continue;
        if (a.hue === 3 || b.hue === 3) col = rgba(COL.gold, alpha * 0.75);
        else if (a.hue === 0 || b.hue === 0) col = rgba(COL.cyan, alpha * 0.85);
        else col = rgba(COL.violet, alpha);
        ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        linked++;
      }
    }

    for (i = 0; i < projected.length; i++) {
      a = projected[i];
      var sz = a.s * (0.95 + dpr * 0.35) * (0.7 + w.dust * 0.4 + w.form * 0.25);
      if (faceAmt > 0.35) sz *= 1 - faceAmt * 0.55;
      var baseA = (a.hue === 3 ? 0.42 : 0.32) + a.a * 0.4;
      ctx.beginPath();
      ctx.fillStyle = hueColor(a.hue, baseA * Math.max(0.04, particleAlpha));
      ctx.arc(a.x, a.y, sz, 0, Math.PI * 2);
      ctx.fill();
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
