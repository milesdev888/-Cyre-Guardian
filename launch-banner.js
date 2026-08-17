(function(){
  if (document.getElementById('cy-banner')) return;

  var css = document.createElement('style');
  css.textContent =
    '#cy-banner{position:relative;overflow:hidden;background:#07080b;border-top:1px solid #1f2634;border-bottom:1px solid #1f2634}' +
    '#cy-banner canvas{position:absolute;inset:0;width:100%;height:100%}' +
    '#cy-banner .cyb-veil{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(7,8,11,0) 0%,rgba(7,8,11,.78) 100%)}' +
    '#cy-banner .cyb-in{position:relative;z-index:2;max-width:1080px;margin:0 auto;padding:110px 24px;text-align:center}' +
    '#cy-banner h2{font-family:Sora,system-ui,sans-serif;font-weight:700;font-size:clamp(26px,4.5vw,44px);color:#e8ecf3;margin:0 0 14px;letter-spacing:-.01em}' +
    '#cy-banner h2 span{color:var(--gold,#5fd0ff)}' +
    '#cy-banner p{color:#8892a4;font-size:clamp(14px,1.8vw,17px);max-width:560px;margin:0 auto 26px;line-height:1.7}' +
    '#cy-banner .cyb-cta{display:inline-block;font:600 15px Inter,system-ui,sans-serif;color:#07080b;background:var(--gold,#5fd0ff);border-radius:8px;padding:13px 26px;text-decoration:none}' +
    '@media (max-width:640px){#cy-banner .cyb-in{padding:80px 20px}}';
  document.head.appendChild(css);

  var sec = document.createElement('section');
  sec.id = 'cy-banner';
  sec.innerHTML =
    '<canvas></canvas><div class="cyb-veil"></div>' +
    '<div class="cyb-in">' +
      '<h2>Step into the <span>signal</span>.</h2>' +
      '<p>Every transaction tells a story before it settles. Guardian reads it in real time \u2014 so the pattern is visible before the loss.</p>' +
      '<a class="cyb-cta" href="#guardian">Request early access</a>' +
    '</div>';

  var anchor = document.getElementById('guardian') ||
               document.querySelector('#pricing, section.sec:last-of-type');
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(sec, anchor);
  else document.body.appendChild(sec);

  var cv = sec.querySelector('canvas'), ctx = cv.getContext('2d');
  var ICE = [95,208,255], CYAN = [79,227,208], HOT = [238,250,255];
  var RED = [255,77,94], GREEN = [61,220,132];
  var WORDS = ['CYRE','C7','GUARDIAN','CYRE','RWA','ONDO','PAXG','LINK','SYRUP',
               'SETTLED','SIG VALID','ATTEST','FLAG','HOLD','RISK 0.94',
               '0x4f2a','0x9c1d','CYRE','SCORE 12','DELTA 1.2','C7','ATTEST'];

  function wcolor(w){
    if (w==='FLAG'||w==='HOLD'||w==='RISK 0.94') return RED;
    if (w==='SETTLED'||w==='SIG VALID'||w==='ATTEST') return GREEN;
    if (w==='CYRE'||w==='C7') return HOT;
    return null;
  }
  function mix(a,b,t){ return [a[0]+(b[0]-a[0])*t|0, a[1]+(b[1]-a[1])*t|0, a[2]+(b[2]-a[2])*t|0]; }

  var bot = new Image(); bot.ok = false;
  bot.onload = function(){ bot.ok = true; };
  bot.src = '/robot.jpg';

  var P = [], N = 90, W = 0, H = 0, dpr = 1;
  function reset(p, deep){
    p.a = Math.random()*Math.PI*2;
    p.z = deep ? (0.25 + Math.random()*1.05) : (1.0 + Math.random()*0.3);
    p.w = WORDS[Math.random()*WORDS.length|0];
    p.sp = 0.10 + Math.random()*0.08;
    p.c = wcolor(p.w);
  }
  for (var i=0;i<N;i++){ var p={}; reset(p,true); P.push(p); }

  function size(){
    var r = sec.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio||1, 2);
    W = Math.max(1, r.width|0); H = Math.max(1, r.height|0);
    cv.width = W*dpr; cv.height = H*dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  var t0 = 0;
  function frame(now){
    var dt = t0 ? Math.min((now-t0)/1000, .05) : .016; t0 = now;
    ctx.clearRect(0,0,W,H);
    var cx = W/2, cy = H/2, R = Math.min(W,H)*0.62;

    var g = ctx.createRadialGradient(cx,cy,0,cx,cy,R*0.5);
    g.addColorStop(0,'rgba(238,250,255,.9)');
    g.addColorStop(0.25,'rgba(95,208,255,.35)');
    g.addColorStop(1,'rgba(95,208,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);

    if (bot.ok){
      var pr = R*0.17*(1 + 0.03*Math.sin(now/900));
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx,cy,pr,0,Math.PI*2);
      ctx.clip();
      ctx.globalAlpha = 0.92;
      ctx.drawImage(bot, cx-pr, cy-pr, pr*2, pr*2);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx,cy,pr,0,Math.PI*2);
      ctx.strokeStyle = 'rgba(95,208,255,.85)';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(95,208,255,.9)';
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    for (var i=0;i<P.length;i++){
      var p = P[i];
      p.z -= p.sp*dt*(0.55 + 0.8/p.z*0.3);
      p.a += dt*(0.35/p.z);
      if (p.z < 0.22){ reset(p,false); continue; }
      var r = R*p.z;
      var x = cx + Math.cos(p.a)*r;
      var y = cy + Math.sin(p.a)*r*0.62;
      var near = 1 - Math.min(Math.max((p.z-0.22)/1.1,0),1);
      var fs = 9 + near*13;
      var col = p.c || mix(ICE, CYAN, (i%7)/7);
      var al = 0.28 + near*0.62;
      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(p.a + Math.PI/2);
      ctx.font = '500 '+fs.toFixed(1)+'px "JetBrains Mono",Menlo,monospace';
      ctx.textAlign = 'center';
      if (p.c || near > 0.6){
        ctx.shadowColor = 'rgba('+col[0]+','+col[1]+','+col[2]+',.8)';
        ctx.shadowBlur = 6 + near*10;
      }
      ctx.fillStyle = 'rgba('+col[0]+','+col[1]+','+col[2]+','+al.toFixed(2)+')';
      ctx.fillText(p.w, 0, 0);
      ctx.restore();
    }
    raf = requestAnimationFrame(frame);
  }

  var raf = 0;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  size();
  window.addEventListener('resize', size);

  if (reduce){
    frame(16); cancelAnimationFrame(raf);
  } else if ('IntersectionObserver' in window){
    new IntersectionObserver(function(es){
      es.forEach(function(e){
        if (e.isIntersecting && !raf) raf = requestAnimationFrame(frame);
        else if (!e.isIntersecting && raf){ cancelAnimationFrame(raf); raf = 0; t0 = 0; }
      });
    },{threshold:.1}).observe(sec);
  } else {
    raf = requestAnimationFrame(frame);
  }
})();
