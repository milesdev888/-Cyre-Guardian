/* guardian-head.js — dust → purple mesh → glass robot → dust morph cycle
   Cycle ~20 s: 0-18% DUST | 18-32% dust→mesh | 32-48% MESH | 48-62% mesh→robot
                62-78% ROBOT | 78-100% robot→dust
   prefers-reduced-motion → static mesh. Portrait popout stays photo (FAB). */
(function () {
  var canvas = document.getElementById('guardian-head');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 640, H = 800, points = [], facets = [];
  var t0 = performance.now(), raf = 0, visible = true;
  var robotImg = null, robotReady = false;

  // Violet-heavy palette; cyan accents; sparse gold (~10%)
  var COL = {
    cyan:   [95,  208, 255],
    violet: [155, 123, 255],
    dviolet:[112,  72, 220],
    gold:   [212, 168, 75]
  };

  function pickHue() {
    var r = Math.random();
    if (r < 0.10) return 3;   // gold (sparse ~10%)
    if (r < 0.30) return 0;   // cyan accent (~20%)
    if (r < 0.62) return 1;   // violet (~32%)
    return 2;                  // deep violet (~38%)
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

  /* ── DUST particle seed ─────────────────────────────────────────────── */
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
      // Dust scatter offset — particles drift outward in dust phase
      var ds = 0.28 + Math.random() * 0.55;
      var da = Math.random() * Math.PI * 2;
      out.push({
        x: x, y: y, z: z,
        // mesh target (compact head position)
        gx: x * (0.96 + (Math.random() - 0.5) * 0.08),
        gy: y * (0.98 + (Math.random() - 0.5) * 0.06),
        gz: z * (1.02 + (Math.random() - 0.5) * 0.1),
        // dust scatter offset
        dx: x + Math.cos(da) * ds,
        dy: y + Math.sin(da) * ds * 0.55,
        dz: z + (Math.random() - 0.5) * ds * 0.7,
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
  facets = buildFacets(points, 120);

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

  /* ── PHASE CALCULATION ──────────────────────────────────────────────────
     Cycle period = 20 s
     Returns { dust, mesh, robot } each 0-1 (sum = 1 at any moment)

     0–18%  (0–3.6s)  : pure dust
     18–32% (3.6–6.4s): dust→mesh transition
     32–48% (6.4–9.6s): pure mesh
     48–62% (9.6–12.4s): mesh→robot
     62–78% (12.4–15.6s): pure robot
     78–100%(15.6–20s): robot→dust
  */
  var PERIOD = 20;
  function phaseWeights(elapsed) {
    if (reduce) return { dust: 0, mesh: 1, robot: 0 }; // static mesh
    var p = (elapsed % PERIOD) / PERIOD;
    var dust, mesh, robot;
    if (p < 0.18) {
      dust = 1; mesh = 0; robot = 0;
    } else if (p < 0.32) {
      var t = smoothstep((p - 0.18) / 0.14);
      dust = 1 - t; mesh = t; robot = 0;
    } else if (p < 0.48) {
      dust = 0; mesh = 1; robot = 0;
    } else if (p < 0.62) {
      var t = smoothstep((p - 0.48) / 0.14);
      dust = 0; mesh = 1 - t; robot = t;
    } else if (p < 0.78) {
      dust = 0; mesh = 0; robot = 1;
    } else {
      var t = smoothstep((p - 0.78) / 0.22);
      dust = t; mesh = 0; robot = 1 - t;
    }
    return { dust: dust, mesh: mesh, robot: robot };
  }

  /* overall morph-to-head = mesh + robot (both phases need head position) */
  function meshAmount(w) { return w.mesh + w.robot; }

  function projectPoint(p, rot, breathe, w) {
    var ma = meshAmount(w);
    // dust scatter position → mesh/robot head position (single blend on ma)
    var x0 = lerp(p.dx, p.gx, ma);
    var y0 = lerp(p.dy, p.gy, ma);
    var z0 = lerp(p.dz, p.gz, ma);
    if (ma > 0) {
      y0 *= 1 + ma * 0.04;
      if (y0 < -0.1) { x0 *= 1 - ma * 0.12; z0 *= 1 - ma * 0.08; }
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

  /* ── DUST DRAW ──────────────────────────────────────────────────────── */
  function drawDustGlow(w) {
    if (w.dust < 0.05) return;
    var g = ctx.createRadialGradient(W * 0.5, H * 0.48, 5, W * 0.5, H * 0.5, W * 0.52);
    g.addColorStop(0, 'rgba(112,72,220,' + (0.10 * w.dust).toFixed(3) + ')');
    g.addColorStop(0.5, 'rgba(155,123,255,' + (0.06 * w.dust).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(5,8,18,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  /* ── MESH (glass silhouette + violet wireframe) ───────────────────────── */
  function drawMeshSilhouette(w) {
    var m = w.mesh;
    if (m < 0.05) return;
    var cx = W * 0.5, cy = H * 0.46, rx = W * 0.26, ry = H * 0.30;
    ctx.save(); ctx.translate(cx, cy);
    var g = ctx.createLinearGradient(-rx, -ry, rx, ry);
    g.addColorStop(0, 'rgba(112,72,220,' + (0.12 * m).toFixed(3) + ')');
    g.addColorStop(0.45, 'rgba(155,123,255,' + (0.10 * m).toFixed(3) + ')');
    g.addColorStop(0.72, 'rgba(95,208,255,' + (0.07 * m).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(212,168,75,' + (0.04 * m).toFixed(3) + ')');
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    // violet rim
    ctx.strokeStyle = 'rgba(155,123,255,' + (0.55 * m).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1, dpr * 1.2);
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    // cyan highlight
    ctx.strokeStyle = 'rgba(95,208,255,' + (0.30 * m).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1, dpr * 0.9);
    ctx.beginPath(); ctx.moveTo(-rx * 0.55, -ry * 0.08);
    ctx.quadraticCurveTo(0, -ry * 0.22, rx * 0.55, -ry * 0.08); ctx.stroke();
    ctx.restore();
  }

  /* ── ROBOT (solid glass/metal head + cyan glowing eyes + optional crossfade) */
  function drawRobotHead(w) {
    var r = w.robot;
    if (r < 0.05) return;
    var cx = W * 0.5, cy = H * 0.46, rx = W * 0.26, ry = H * 0.30;
    ctx.save(); ctx.translate(cx, cy);
    // Solid glass-metal fill
    var g = ctx.createLinearGradient(-rx, -ry, rx, ry);
    g.addColorStop(0, 'rgba(30,18,60,' + (0.82 * r).toFixed(3) + ')');
    g.addColorStop(0.4, 'rgba(50,35,90,' + (0.78 * r).toFixed(3) + ')');
    g.addColorStop(0.75, 'rgba(20,10,45,' + (0.88 * r).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(8,5,20,' + (0.95 * r).toFixed(3) + ')');
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    // Metal rim
    ctx.strokeStyle = 'rgba(155,123,255,' + (0.7 * r).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1.5, dpr * 2);
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    // Specular highlight
    ctx.beginPath(); ctx.ellipse(-rx * 0.28, -ry * 0.32, rx * 0.18, ry * 0.42, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(238,250,255,' + (0.12 * r).toFixed(3) + ')'; ctx.fill();
    // Cyan glowing eyes
    var eyeY = -ry * 0.05;
    var eyeRx = rx * 0.13, eyeRy = ry * 0.07;
    [-0.34, 0.34].forEach(function (ex) {
      var ex2 = rx * ex;
      // Eye glow halo
      var eg = ctx.createRadialGradient(ex2, eyeY, 0, ex2, eyeY, eyeRx * 3.5);
      eg.addColorStop(0, 'rgba(95,208,255,' + (0.55 * r).toFixed(3) + ')');
      eg.addColorStop(0.45, 'rgba(95,208,255,' + (0.18 * r).toFixed(3) + ')');
      eg.addColorStop(1, 'rgba(95,208,255,0)');
      ctx.beginPath(); ctx.ellipse(ex2, eyeY, eyeRx * 3.5, eyeRy * 3.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = eg; ctx.fill();
      // Eye lens
      ctx.beginPath(); ctx.ellipse(ex2, eyeY, eyeRx, eyeRy, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(95,208,255,' + (0.85 * r).toFixed(3) + ')'; ctx.fill();
      // Pupil
      ctx.beginPath(); ctx.ellipse(ex2, eyeY, eyeRx * 0.42, eyeRy * 0.48, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(5,8,18,' + (0.9 * r).toFixed(3) + ')'; ctx.fill();
    });
    // Chin line
    ctx.strokeStyle = 'rgba(212,168,75,' + (0.22 * r).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1, dpr * 1.1);
    ctx.beginPath(); ctx.moveTo(-rx * 0.35, ry * 0.18);
    ctx.quadraticCurveTo(0, ry * 0.28, rx * 0.35, ry * 0.18); ctx.stroke();
    ctx.restore();
  }

  function drawRobotCrossfade(w) {
    if (!robotReady || !robotImg || w.robot < 0.15) return;
    var alpha = Math.pow(clamp((w.robot - 0.15) / 0.85, 0, 1), 1.15) * 0.38;
    var iw = robotImg.naturalWidth || 600, ih = robotImg.naturalHeight || 600;
    var size = Math.min(W, H) * 0.72, dw = size, dh = size * (ih / iw);
    if (dh > H * 0.78) { dh = H * 0.78; dw = dh * (iw / ih); }
    var dx = (W - dw) * 0.5, dy = H * 0.12;
    ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'screen';
    ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.46, dw * 0.42, dh * 0.48, 0, 0, Math.PI * 2);
    ctx.clip(); ctx.drawImage(robotImg, dx, dy, dw, dh); ctx.restore();
  }

  /* ── VIOLET WIREFRAME FACETS ─────────────────────────────────────────── */
  function drawFacets(projected, w) {
    var m = w.mesh + w.robot * 0.5;
    if (m < 0.08) return;
    var i, f, a, b, c, alpha;
    ctx.lineWidth = Math.max(0.7, dpr * (0.75 + m * 0.65));
    for (i = 0; i < facets.length; i++) {
      f = facets[i]; a = projected[f.i0]; b = projected[f.i1]; c = projected[f.i2];
      if (!a || !b || !c) continue;
      alpha = m * 0.24 * Math.min(a.a, b.a, c.a);
      // Violet-dominant facet fill
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath();
      ctx.fillStyle = 'rgba(112,72,220,' + (alpha * 0.30).toFixed(3) + ')'; ctx.fill();
      ctx.strokeStyle = hueColor(f.hue, alpha * 1.5); ctx.stroke();
    }
  }

  /* ── MAIN DRAW ──────────────────────────────────────────────────────── */
  function drawFrame(now) {
    var elapsed = (now - t0) / 1000;
    var w = phaseWeights(elapsed);
    var ma = meshAmount(w);
    var rot = reduce ? 0.35 : Math.sin(elapsed * 0.22) * 0.55 + elapsed * 0.08;
    var breathe = reduce ? 1 : 1 + Math.sin(elapsed * 0.9) * 0.018;
    var projected = [], i, j, a, b, dx, dy, dist, alpha, col;
    var particleAlpha = 1 - ma * 0.60;
    var linkAlphaScale = 1 - ma * 0.40;

    ctx.clearRect(0, 0, W, H);

    // Ambient background glow — violet-dominant
    var g = ctx.createRadialGradient(W * 0.5, H * 0.42, 10, W * 0.5, H * 0.48, W * 0.44);
    g.addColorStop(0, 'rgba(112,72,220,' + (0.14 + ma * 0.08).toFixed(3) + ')');
    g.addColorStop(0.35, 'rgba(155,123,255,' + (0.08 + ma * 0.04).toFixed(3) + ')');
    g.addColorStop(0.65, 'rgba(95,208,255,' + (0.04 + ma * 0.02).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(5,8,18,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    for (i = 0; i < points.length; i++) projected.push(projectPoint(points[i], rot, breathe, w));

    drawDustGlow(w);
    drawMeshSilhouette(w);
    drawFacets(projected, w);
    drawRobotHead(w);
    drawRobotCrossfade(w);

    // Particle links
    ctx.lineWidth = Math.max(0.6, dpr * (0.7 + ma * 0.35));
    var maxDist = (32 - ma * 6) * dpr, step = ma > 0.55 ? 2 : 1;
    for (i = 0; i < projected.length; i += step) {
      a = projected[i]; var linked = 0;
      for (j = i + 1; j < projected.length && linked < 8; j++) {
        b = projected[j]; dx = a.x - b.x; if (dx > maxDist || dx < -maxDist) continue;
        dy = a.y - b.y; if (dy > maxDist || dy < -maxDist) continue;
        dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxDist || dist < 2) continue;
        alpha = (1 - dist / maxDist) * Math.min(a.a, b.a) * 0.52 * linkAlphaScale;
        if (a.hue === 3 || b.hue === 3) col = rgba(COL.gold, alpha * 0.75);
        else if (a.hue === 0 || b.hue === 0) col = rgba(COL.cyan, alpha);
        else col = rgba(COL.violet, alpha * 1.1);
        ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        linked++;
      }
    }

    // Particles
    for (i = 0; i < projected.length; i++) {
      a = projected[i];
      var sz = a.s * (1.1 + dpr * 0.35);
      if (ma > 0.35) sz *= 1 - ma * 0.25;
      var baseA = (a.hue === 3 ? 0.5 : 0.38) + a.a * 0.52;
      ctx.beginPath(); ctx.fillStyle = hueColor(a.hue, baseA * particleAlpha);
      if (ma > 0.5 && a.facet > 0.72) {
        var sp = sz * (1.1 + ma * 0.4);
        ctx.moveTo(a.x, a.y - sp); ctx.lineTo(a.x + sp * 0.7, a.y);
        ctx.lineTo(a.x, a.y + sp); ctx.lineTo(a.x - sp * 0.7, a.y); ctx.closePath(); ctx.fill();
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
