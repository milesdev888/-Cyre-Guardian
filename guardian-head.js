/* guardian-head.js — dust → purple mesh head → her photo → dust
   Cycle ~22s. Mesh matches founder particle-head mock; photo = /guardian2.jpg.
   No cartoon eyes. prefers-reduced-motion → static mesh. FAB popout unchanged. */
(function () {
  var canvas = document.getElementById('guardian-head');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dpr = Math.min(Math.max(window.devicePixelRatio || 1, 2.5), 4);
  var W = 640, H = 800, points = [], facets = [];
  var t0 = performance.now(), raf = 0, visible = true;
  var faceImg = null, faceReady = false;

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
        hue: pickHue(), s: 0.7 + Math.random() * 1.5, facet: Math.random(),
        // soft eye glow seeds (near eye sockets when formed)
        eye: (Math.abs(x) > 0.18 && Math.abs(x) < 0.42 && y > -0.05 && y < 0.22 && z > 0.35) ? 1 : 0
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

  points = seed(720);
  facets = buildFacets(points, 180);

  try {
    faceImg = new Image();
    faceImg.decoding = 'async';
    faceImg.onload = function () { faceReady = true; };
    faceImg.onerror = function () {
      // fallback to robot plate if portrait missing
      faceImg = new Image();
      faceImg.onload = function () { faceReady = true; };
      faceImg.src = '/robot.jpg';
    };
    faceImg.src = '/guardian2.jpg';
  } catch (e) { faceReady = false; }

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

  /* dust → mesh → photo → dust
     0–16% dust | 16–30% dust→mesh | 30–48% mesh hold | 48–60% mesh→photo
     60–82% photo hold | 82–100% photo→dust */
  var PERIOD = 22;
  function phaseWeights(elapsed) {
    if (reduce) return { dust: 0, mesh: 1, photo: 0 };
    var p = (elapsed % PERIOD) / PERIOD;
    var dust = 0, mesh = 0, photo = 0;
    if (p < 0.16) {
      dust = 1;
    } else if (p < 0.30) {
      var t = smoothstep((p - 0.16) / 0.14);
      dust = 1 - t; mesh = t;
    } else if (p < 0.48) {
      mesh = 1;
    } else if (p < 0.60) {
      var t2 = smoothstep((p - 0.48) / 0.12);
      mesh = 1 - t2; photo = t2;
    } else if (p < 0.82) {
      photo = 1;
    } else {
      var t3 = smoothstep((p - 0.82) / 0.18);
      photo = 1 - t3; dust = t3;
    }
    return { dust: dust, mesh: mesh, photo: photo };
  }

  function formAmount(w) { return w.mesh + w.photo; }

  function projectPoint(p, rot, breathe, w) {
    var fa = formAmount(w);
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
      hue: p.hue, s: p.s * persp, facet: p.facet, eye: p.eye
    };
  }

  function drawDustGlow(w) {
    if (w.dust < 0.05) return;
    var g = ctx.createRadialGradient(W * 0.5, H * 0.48, 5, W * 0.5, H * 0.5, W * 0.52);
    g.addColorStop(0, 'rgba(112,72,220,' + (0.12 * w.dust).toFixed(3) + ')');
    g.addColorStop(0.5, 'rgba(155,123,255,' + (0.07 * w.dust).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(5,8,18,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function drawMeshAura(w) {
    var m = w.mesh;
    if (m < 0.05) return;
    var g = ctx.createRadialGradient(W * 0.5, H * 0.42, 8, W * 0.5, H * 0.48, W * 0.42);
    g.addColorStop(0, 'rgba(155,123,255,' + (0.16 * m).toFixed(3) + ')');
    g.addColorStop(0.45, 'rgba(95,208,255,' + (0.08 * m).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(5,8,18,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  /* Soft cyan eye bloom from particles only — never solid white cartoon ovals */
  function drawEyeBloom(projected, w) {
    var m = w.mesh * (1 - w.photo * 0.85);
    if (m < 0.15) return;
    var i, a;
    for (i = 0; i < projected.length; i++) {
      a = projected[i];
      if (!a.eye) continue;
      var rad = (10 + dpr * 6) * m * a.a;
      var eg = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, rad);
      eg.addColorStop(0, 'rgba(220,245,255,' + (0.55 * m * a.a).toFixed(3) + ')');
      eg.addColorStop(0.35, 'rgba(95,208,255,' + (0.28 * m * a.a).toFixed(3) + ')');
      eg.addColorStop(1, 'rgba(95,208,255,0)');
      ctx.beginPath(); ctx.fillStyle = eg;
      ctx.arc(a.x, a.y, rad, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawHerPhoto(w) {
    if (!faceReady || !faceImg || w.photo < 0.05) return;
    var alpha = Math.pow(clamp(w.photo, 0, 1), 0.85);
    var iw = faceImg.naturalWidth || 600, ih = faceImg.naturalHeight || 600;
    var size = Math.min(W, H) * 0.82, dw = size, dh = size * (ih / iw);
    if (dh > H * 0.88) { dh = H * 0.88; dw = dh * (iw / ih); }
    var dx = (W - dw) * 0.5, dy = H * 0.06;
    // Full portrait — no ellipse clip, no circle rim/stroke in the middle
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(faceImg, dx, dy, dw, dh);
    ctx.restore();
  }

  function drawFacets(projected, w) {
    var m = w.mesh * (1 - w.photo * 0.7);
    if (m < 0.08) return;
    var i, f, a, b, c, alpha;
    ctx.lineWidth = Math.max(0.7, dpr * (0.8 + m * 0.7));
    for (i = 0; i < facets.length; i++) {
      f = facets[i]; a = projected[f.i0]; b = projected[f.i1]; c = projected[f.i2];
      if (!a || !b || !c) continue;
      alpha = m * 0.26 * Math.min(a.a, b.a, c.a);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath();
      ctx.fillStyle = 'rgba(112,72,220,' + (alpha * 0.28).toFixed(3) + ')'; ctx.fill();
      ctx.strokeStyle = hueColor(f.hue, alpha * 1.45); ctx.stroke();
    }
  }

  function drawFrame(now) {
    var elapsed = (now - t0) / 1000;
    var w = phaseWeights(elapsed);
    var fa = formAmount(w);
    var rot = reduce ? 0.35 : Math.sin(elapsed * 0.22) * 0.5 + elapsed * 0.07;
    var breathe = reduce ? 1 : 1 + Math.sin(elapsed * 0.9) * 0.018;
    var projected = [], i, j, a, b, dx, dy, dist, alpha, col;
    // hide particles under photo
    var particleAlpha = (1 - w.photo * 0.92) * (0.35 + fa * 0.65 + w.dust * 0.4);
    var linkAlphaScale = (1 - w.photo * 0.9) * (0.25 + w.mesh * 0.75);

    ctx.clearRect(0, 0, W, H);

    var g = ctx.createRadialGradient(W * 0.5, H * 0.42, 10, W * 0.5, H * 0.48, W * 0.44);
    g.addColorStop(0, 'rgba(112,72,220,' + (0.12 + fa * 0.08).toFixed(3) + ')');
    g.addColorStop(0.4, 'rgba(155,123,255,' + (0.07 + fa * 0.04).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(5,8,18,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    for (i = 0; i < points.length; i++) projected.push(projectPoint(points[i], rot, breathe, w));

    drawDustGlow(w);
    drawMeshAura(w);
    drawFacets(projected, w);
    drawEyeBloom(projected, w);
    drawHerPhoto(w);

    ctx.lineWidth = Math.max(0.55, dpr * 0.8);
    var maxDist = (34 - w.photo * 12 + w.dust * 16) * dpr;
    var step = w.photo > 0.55 ? 3 : 1;
    for (i = 0; i < projected.length; i += step) {
      a = projected[i]; var linked = 0;
      for (j = i + 1; j < projected.length && linked < 9; j++) {
        b = projected[j]; dx = a.x - b.x; if (dx > maxDist || dx < -maxDist) continue;
        dy = a.y - b.y; if (dy > maxDist || dy < -maxDist) continue;
        dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxDist || dist < 2) continue;
        alpha = (1 - dist / maxDist) * Math.min(a.a, b.a) * 0.55 * linkAlphaScale;
        if (alpha < 0.02) continue;
        if (a.hue === 3 || b.hue === 3) col = rgba(COL.gold, alpha * 0.8);
        else if (a.hue === 0 || b.hue === 0) col = rgba(COL.cyan, alpha);
        else col = rgba(COL.violet, alpha * 1.15);
        ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        linked++;
      }
    }

    for (i = 0; i < projected.length; i++) {
      a = projected[i];
      var sz = a.s * (1.05 + dpr * 0.4) * (0.75 + w.dust * 0.45 + w.mesh * 0.35);
      if (w.photo > 0.35) sz *= 1 - w.photo * 0.55;
      var baseA = (a.hue === 3 ? 0.5 : 0.4) + a.a * 0.5;
      if (a.eye && w.mesh > 0.3) {
        baseA += 0.35 * w.mesh;
        sz *= 1.35;
      }
      ctx.beginPath();
      ctx.fillStyle = hueColor(a.hue, baseA * Math.max(0.05, particleAlpha));
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
