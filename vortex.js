/* vortex.js — crystal 4K Solana mesh
   Purple #9945FF · green #14F195 · gold #FFBE50.
   High-DPR canvas + faceted crystal dots (specular, no soft bloom). */
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

  var ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  var width = 0, height = 0, dpr = 1;
  var nodes = [];
  var NODE_COUNT = 100;
  var CONNECTION_DIST = 205;
  var raf = 0;
  var t0 = 0;
  var visible = true;

  var COLORS = [
    { r: 168, g:  92, b: 255 },
    { r: 138, g:  58, b: 240 },
    { r: 196, g: 130, b: 255 }
  ];
  var GREEN = { r: 48, g: 250, b: 175 };
  var GOLD  = { r: 255, g: 208, b: 96 };

  function resize() {
    var rect = hero.getBoundingClientRect();
    // 4K-class backing store on retina / large CSS boxes
    var native = window.devicePixelRatio || 1;
    dpr = Math.min(Math.max(native, 2.5), 3.5);
    width = Math.max(1, rect.width | 0);
    height = Math.max(1, rect.height | 0);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
  }

  function Node() {
    this.reset(true);
  }
  Node.prototype.reset = function () {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    var speed = reduce ? 0 : (0.16 + Math.random() * 0.26);
    var ang = Math.random() * Math.PI * 2;
    this.vx = Math.cos(ang) * speed;
    this.vy = Math.sin(ang) * speed;
    this.radius = 2.0 + Math.random() * 2.4;
    this.alpha = 0.82 + Math.random() * 0.18;
    this.pulse = Math.random() * Math.PI * 2;
    this.pulseSp = 0.7 + Math.random() * 1.3;
    this.facet = (Math.random() * 6) | 0; // crystal orientation
    this.spark = 0.55 + Math.random() * 0.45;
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
    this.x += this.vx * (60 * dt);
    this.y += this.vy * (60 * dt);
    this.pulse += this.pulseSp * dt;
    if (this.x < -20) this.x = width + 20;
    if (this.x > width + 20) this.x = -20;
    if (this.y < -20) this.y = height + 20;
    if (this.y > height + 20) this.y = -20;
    this.vx += (Math.random() - 0.5) * 0.01;
    this.vy += (Math.random() - 0.5) * 0.01;
    var sp = Math.sqrt(this.vx * this.vx + this.vy * this.vy) || 0.001;
    var max = 0.55;
    if (sp > max) { this.vx = this.vx / sp * max; this.vy = this.vy / sp * max; }
  };

  /** Crystal facet: hex body + bright core + sharp specular (no soft bloom halo). */
  Node.prototype.draw = function () {
    var breath = 1 + (reduce ? 0 : 0.1 * Math.sin(this.pulse));
    var rad = this.radius * breath;
    var a = this.alpha * (0.92 + (reduce ? 0.08 : 0.08 * Math.sin(this.pulse * 0.7)));
    var x = this.x, y = this.y;
    var sides = 6;
    var rot = (this.facet / 6) * Math.PI + (reduce ? 0 : this.pulse * 0.08);

    // Faceted crystal body
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

    // Hard glass rim
    ctx.strokeStyle = 'rgba(255,255,255,' + Math.min(0.85, a * 0.55 * this.spark).toFixed(3) + ')';
    ctx.lineWidth = Math.max(0.7, rad * 0.18);
    ctx.stroke();

    // Bright inner core (crystal density)
    ctx.beginPath();
    ctx.arc(x, y, rad * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(' +
      Math.min(255, this.r + 70) + ',' +
      Math.min(255, this.g + 70) + ',' +
      Math.min(255, this.b + 50) + ',' +
      Math.min(1, a * 0.95).toFixed(3) + ')';
    ctx.fill();

    // Sharp specular glint (tiny — not a bloom)
    var sx = x - rad * 0.28;
    var sy = y - rad * 0.32;
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(0.55, rad * 0.22), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, 0.55 + this.spark * 0.4).toFixed(3) + ')';
    ctx.fill();
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
          var alpha = t * 0.38;
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
    var dt = t0 ? Math.min((now - t0) / 1000, 0.05) : 0.016;
    t0 = now;
    ctx.clearRect(0, 0, width, height);

    var g = ctx.createRadialGradient(width * 0.55, height * 0.35, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.75);
    g.addColorStop(0, 'rgba(153,69,255,0.08)');
    g.addColorStop(0.45, 'rgba(153,69,255,0.03)');
    g.addColorStop(1, 'rgba(5,6,10,0.38)');
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
  window.addEventListener('resize', function () { resize(); init(); });

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
