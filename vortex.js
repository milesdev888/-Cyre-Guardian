/* vortex.js — living AI particle / network mesh (cyan + violet)
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
  var NODE_COUNT = 72;
  var CONNECTION_DIST = 168;
  var raf = 0;
  var t0 = 0;
  var visible = true;

  // Cyan + violet + frost — cinematic AI energy
  var COLORS = [
    { r: 95, g: 208, b: 255 },
    { r: 155, g: 123, b: 255 },
    { r: 79, g: 227, b: 208 },
    { r: 200, g: 180, b: 255 }
  ];

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
    this.radius = 0.7 + Math.random() * 1.9;
    this.alpha = 0.28 + Math.random() * 0.5;
    this.pulse = Math.random() * Math.PI * 2;
    this.pulseSp = 0.8 + Math.random() * 1.4;
    var c = COLORS[(Math.random() * COLORS.length) | 0];
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
    var breath = 1 + (reduce ? 0 : 0.18 * Math.sin(this.pulse));
    var rad = this.radius * breath;
    var a = this.alpha * (0.85 + (reduce ? 0.15 : 0.15 * Math.sin(this.pulse * 0.7)));
    ctx.beginPath();
    ctx.arc(this.x, this.y, rad * 4.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(' + this.r + ',' + this.g + ',' + this.b + ',' + (a * 0.12).toFixed(3) + ')';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.x, this.y, rad, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(' + this.r + ',' + this.g + ',' + this.b + ',' + a.toFixed(3) + ')';
    ctx.fill();
  };

  function init() {
    nodes.length = 0;
    var n = Math.min(NODE_COUNT, Math.max(36, ((width * height) / 14000) | 0));
    for (var i = 0; i < n; i++) nodes.push(new Node());
  }

  function drawConnections() {
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var dx = nodes[i].x - nodes[j].x;
        var dy = nodes[i].y - nodes[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECTION_DIST) {
          var t = 1 - dist / CONNECTION_DIST;
          var alpha = t * 0.22;
          // Blend cyan→violet along the edge
          var r = (95 + 60 * t) | 0;
          var g = (208 - 85 * t) | 0;
          var b = 255;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha.toFixed(3) + ')';
          ctx.lineWidth = 0.55 + t * 0.55;
          ctx.stroke();
        }
      }
    }
  }

  function frame(now) {
    var dt = t0 ? Math.min((now - t0) / 1000, 0.05) : 0.016;
    t0 = now;
    ctx.clearRect(0, 0, width, height);

    // Cinematic vignette + soft core bloom
    var g = ctx.createRadialGradient(width * 0.55, height * 0.35, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.75);
    g.addColorStop(0, 'rgba(95,208,255,0.06)');
    g.addColorStop(0.45, 'rgba(155,123,255,0.03)');
    g.addColorStop(1, 'rgba(5,6,10,0.55)');
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
