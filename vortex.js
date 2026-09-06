/* vortex.js — Solana-colored particle mesh (purple #9945FF + green #14F195)
   Bolt-on hero background. prefers-reduced-motion → static mesh. */
(function () {
  'use strict';
  var hero = document.querySelector('.hero');
  if (!hero || document.getElementById('cy-ai-mesh')) return;

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvas = document.createElement('canvas');
  canvas.id = 'cy-ai-mesh';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;';
  if (getComputedStyle(hero).position === 'static') hero.style.position = 'relative';
  hero.style.overflow = 'hidden';
  // Keep content above mesh
  var kids = hero.children;
  for (var k = 0; k < kids.length; k++) {
    if (kids[k].style && !kids[k].style.zIndex) {
      var pos = getComputedStyle(kids[k]).position;
      if (pos === 'static') kids[k].style.position = 'relative';
      kids[k].style.zIndex = '1';
    }
  }
  hero.insertBefore(canvas, hero.firstChild);

  var ctx = canvas.getContext('2d');
  var width = 0, height = 0, dpr = 1;
  var nodes = [];
  var NODE_COUNT = 96;
  var CONNECTION_DIST = 200;
  var raf = 0;
  var t0 = 0;
  var visible = true;
  var resizeTimer = 0;

  // Solana brand — purple + green, brighter
  var COLORS = [
    { r: 153, g:  69, b: 255 },  // #9945FF Solana purple
    { r: 120, g:  40, b: 220 },  // deep purple
    { r: 176, g: 100, b: 255 },  // light purple
    { r:  20, g: 241, b: 149 },  // #14F195 Solana green
    { r:  60, g: 245, b: 175 }   // mint green accent
  ];
  var GREEN = { r: 20, g: 241, b: 149 };
  var PURPLE = { r: 153, g: 69, b: 255 };

  function resize() {
    var rect = hero.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, rect.width | 0);
    height = Math.max(1, rect.height | 0);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function Node() {
    this.reset(true);
  }
  Node.prototype.reset = function (spread) {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    var speed = reduce ? 0 : (0.18 + Math.random() * 0.28);
    var ang = Math.random() * Math.PI * 2;
    this.vx = Math.cos(ang) * speed;
    this.vy = Math.sin(ang) * speed;
    this.radius = 2.2 + Math.random() * 2.6;
    this.alpha = 0.72 + Math.random() * 0.28;
    this.pulse = Math.random() * Math.PI * 2;
    this.pulseSp = 0.8 + Math.random() * 1.4;
    var c;
    // Mostly Solana purple; green as sparse accents (~20%)
    if (Math.random() < 0.2) {
      c = GREEN;
      this.gold = true;
      this.radius = 2.4 + Math.random() * 2.4;
      this.alpha = 0.78 + Math.random() * 0.22;
    } else {
      c = COLORS[(Math.random() * 3) | 0];
      this.gold = false;
    }
    this.r = c.r; this.g = c.g; this.b = c.b;
  };
  Node.prototype.update = function (dt) {
    if (reduce) return;
    this.x += this.vx * (60 * dt);
    this.y += this.vy * (60 * dt);
    this.pulse += this.pulseSp * dt;
    // Soft wrap instead of hard bounce — feels like a living field
    if (this.x < -20) this.x = width + 20;
    if (this.x > width + 20) this.x = -20;
    if (this.y < -20) this.y = height + 20;
    if (this.y > height + 20) this.y = -20;
    // Gentle drift curve
    this.vx += (Math.random() - 0.5) * 0.01;
    this.vy += (Math.random() - 0.5) * 0.01;
    var sp = Math.sqrt(this.vx * this.vx + this.vy * this.vy) || 0.001;
    var max = 0.55;
    if (sp > max) { this.vx = this.vx / sp * max; this.vy = this.vy / sp * max; }
  };
  Node.prototype.draw = function () {
    var breath = 1 + (reduce ? 0 : 0.14 * Math.sin(this.pulse));
    var rad = this.radius * breath;
    var a = this.alpha * (0.9 + (reduce ? 0.1 : 0.14 * Math.sin(this.pulse * 0.7)));
    // Solid core + tiny hard rim — readable without soft bloom / Xmas-tree halos
    ctx.beginPath();
    ctx.arc(this.x, this.y, rad, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(' + this.r + ',' + this.g + ',' + this.b + ',' + a.toFixed(3) + ')';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.x, this.y, rad, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(' + this.r + ',' + this.g + ',' + this.b + ',' + Math.min(1, a * 0.85).toFixed(3) + ')';
    ctx.lineWidth = 1.15;
    ctx.stroke();
  };

  function targetCount() {
    return Math.min(NODE_COUNT, Math.max(36, ((width * height) / 14000) | 0));
  }

  function init() {
    nodes.length = 0;
    var n = targetCount();
    for (var i = 0; i < n; i++) nodes.push(new Node());
  }

  /* Keep the same field across viewport changes. Mobile scroll often fires
     resize (URL bar show/hide) — re-seeding made every dot jump with the screen. */
  function rescaleNodes(prevW, prevH) {
    if (!nodes.length || !(prevW > 0) || !(prevH > 0)) {
      init();
      return;
    }
    var sx = width / prevW;
    var sy = height / prevH;
    var i, n;
    if (Math.abs(sx - 1) > 0.001 || Math.abs(sy - 1) > 0.001) {
      for (i = 0; i < nodes.length; i++) {
        nodes[i].x *= sx;
        nodes[i].y *= sy;
      }
    }
    n = targetCount();
    while (nodes.length < n) nodes.push(new Node());
    if (nodes.length > n) nodes.length = n;
  }

  function onViewportChange() {
    var prevW = width;
    var prevH = height;
    resize();
    // Ignore tiny chrome-only height jitter; still update canvas via resize().
    var widthJump = Math.abs(width - prevW) > 2;
    var heightJump = Math.abs(height - prevH) > 48;
    if (!nodes.length) {
      init();
      return;
    }
    if (widthJump || heightJump) rescaleNodes(prevW, prevH);
  }

  function drawConnections() {
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var dx = nodes[i].x - nodes[j].x;
        var dy = nodes[i].y - nodes[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECTION_DIST) {
          var t = 1 - dist / CONNECTION_DIST;
          var alpha = t * 0.32;
          // Solana purple links — clearer mesh, still no bloom
          var r = 153;
          var g = 69;
          var b = 255;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha.toFixed(3) + ')';
          ctx.lineWidth = 0.7 + t * 0.7;
          ctx.stroke();
        }
      }
    }
  }

  function frame(now) {
    var dt = t0 ? Math.min((now - t0) / 1000, 0.05) : 0.016;
    t0 = now;
    ctx.clearRect(0, 0, width, height);

    // Quiet Solana purple vignette — no multicolor bloom
    var g = ctx.createRadialGradient(width * 0.55, height * 0.35, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.75);
    g.addColorStop(0, 'rgba(153,69,255,0.07)');
    g.addColorStop(0.45, 'rgba(153,69,255,0.03)');
    g.addColorStop(1, 'rgba(5,6,10,0.4)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    drawConnections();
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].update(dt);
      nodes[i].draw();
    }

    if (!reduce && visible) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (raf) return;
    t0 = 0;
    if (reduce) {
      frame(16);
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; t0 = 0; }
  }

  resize();
  init();
  window.addEventListener('resize', function () {
    // Debounce so mobile URL-bar thrash does not thrash the field.
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeTimer = 0;
      onViewportChange();
    }, 120);
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        visible = e.isIntersecting;
        if (visible) start(); else stop();
      });
    }, { threshold: 0.08 }).observe(hero);
  } else {
    start();
  }
  start();
})();
