(function(){
  if (document.getElementById('cy-banner')) return;

  var css = document.createElement('style');
  css.textContent =
    '#cy-banner{position:relative;overflow:hidden;background:#07080b;border-top:1px solid #1f2634;border-bottom:1px solid #1f2634}' +
    '#cy-banner video,#cy-banner .cyb-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.5}' +
    '#cy-banner .cyb-veil{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(7,8,11,.1) 0%,rgba(7,8,11,.85) 100%)}' +
    '#cy-banner .cyb-in{position:relative;z-index:2;max-width:1080px;margin:0 auto;padding:110px 24px;text-align:center}' +
    '#cy-banner h2{font-family:Sora,system-ui,sans-serif;font-weight:700;font-size:clamp(26px,4.5vw,44px);color:#e8ecf3;margin:0 0 14px;letter-spacing:-.01em}' +
    '#cy-banner h2 span{color:var(--gold,#5fd0ff)}' +
    '#cy-banner p{color:#8892a4;font-size:clamp(14px,1.8vw,17px);max-width:560px;margin:0 auto 26px;line-height:1.7}' +
    '#cy-banner .cyb-cta{display:inline-block;font:600 15px Inter,system-ui,sans-serif;color:#07080b;background:var(--gold,#5fd0ff);border-radius:8px;padding:13px 26px;text-decoration:none}' +
    '@media (max-width:640px){#cy-banner .cyb-in{padding:80px 20px}}';
  document.head.appendChild(css);

  var sec = document.createElement('section');
  sec.id = 'cy-banner';

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    sec.innerHTML = '<img class="cyb-img" src="/launch-poster.jpg" alt="">';
  } else {
    sec.innerHTML =
      '<video autoplay muted loop playsinline preload="metadata" poster="/launch-poster.jpg">' +
      '<source src="/launch.mp4" type="video/mp4"></video>';
  }

  sec.innerHTML +=
    '<div class="cyb-veil"></div>' +
    '<div class="cyb-in">' +
      '<h2>Step into the <span>signal</span>.</h2>' +
      '<p>Every transaction tells a story before it settles. Guardian reads it in real time — so the pattern is visible before the loss.</p>' +
      '<a class="cyb-cta" href="#guardian">Request early access</a>' +
    '</div>';

  var anchor = document.getElementById('guardian') ||
               document.querySelector('#pricing, section.sec:last-of-type');
  if (anchor && anchor.parentNode) {
    anchor.parentNode.insertBefore(sec, anchor);
  } else {
    document.body.appendChild(sec);
  }

  var v = sec.querySelector('video');
  if (v && 'IntersectionObserver' in window) {
    v.pause();
    new IntersectionObserver(function(es){
      es.forEach(function(e){ e.isIntersecting ? v.play().catch(function(){}) : v.pause(); });
    }, {threshold:.15}).observe(sec);
  }
})();
