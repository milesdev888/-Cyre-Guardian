/* guardian-cortex.js — dense sapphire neural graph behind the Guardian core.
   Inspired by neural-graph / vault visualizations: clusters, edges, live HUD.
   Draws #guardian-cortex inside .orb-stage. Keeps perfect-circle orbit + nodes. */
(function () {
  var stage = document.querySelector('.orb-stage');
  if (!stage) return;

  var canvas = document.getElementById('guardian-cortex');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'guardian-cortex';
    canvas.setAttribute('aria-hidden', 'true');
    stage.insertBefore(canvas, stage.firstChild);
  }
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dpr = 2, W = 0, H = 0, t0 = performance.now(), raf = 0, visible = true;
  var nodes = [], edges = [], clusters = [];

  var COL = {
    deep: [18, 72, 190],
    mid: [72, 140, 255],
    ice: [186, 224, 255],
    soft: [140, 120, 220]
  };

  var LABELS = [
    { name: 'scan signals', a: -2.2, r: 0.55 },
    { name: 'watch stream', a: 2.4, r: 0.58 },
    { name: 'oracle feed', a: -1.4, r: 0.5 },
    { name: 'risk gate', a: -0.4, r: 0.62 },
    { name: 'score card', a: 0.5, r: 0.56 },
    { name: 'rwa pulse', a: 1.3, r: 0.52 },
    { name: 'swap route', a: 2.0, r: 0.48 },
    { name: 'forensics', a: -2.8, r: 0.46 }
  ];

  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function seed() {
    nodes = []; edges = []; clusters = [];
    var i, j, k, cx, cy, n, p, q;

    for (k = 0; k < LABELS.length; k++) {
      var L = LABELS[k];
      cx = Math.cos(L.a) * L.r;
      cy = Math.sin(L.a) * L.r * 0.9;
      clusters.push({ x: cx, y: cy, name: L.name, n: 55 + ((Math.random() * 40) | 0) });
    }
    /* Bright core cluster */
    clusters.push({ x: 0, y: 0, name: '', n: 180 });

    for (k = 0; k < clusters.length; k++) {
      var c = clusters[k];
      for (i = 0; i < c.n; i++) {
        var ang = Math.random() * Math.PI * 2;
        var rr = Math.pow(Math.random(), 0.55) * (c.name ? 0.12 : 0.28);
        nodes.push({
          x: c.x + Math.cos(ang) * rr,
          y: c.y + Math.sin(ang) * rr * 0.95,
          z: rand(-0.35, 0.55),
          s: rand(0.4, 1.35),
          hue: Math.random() < 0.15 ? 0 : Math.random() < 0.55 ? 1 : (Math.random() < 0.85 ? 2 : 3),
          spark: Math.random(),
          drift: rand(0.2, 1)
        });
      }
    }

    /* Sparse field fill */
    for (i = 0; i < 220; i++) {
      var u = Math.random() * Math.PI * 2;
      var vr = Math.pow(Math.random(), 0.7) * 0.85;
      nodes.push({
        x: Math.cos(u) * vr,
        y: Math.sin(u) * vr * 0.92,
        z: rand(-0.4, 0.5),
        s: rand(0.25, 0.85),
        hue: Math.random() < 0.5 ? 1 : 2,
        spark: Math.random() * 0.6,
        drift: rand(0.15, 0.8)
      });
    }

    for (i = 0; i < nodes.length; i++) {
      p = nodes[i];
      var linked = 0;
      for (j = i + 1; j < nodes.length && linked < 3; j++) {
        q = nodes[j];
        var dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z;
        var d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 0.035) {
          edges.push({ a: i, b: j, w: 1 - Math.sqrt(d2) / 0.19 });
          linked++;
        }
      }
    }
  }

  function resize() {
    var rect = stage.getBoundingClientRect();
    dpr = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
    W = Math.max(1, Math.floor(rect.width * dpr));
    H = Math.max(1, Math.floor(rect.height * dpr));
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
  }

  function project(x, y, z, scale, rot) {
    var c = Math.cos(rot), s = Math.sin(rot);
    var xr = x * c - z * s;
    var zr = x * s + z * c;
    var persp = 2.5 / (2.5 + zr);
    return {
      x: W * 0.5 + xr * persp * scale,
      y: H * 0.5 + y * persp * scale,
      a: Math.max(0.08, Math.min(1, (zr + 1.1) / 1.8)),
      p: persp
    };
  }

  function drawFrame(now) {
    var elapsed = (now - t0) / 1000;
    var rot = reduce ? 0.25 : elapsed * 0.08;
    var breathe = reduce ? 1 : 1 + Math.sin(elapsed * 0.7) * 0.018;
    var scale = Math.max(40, Math.min(W, H) * 0.42 * breathe);
    var i, e, a, b, p, q, col, sz, pa;

    ctx.clearRect(0, 0, W, H);

    /* Soft sapphire nebula wash — no hard ring bands */
    var g = ctx.createRadialGradient(W * 0.5, H * 0.48, scale * 0.08, W * 0.5, H * 0.5, scale * 1.05);
    g.addColorStop(0, 'rgba(186,224,255,0.14)');
    g.addColorStop(0.55, 'rgba(72,140,255,0.06)');
    g.addColorStop(1, 'rgba(8,6,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.5, scale * 1.05, 0, Math.PI * 2);
    ctx.fill();

    /* Edges */
    ctx.lineWidth = Math.max(0.45, dpr * 0.35);
    for (i = 0; i < edges.length; i++) {
      e = edges[i];
      a = project(nodes[e.a].x, nodes[e.a].y, nodes[e.a].z, scale, rot);
      b = project(nodes[e.b].x, nodes[e.b].y, nodes[e.b].z, scale, rot);
      pa = e.w * Math.min(a.a, b.a) * 0.22;
      if (pa < 0.02) continue;
      ctx.strokeStyle = rgba(COL.mid, pa);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    /* Nodes */
    for (i = 0; i < nodes.length; i++) {
      p = nodes[i];
      var ox = p.x + Math.sin(elapsed * p.drift + i) * 0.008;
      var oy = p.y + Math.cos(elapsed * p.drift * 0.9 + i) * 0.007;
      q = project(ox, oy, p.z, scale, rot);
      col = p.hue === 0 ? COL.deep : p.hue === 1 ? COL.mid : p.hue === 2 ? COL.ice : COL.soft;
      sz = p.s * (0.55 + dpr * 0.28) * q.p;
      pa = (0.2 + p.spark * 0.45) * q.a;
      ctx.beginPath();
      ctx.arc(q.x, q.y, sz, 0, Math.PI * 2);
      ctx.fillStyle = rgba(col, pa);
      ctx.fill();
      if (p.spark > 0.78) {
        ctx.beginPath();
        ctx.arc(q.x, q.y, sz * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + p.spark * 0.35).toFixed(2) + ')';
        ctx.fill();
      }
    }

    /* Cluster labels */
    ctx.textAlign = 'center';
    ctx.font = (9.5 * dpr * 0.55) + 'px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    for (i = 0; i < clusters.length; i++) {
      var c = clusters[i];
      if (!c.name) continue;
      q = project(c.x, c.y, 0.05, scale, rot);
      ctx.fillStyle = 'rgba(220,235,255,0.72)';
      ctx.fillText(c.name, q.x, q.y - 14 * dpr * 0.5);
    }

    /* Tiny live HUD — top-left of stage */
    ctx.textAlign = 'left';
    ctx.font = (8 * dpr * 0.55) + 'px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.fillStyle = 'rgba(160,200,255,0.45)';
    ctx.fillText('GUARDIAN CORTEX · LIVE', 12 * dpr * 0.5, 16 * dpr * 0.5);
    ctx.fillStyle = 'rgba(120,170,255,0.32)';
    ctx.fillText('scan · watch · oracle · gate', 12 * dpr * 0.5, 28 * dpr * 0.5);
  }

  function loop(now) {
    if (!visible && !reduce) { raf = requestAnimationFrame(loop); return; }
    drawFrame(now || performance.now());
    if (!reduce) raf = requestAnimationFrame(loop);
  }

  seed();
  resize();
  drawFrame(performance.now());
  if (!reduce) raf = requestAnimationFrame(loop);
  window.addEventListener('resize', function () {
    resize();
    if (reduce) drawFrame(performance.now());
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = !!(entries[0] && entries[0].isIntersecting);
    }, { threshold: 0.05 }).observe(stage);
  }
})();
