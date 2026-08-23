/* guardian-head.js — cyan/violet/gold particle head → glass robot morph
   prefers-reduced-motion → static particle frame. Portrait stays in FAB. */
(function () {
  var canvas = document.getElementById('guardian-head');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 640, H = 800, points = [], facets = [];
  var t0 = performance.now(), raf = 0, visible = true;
  var robotImg = null, robotReady = false;
  var COL = { cyan: [95, 208, 255], violet: [155, 123, 255], gold: [212, 168, 75] };

  function pickHue() {
    var r = Math.random();
    if (r < 0.10) return 2;
    if (r < 0.52) return 0;
    return 1;
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function hueColor(hue, a) {
    return rgba(hue === 2 ? COL.gold : hue === 1 ? COL.violet : COL.cyan, a);
  }
  function dist3(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

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
      out.push({
        x: x, y: y, z: z,
        gx: x * (0.96 + (Math.random() - 0.5) * 0.08),
        gy: y * (0.98 + (Math.random() - 0.5) * 0.06),
        gz: z * (1.02 + (Math.random() - 0.5) * 0.1),
        hue: pickHue(), s: 0.7 + Math.random() * 1.4, facet: Math.random()
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

  points = seed(480);
  facets = buildFacets(points, 90);
  try {
    robotImg = new Image();
    robotImg.decoding = 'async';
    robotImg.onload = function () { robotReady = true; };
    robotImg.onerror = function () { robotReady = false; };
    robotImg.src = '/robot.jpg';
  } catch (e) { robotReady = false; }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    W = Math.max(1, Math.floor(rect.width * dpr));
    H = Math.max(1, Math.floor(rect.height * dpr));
    canvas.width = W; canvas.height = H;
  }

  function morphAmount(elapsed) {
    if (reduce) return 0;
    var phase = (elapsed % 14) / 14;
    if (phase < 0.22) return 0;
    if (phase < 0.42) return smoothstep((phase - 0.22) / 0.20);
    if (phase < 0.62) return 1;
    if (phase < 0.88) return 1 - smoothstep((phase - 0.62) / 0.26);
    return 0;
  }

  function projectPoint(p, rot, breathe, morph) {
    var x0 = lerp(p.x, p.gx, morph), y0 = lerp(p.y, p.gy, morph), z0 = lerp(p.z, p.gz, morph);
    if (morph > 0) {
      y0 *= 1 + morph * 0.04;
      if (y0 < -0.1) { x0 *= 1 - morph * 0.12; z0 *= 1 - morph * 0.08; }
    }
    var c = Math.cos(rot), s = Math.sin(rot);
    var x = x0 * c - z0 * s, z = x0 * s + z0 * c, y = y0 * breathe;
    var persp = 2.6 / (2.6 + z);
    return {
      x: W * 0.5 + x * persp * W * 0.38,
      y: H * 0.48 + y * persp * H * 0.34,
      z: z, a: Math.max(0.12, Math.min(1, (z + 1.1) / 1.8)),
      hue: p.hue, s: p.s * persp, facet: p.facet
    };
  }

  function drawGlassSilhouette(morph, rot) {
    if (morph < 0.05) return;
    var cx = W * 0.5, cy = H * 0.46, rx = W * 0.26, ry = H * 0.30;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot * 0.15);
    var g = ctx.createLinearGradient(-rx, -ry, rx, ry);
    g.addColorStop(0, 'rgba(95,208,255,' + (0.08 * morph).toFixed(3) + ')');
    g.addColorStop(0.45, 'rgba(238,250,255,' + (0.10 * morph).toFixed(3) + ')');
    g.addColorStop(0.72, 'rgba(155,123,255,' + (0.07 * morph).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(212,168,75,' + (0.05 * morph).toFixed(3) + ')');
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.ellipse(-rx * 0.28, -ry * 0.32, rx * 0.18, ry * 0.42, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(238,250,255,' + (0.14 * morph).toFixed(3) + ')'; ctx.fill();
    ctx.strokeStyle = 'rgba(95,208,255,' + (0.35 * morph).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1, dpr * 1.1);
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(155,123,255,' + (0.45 * morph).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1.2, dpr * 1.4);
    ctx.beginPath(); ctx.moveTo(-rx * 0.55, -ry * 0.08);
    ctx.quadraticCurveTo(0, -ry * 0.22, rx * 0.55, -ry * 0.08); ctx.stroke();
    ctx.strokeStyle = rgba(COL.gold, 0.22 * morph);
    ctx.beginPath(); ctx.moveTo(-rx * 0.35, ry * 0.18);
    ctx.quadraticCurveTo(0, ry * 0.28, rx * 0.35, ry * 0.18); ctx.stroke();
    ctx.restore();
  }

  function drawRobotCrossfade(morph) {
    if (!robotReady || !robotImg || morph < 0.15) return;
    var alpha = Math.pow(Math.max(0, (morph - 0.15) / 0.85), 1.15) * 0.42;
    var iw = robotImg.naturalWidth || 600, ih = robotImg.naturalHeight || 600;
    var size = Math.min(W, H) * 0.72, dw = size, dh = size * (ih / iw);
    if (dh > H * 0.78) { dh = H * 0.78; dw = dh * (iw / ih); }
    var dx = (W - dw) * 0.5, dy = H * 0.12;
    ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'screen';
    ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.46, dw * 0.42, dh * 0.48, 0, 0, Math.PI * 2);
    ctx.clip(); ctx.drawImage(robotImg, dx, dy, dw, dh); ctx.restore();
    ctx.save(); ctx.globalAlpha = alpha * 0.55;
    var frost = ctx.createRadialGradient(W * 0.5, H * 0.4, 8, W * 0.5, H * 0.48, dw * 0.5);
    frost.addColorStop(0, 'rgba(238,250,255,0.18)');
    frost.addColorStop(0.55, 'rgba(95,208,255,0.08)');
    frost.addColorStop(1, 'rgba(5,8,18,0)');
    ctx.fillStyle = frost; ctx.fillRect(0, 0, W, H); ctx.restore();
  }

  function drawFacets(projected, morph) {
    if (morph < 0.08) return;
    var i, f, a, b, c, alpha;
    ctx.lineWidth = Math.max(0.7, dpr * (0.75 + morph * 0.55));
    for (i = 0; i < facets.length; i++) {
      f = facets[i]; a = projected[f.i0]; b = projected[f.i1]; c = projected[f.i2];
      if (!a || !b || !c) continue;
      alpha = morph * 0.22 * Math.min(a.a, b.a, c.a);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath();
      ctx.fillStyle = hueColor(f.hue, alpha * 0.35); ctx.fill();
      ctx.strokeStyle = hueColor(f.hue, alpha * 1.4); ctx.stroke();
    }
  }

  function drawFrame(now) {
    var elapsed = (now - t0) / 1000;
    var morph = morphAmount(elapsed);
    var rot = reduce ? 0.35 : Math.sin(elapsed * 0.22) * 0.55 + elapsed * 0.08;
    var breathe = reduce ? 1 : 1 + Math.sin(elapsed * 0.9) * 0.018;
    var projected = [], i, j, a, b, dx, dy, dist, alpha, col;
    var particleAlpha = 1 - morph * 0.55, linkAlphaScale = 1 - morph * 0.35;
    ctx.clearRect(0, 0, W, H);
    var g = ctx.createRadialGradient(W * 0.5, H * 0.42, 10, W * 0.5, H * 0.48, W * 0.42);
    g.addColorStop(0, 'rgba(95,208,255,' + (0.16 + morph * 0.06).toFixed(3) + ')');
    g.addColorStop(0.4, 'rgba(155,123,255,' + (0.08 + morph * 0.04).toFixed(3) + ')');
    g.addColorStop(0.7, 'rgba(212,168,75,' + (0.04 * morph).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(5,8,18,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (i = 0; i < points.length; i++) projected.push(projectPoint(points[i], rot, breathe, morph));
    drawGlassSilhouette(morph, rot); drawFacets(projected, morph); drawRobotCrossfade(morph);
    ctx.lineWidth = Math.max(0.6, dpr * (0.7 + morph * 0.35));
    var maxDist = (32 - morph * 6) * dpr, step = morph > 0.55 ? 2 : 1;
    for (i = 0; i < projected.length; i += step) {
      a = projected[i]; var linked = 0;
      for (j = i + 1; j < projected.length && linked < 8; j++) {
        b = projected[j]; dx = a.x - b.x; if (dx > maxDist || dx < -maxDist) continue;
        dy = a.y - b.y; if (dy > maxDist || dy < -maxDist) continue;
        dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxDist || dist < 2) continue;
        alpha = (1 - dist / maxDist) * Math.min(a.a, b.a) * 0.58 * linkAlphaScale;
        if (a.hue === 2 || b.hue === 2) col = rgba(COL.gold, alpha * 0.85);
        else if ((a.hue + b.hue) > 0) col = rgba(COL.violet, alpha);
        else col = rgba(COL.cyan, alpha);
        if (morph > 0.4 && Math.min(a.a, b.a) > 0.7)
          col = 'rgba(238,250,255,' + (alpha * (0.35 + morph * 0.45)).toFixed(3) + ')';
        ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        linked++;
      }
    }
    for (i = 0; i < projected.length; i++) {
      a = projected[i];
      var sz = a.s * (1.1 + dpr * 0.35);
      if (morph > 0.35) sz *= 1 - morph * 0.25;
      var baseA = (a.hue === 2 ? 0.5 : 0.4) + a.a * 0.55;
      ctx.beginPath(); ctx.fillStyle = hueColor(a.hue, baseA * particleAlpha);
      if (morph > 0.5 && a.facet > 0.72) {
        var s = sz * (1.1 + morph * 0.4);
        ctx.moveTo(a.x, a.y - s); ctx.lineTo(a.x + s * 0.7, a.y);
        ctx.lineTo(a.x, a.y + s); ctx.lineTo(a.x - s * 0.7, a.y); ctx.closePath(); ctx.fill();
        if (a.hue === 2 || morph > 0.75) {
          ctx.fillStyle = 'rgba(238,250,255,' + (0.25 * morph * a.a).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(a.x - s * 0.15, a.y - s * 0.2, s * 0.22, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        ctx.arc(a.x, a.y, sz, 0, Math.PI * 2); ctx.fill();
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
