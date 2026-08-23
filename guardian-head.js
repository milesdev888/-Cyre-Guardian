/* guardian-head.js — cyan/violet wireframe/particle head for homepage hero */
(function () {
      var canvas = document.getElementById('guardian-head');
      if (!canvas || !canvas.getContext) return;
      var ctx = canvas.getContext('2d');
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var W = 640, H = 800;
      var points = [];
      var t0 = performance.now();
      var raf = 0;
      var visible = true;

      function seed(n) {
        var out = [];
        var i, u, v, th, ph, x, y, z, r, band;
        for (i = 0; i < n; i++) {
          u = Math.random();
          v = Math.random();
          th = u * Math.PI * 2;
          ph = Math.acos(2 * v - 1);
          // Ellipsoid skull
          x = Math.sin(ph) * Math.cos(th) * 0.78;
          y = Math.cos(ph) * 1.05 - 0.08;
          z = Math.sin(ph) * Math.sin(th) * 0.72;
          // Jaw / chin taper
          if (y < -0.15) {
            r = 0.72 + (y + 0.15) * 0.55;
            x *= Math.max(0.42, r);
            z *= Math.max(0.48, r + 0.05);
          }
          // Forehead flatten slightly
          if (y > 0.55) {
            x *= 0.92;
            z *= 0.9;
          }
          // Keep mostly front hemisphere for face read
          if (z < -0.25 && Math.random() > 0.35) continue;
          band = Math.random();
          // Feature densification: eyes, nose bridge, mouth
          if (band < 0.12) {
            x = (Math.random() - 0.5) * 0.55;
            y = 0.18 + (Math.random() - 0.5) * 0.12;
            z = 0.55 + Math.random() * 0.18;
          } else if (band < 0.2) {
            x = (Math.random() - 0.5) * 0.12;
            y = 0.02 + (Math.random() - 0.5) * 0.28;
            z = 0.62 + Math.random() * 0.16;
          } else if (band < 0.28) {
            x = (Math.random() - 0.5) * 0.38;
            y = -0.28 + (Math.random() - 0.5) * 0.1;
            z = 0.58 + Math.random() * 0.14;
          }
          out.push({
            x: x, y: y, z: z,
            hue: Math.random() > 0.55 ? 0 : 1,
            s: 0.7 + Math.random() * 1.4
          });
        }
        return out;
      }

      points = seed(460);

      function resize() {
        var rect = canvas.getBoundingClientRect();
        W = Math.max(1, Math.floor(rect.width * dpr));
        H = Math.max(1, Math.floor(rect.height * dpr));
        canvas.width = W;
        canvas.height = H;
      }

      function project(p, rot, breathe) {
        var c = Math.cos(rot), s = Math.sin(rot);
        var x = p.x * c - p.z * s;
        var z = p.x * s + p.z * c;
        var y = p.y * breathe;
        var persp = 2.6 / (2.6 + z);
        return {
          x: W * 0.5 + x * persp * W * 0.38,
          y: H * 0.48 + y * persp * H * 0.34,
          z: z,
          a: Math.max(0.12, Math.min(1, (z + 1.1) / 1.8)),
          hue: p.hue,
          s: p.s * persp
        };
      }

      function drawFrame(now) {
        var elapsed = (now - t0) / 1000;
        var rot = reduce ? 0.35 : Math.sin(elapsed * 0.22) * 0.55 + elapsed * 0.08;
        var breathe = reduce ? 1 : 1 + Math.sin(elapsed * 0.9) * 0.018;
        var projected = [];
        var i, j, a, b, dx, dy, dist, alpha, col;
        ctx.clearRect(0, 0, W, H);

        // Soft core glow
        var g = ctx.createRadialGradient(W * 0.5, H * 0.42, 10, W * 0.5, H * 0.48, W * 0.42);
        g.addColorStop(0, 'rgba(95,208,255,0.16)');
        g.addColorStop(0.45, 'rgba(155,123,255,0.08)');
        g.addColorStop(1, 'rgba(5,8,18,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        for (i = 0; i < points.length; i++) {
          projected.push(project(points[i], rot, breathe));
        }

        // Wire links — limited neighbor scan for frame budget
        ctx.lineWidth = Math.max(0.6, dpr * 0.7);
        var maxDist = 32 * dpr;
        var step = 1;
        for (i = 0; i < projected.length; i += step) {
          a = projected[i];
          var linked = 0;
          for (j = i + 1; j < projected.length && linked < 8; j++) {
            b = projected[j];
            dx = a.x - b.x;
            if (dx > maxDist || dx < -maxDist) continue;
            dy = a.y - b.y;
            if (dy > maxDist || dy < -maxDist) continue;
            dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > maxDist || dist < 2) continue;
            alpha = (1 - dist / maxDist) * Math.min(a.a, b.a) * 0.58;
            col = (a.hue + b.hue) > 0
              ? 'rgba(155,123,255,' + alpha + ')'
              : 'rgba(95,208,255,' + alpha + ')';
            ctx.strokeStyle = col;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            linked++;
          }
        }

        // Particles
        for (i = 0; i < projected.length; i++) {
          a = projected[i];
          ctx.beginPath();
          ctx.fillStyle = a.hue
            ? 'rgba(155,123,255,' + (0.35 + a.a * 0.55) + ')'
            : 'rgba(95,208,255,' + (0.4 + a.a * 0.55) + ')';
          ctx.arc(a.x, a.y, a.s * (1.1 + dpr * 0.35), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      function loop(now) {
        if (!visible && !reduce) {
          raf = requestAnimationFrame(loop);
          return;
        }
        drawFrame(now || performance.now());
        if (!reduce) raf = requestAnimationFrame(loop);
      }

      resize();
      drawFrame(performance.now());
      if (!reduce) raf = requestAnimationFrame(loop);

      window.addEventListener('resize', function () {
        resize();
        if (reduce) drawFrame(performance.now());
      });

      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          visible = entries[0] && entries[0].isIntersecting;
        }, { threshold: 0.05 });
        io.observe(canvas);
      }
    })();
