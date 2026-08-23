/* guardian-head.js — hero dust → mesh → glass robot morph */
(function () {
  'use strict';
  var canvas = document.getElementById('guardian-head');
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dpr = Math.min(Math.max(window.devicePixelRatio || 1, 2.5), 4);
  var cssW = 640;
  var cssH = 800;
  var scale = dpr;
  var PERIOD = 22;
  var points = [];
  var facets = [];
  var raf = 0;
  var t0 = 0;
  var visible = true;
  var robotImg = new Image();
  var robotReady = false;
  robotImg.onload = function () { robotReady = true; };
  robotImg.src = '/robot.jpg';

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function roundedRectPath(x, y, w, h, r) {
    var rr = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  function seed(n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var t = Math.random() * Math.PI * 2;
      var r = Math.sqrt(Math.random());
      var ex = Math.cos(t) * r;
      var ey = Math.sin(t) * r;
      out.push({
        x: ex,
        y: ey * (0.95 + Math.random() * 0.2),
        z: Math.random(),
        drift: (Math.random() - 0.5) * 0.35,
        pulse: Math.random() * Math.PI * 2
      });
    }
    return out;
  }

  function buildFacets(pts, maxEdges) {
    var edges = [];
    var cell = 0.12;
    for (var i = 0; i < pts.length; i++) {
      for (var j = i + 1; j < pts.length; j++) {
        var dx = pts[i].x - pts[j].x;
        var dy = pts[i].y - pts[j].y;
        var d2 = dx * dx + dy * dy;
        if (d2 < cell * cell) edges.push({ a: i, b: j, d2: d2 });
      }
    }
    edges.sort(function (a, b) { return a.d2 - b.d2; });
    if (edges.length > maxEdges) edges.length = maxEdges;
    return edges;
  }

  function getWeights(pct) {
    if (reduce) return { dust: 0, mesh: 0, robot: 1, ma: 1 };
    var w = { dust: 0, mesh: 0, robot: 0, ma: 0 };
    if (pct < 0.14) {
      w.dust = 1;
    } else if (pct < 0.26) {
      var t = (pct - 0.14) / 0.12;
      w.dust = 1 - t;
      w.mesh = t;
    } else if (pct < 0.40) {
      w.mesh = 1;
    } else if (pct < 0.52) {
      var m = (pct - 0.40) / 0.12;
      w.mesh = 1 - m;
      w.robot = m;
    } else if (pct < 0.82) {
      w.robot = 1;
    } else {
      var d = (pct - 0.82) / 0.18;
      w.robot = 1 - d;
      w.dust = d;
    }
    w.ma = clamp(w.mesh + w.robot, 0, 1);
    return w;
  }

  function drawParticles(cx, cy, rx, ry, w, now) {
    var particleAlpha = 1 - w.ma * 0.60 - w.robot * 0.55;
    particleAlpha = clamp(particleAlpha, 0.03, 1);
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      var pulse = 0.5 + 0.5 * Math.sin(now * 0.0018 + p.pulse);
      var dustSpread = 1 + w.dust * 0.34;
      var x = cx + p.x * rx * dustSpread + Math.sin(now * 0.001 + p.pulse) * p.drift * 10;
      var y = cy + p.y * ry * dustSpread + Math.cos(now * 0.0012 + p.pulse) * p.drift * 10;
      var r = 0.7 + p.z * 1.9 + w.mesh * 0.2;
      var a = particleAlpha * (0.35 + pulse * 0.65);
      var g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.5);
      g.addColorStop(0, 'rgba(210,246,255,' + (a * 0.9).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(95,208,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(168,231,255,' + (a * 0.8).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMesh(cx, cy, rx, ry, alpha, now) {
    if (alpha <= 0.001) return;
    for (var i = 0; i < facets.length; i++) {
      var e = facets[i];
      var a = points[e.a], b = points[e.b];
      var ax = cx + a.x * rx;
      var ay = cy + a.y * ry;
      var bx = cx + b.x * rx;
      var by = cy + b.y * ry;
      var pulse = 0.55 + 0.45 * Math.sin(now * 0.0012 + a.pulse + b.pulse);
      ctx.strokeStyle = 'rgba(155,123,255,' + (alpha * 0.34 * pulse).toFixed(3) + ')';
      ctx.lineWidth = 0.6 + pulse * 0.9;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
  }

  function drawRobotHead(cx, cy, rx, ry, alpha) {
    if (alpha <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);

    var shell = ctx.createRadialGradient(-rx * 0.28, -ry * 0.45, rx * 0.1, 0, 0, ry * 1.05);
    shell.addColorStop(0, 'rgba(233,249,255,0.96)');
    shell.addColorStop(0.45, 'rgba(148,220,252,0.54)');
    shell.addColorStop(0.75, 'rgba(64,121,170,0.34)');
    shell.addColorStop(1, 'rgba(20,35,56,0.42)');
    ctx.fillStyle = shell;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(246,252,255,0.92)';
    ctx.lineWidth = Math.max(1.4, rx * 0.02);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.985, ry * 0.985, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(95,208,255,0.96)';
    ctx.lineWidth = Math.max(1.2, rx * 0.015);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.935, ry * 0.935, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(10,19,32,0.84)';
    roundedRectPath(-rx * 0.56, -ry * 0.24, rx * 1.12, ry * 0.78, rx * 0.14);
    ctx.fill();

    ctx.strokeStyle = 'rgba(126,206,243,0.34)';
    ctx.lineWidth = Math.max(1, rx * 0.01);
    ctx.beginPath();
    ctx.moveTo(-rx * 0.45, -ry * 0.05);
    ctx.lineTo(rx * 0.45, -ry * 0.05);
    ctx.moveTo(0, -ry * 0.21);
    ctx.lineTo(0, ry * 0.45);
    ctx.moveTo(-rx * 0.45, ry * 0.22);
    ctx.lineTo(rx * 0.45, ry * 0.22);
    ctx.stroke();

    var shine = ctx.createLinearGradient(-rx * 0.9, -ry * 0.9, rx * 0.1, ry * 0.2);
    shine.addColorStop(0, 'rgba(255,255,255,0.64)');
    shine.addColorStop(0.35, 'rgba(206,246,255,0.28)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.ellipse(-rx * 0.18, -ry * 0.2, rx * 0.45, ry * 0.35, -0.35, 0, Math.PI * 2);
    ctx.fill();

    function eye(dir) {
      var ex = dir * rx * 0.32;
      var ey = -ry * 0.02;
      var glow = ctx.createRadialGradient(ex, ey, 0, ex, ey, rx * 0.2);
      glow.addColorStop(0, 'rgba(160,245,255,0.95)');
      glow.addColorStop(0.45, 'rgba(95,208,255,0.75)');
      glow.addColorStop(1, 'rgba(95,208,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ex, ey, rx * 0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(181,249,255,0.98)';
      ctx.beginPath();
      ctx.ellipse(ex, ey, rx * 0.11, ry * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(88,220,255,0.95)';
      ctx.beginPath();
      ctx.ellipse(ex, ey, rx * 0.07, ry * 0.045, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(8,16,28,0.9)';
      ctx.beginPath();
      ctx.arc(ex, ey, rx * 0.028, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(ex - rx * 0.02, ey - ry * 0.02, rx * 0.012, 0, Math.PI * 2);
      ctx.fill();
    }
    eye(-1);
    eye(1);

    var chin = ctx.createLinearGradient(-rx * 0.2, ry * 0.42, rx * 0.2, ry * 0.52);
    chin.addColorStop(0, 'rgba(255,228,154,0.85)');
    chin.addColorStop(1, 'rgba(199,140,48,0.72)');
    ctx.fillStyle = chin;
    roundedRectPath(-rx * 0.2, ry * 0.41, rx * 0.4, ry * 0.11, ry * 0.05);
    ctx.fill();

    ctx.restore();
  }

  function drawRobotPhoto(cx, cy, rx, ry, alpha) {
    if (!robotReady || alpha <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = alpha * 0.62;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.98, ry * 0.98, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(robotImg, cx - rx, cy - ry, rx * 2, ry * 2);
    ctx.restore();
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    cssW = Math.max(1, rect.width | 0);
    cssH = Math.max(1, rect.height | 0);
    dpr = Math.min(Math.max(window.devicePixelRatio || 1, 2.5), 4);
    scale = Math.min(4, Math.max(dpr, 1600 / Math.max(cssW, cssH)));
    canvas.width = Math.round(cssW * scale);
    canvas.height = Math.round(cssH * scale);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }

  function draw(now) {
    ctx.clearRect(0, 0, cssW, cssH);
    var pct = reduce ? 0.6 : ((now * 0.001) % PERIOD) / PERIOD;
    var w = getWeights(pct);
    var cx = cssW * 0.5;
    var cy = cssH * 0.52;
    var rx = cssW * 0.28;
    var ry = cssH * 0.32;

    drawParticles(cx, cy, rx, ry, w, now);
    drawMesh(cx, cy, rx, ry, w.mesh, now);
    drawRobotHead(cx, cy, rx, ry, w.robot);
    drawRobotPhoto(cx, cy, rx, ry, w.robot);
  }

  function frame(now) {
    if (!visible) return;
    var dt = t0 ? Math.min((now - t0) / 1000, 0.05) : 0.016;
    t0 = now;
    for (var i = 0; i < points.length; i++) points[i].pulse += dt * 0.8;
    draw(now);
    if (!reduce) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (raf) return;
    t0 = 0;
    if (reduce) {
      draw(performance.now());
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function init() {
    points = seed(640);
    facets = buildFacets(points, 160);
    resize();
    draw(performance.now());
  }

  init();
  window.addEventListener('resize', function () {
    resize();
    draw(performance.now());
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visible = entry.isIntersecting;
        if (visible) start();
        else stop();
      });
    }, { threshold: 0.08 }).observe(canvas);
  }
  start();
})();