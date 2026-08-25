/* vortex.js — crystal 4K Solana mesh with continuous drift
   Purple #9945FF · green #14F195 · gold #FFBE50.
   High-DPR canvas + faceted crystal dots. Motion runs while idle —
   resize no longer re-seeds (fixes “only moves when scrolling”). */
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
  var kids = hero.children;
  for (var k = 0; k < kids.length; k++) {
    if (kids[k].style && !kids[k].style.zIndex) {
      var pos = getComputedStyle(kids[k]).position;
      if (pos === 'static') kids[k].style.position = 'relative';
      kids[k].style.zIndex = '1';
    }
  }
  hero.insertBefore(canvas, hero.firstChild);

  var ctx = canvas.getContext('2d', { alpha: true });
  var width = 0, height = 0, dpr = 1;
  var nodes = [];
  var NODE_COUNT = 100;
  var CONNECTION_DIST = 205;
  var raf = 0;
  var t0 = 0;
  var visible = true;
  var resizeTimer = 0;

  var COLORS = [
    { r: 168, g:  92, b: 255 },
    { r: 138, g:  58, b: 240 },
    { r: 196, g: 130, b: 255 }
  ];
  var GREEN = { r: 48, g: 250, b: 175 };
  var GOLD  = { r: 255, g: 208, b: 96 };

  function applyCanvasSize(w, h) {
    var native = window.devicePixelRatio || 1;
    dpr = Math.min(Math.max(native, 2.5), 3.5);
    width = w;
    height = h;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
  }

  /** Resize without killing drift. Ignore mobile URL-bar height jitter. */
  function resize(opts) {
    opts = opts || {};
    var rect = hero.getBoundingClientRect();
    var w = Math.max(1, rect.width | 0);
    var h = Math.max(1, rect.height | 0);
    var first = !width || !height;
    var dw = Math.abs(w - width);
    var dh = Math.abs(h - height);

    // Mobile chrome show/hide changes height ~40–120px — don't reshuffle dots
    if (!first && !opts.force) {
      if (dw < 2 && dh < 100) return;
      if (dw < 2 && dh >= 100) {
        // Height-only jump: grow/shrink canvas, keep X, scale Y gently
        var oldH = height;
        applyCanvasSize(w, h);
        if (oldH > 0) {
          var sy = h / oldH;
          for (var i = 0; i < nodes.length; i++) {
            nodes[i].y = Math.min(h + 20, Math.max(-20, nodes[i].y * sy));
          }
        }
        return;
      }
    }

    var oldW = width;
    var oldH = height;
    applyCanvasSize(w, h);

    if (first || !nodes.length || opts.reseed) {
      init();
      return;
    }
    // Real layout change: scale positions, keep velocities
    if (oldW > 0 && oldH > 0) {
      var sx = w / oldW;
      var sy = h / oldH;
      for (var j = 0; j < nodes.length; j++) {
        nodes[j].x *= sx;
        nodes[j].y *= sy;
      }
    }
  }

  function Node() {
    this.reset();
  }
  Node.prototype.reset = function () {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    // Calm continuous drift (readable idle motion, not frantic)
    var speed = reduce ? 0 : (0.08 + Math.random() * 0.14);
    var ang = Math.random() * Math.PI * 2;
    this.vx = Math.cos(ang) * speed;
    this.vy = Math.sin(ang) * speed;
    this.radius = 2.0 + Math.random() * 2.4;
    this.alpha = 0.82 + Math.random() * 0.18;
    this.pulse = Math.random() * Math.PI * 2;
    this.pulseSp = 0.45 + Math.random() * 0.7;
    this.facet = (Math.random() * 6) | 0;
    this.spark = 0.55 + Math.random() * 0.45;
    this.spin = (Math.random() - 0.5) * 0.25;
    var roll = Math.random();
    var c;
    if (roll < 0.12) {
      c = GOLD;
      this.kind = 'gold';
      this.radius = 2.2 + Math.random() * 2.4;
      this.alpha = 0.9 + Math.random() * 0.1;
      this.spark = 0.75 + Math.random() * 0.25;
    } else if (roll < 0.30) {
      c = GREEN;
      this.kind = 'green';
      this.radius = 2.1 + Math.random() * 2.3;
      this.alpha = 0.88 + Math.random() * 0.12;
    } else {
      c = COLORS[(Math.random() * 3) | 0];
      this.kind = 'purple';
    }
    this.r = c.r; this.g = c.g; this.b = c.b;
  };
  Node.prototype.update = function (dt) {
    if (reduce) return;
    // Soft curved path — low amplitude so motion stays calm
    this.vx += Math.sin(this.pulse * 0.55) * 0.008 * dt * 60;
    this.vy += Math.cos(this.pulse * 0.4) * 0.007 * dt * 60;
    this.x += this.vx * (60 * dt);
    this.y += this.vy * (60 * dt);
    this.pulse += this.pulseSp * dt;
    this.facet += this.spin * dt;
    if (this.x < -24) this.x = width + 24;
    if (this.x > width + 24) this.x = -24;
    if (this.y < -24) this.y = height + 24;
    if (this.y > height + 24) this.y = -24;
    this.vx += (Math.random() - 0.5) * 0.004;
    this.vy += (Math.random() - 0.5) * 0.004;
    var sp = Math.sqrt(this.vx * this.vx + this.vy * this.vy) || 0.001;
    var max = 0.28;
    var min = 0.05;
    if (sp > max) { this.vx = this.vx / sp * max; this.vy = this.vy / sp * max; }
    else if (sp < min) { this.vx = this.vx / sp * min; this.vy = this.vy / sp * min; }
  };

  Node.prototype.draw = function () {
    var breath = 1 + (reduce ? 0 : 0.04 * Math.sin(this.pulse));
    var rad = this.radius * breath;
    var a = this.alpha;
    var x = this.x, y = this.y;
    var sides = 6;
    var rot = (this.facet / 6) * Math.PI + (reduce ? 0 : this.pulse * 0.04);

    // Hard crystal only — never use canvas shadowBlur (reads as soft halo)
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.beginPath();
    for (var i = 0; i <= sides; i++) {
      var ang = rot + (i / sides) * Math.PI * 2;
      var px = x + Math.cos(ang) * rad;
      var py = y + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(' + this.r + ',' + this.g + ',' + this.b + ',' + a.toFixed(3) + ')';
    ctx.fill();
    // Same-color hard edge (no white bloom ring)
    ctx.strokeStyle = 'rgba(' +
      Math.min(255, this.r + 40) + ',' +
      Math.min(255, this.g + 40) + ',' +
      Math.min(255, this.b + 30) + ',' +
      Math.min(1, a).toFixed(3) + ')';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  function init() {
    nodes.length = 0;
    var n = Math.min(NODE_COUNT, Math.max(40, ((width * height) / 13000) | 0));
    for (var i = 0; i < n; i++) nodes.push(new Node());
  }

  function drawConnections() {
    ctx.lineCap = 'round';
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var dx = nodes[i].x - nodes[j].x;
        var dy = nodes[i].y - nodes[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECTION_DIST) {
          var t = 1 - dist / CONNECTION_DIST;
          var alpha = t * 0.22;
          var a = nodes[i], b = nodes[j];
          var r = 168, g = 92, bch = 255;
          if (a.kind === 'gold' || b.kind === 'gold') { r = 255; g = 200; bch = 110; alpha *= 0.9; }
          else if (a.kind === 'green' || b.kind === 'green') { r = 60; g = 240; bch = 180; alpha *= 0.85; }
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + bch + ',' + alpha.toFixed(3) + ')';
          ctx.lineWidth = 0.65 + t * 0.75;
          ctx.stroke();
        }
      }
    }
  }

  function frame(now) {
    raf = 0;
    if (!visible && !reduce) return;
    var dt = t0 ? Math.min((now - t0) / 1000, 0.05) : 0.016;
    t0 = now;
    ctx.clearRect(0, 0, width, height);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    drawConnections();
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].update(dt);
      nodes[i].draw();
    }

    if (!reduce && visible) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (reduce) {
      frame(performance.now());
      return;
    }
    if (raf) return;
    t0 = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    t0 = 0;
  }

  function scheduleResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeTimer = 0;
      resize();
      start();
    }, 120);
  }

  resize({ force: true, reseed: true });
  window.addEventListener('resize', scheduleResize);
  // orientationchange fires before layout settles
  window.addEventListener('orientationchange', function () {
    setTimeout(function () { resize({ force: true }); start(); }, 280);
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        visible = e.isIntersecting;
        if (visible) start(); else stop();
      });
    }, { threshold: 0.02 }).observe(hero);
  }
  // Always kick the loop — don't wait on observer
  start();
  // Keep alive if tab was backgrounded
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && visible) start();
  });
})();
