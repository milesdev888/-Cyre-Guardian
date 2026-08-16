(function(){
  var portrait = document.querySelector('.portrait');
  if (!portrait) return;
  var img = portrait.querySelector('img');
  if (!img) return;

  var FIT = { s: 1.05, x: -1.3, y: 4.5 };
  var EYES_IMG = [ [39.6, 43], [62, 43] ];
  var MOUTH_IMG = [50.8, 64.2];

  function fx(p){ return 50 + (p[0] - 50) * FIT.s + FIT.x; }
  function fy(p){ return 50 + (p[1] - 50) * FIT.s + FIT.y; }

  var LINES = [
    "I am Guardian, the intelligence at the core of Cyre.",
    "I watch real world assets as they move on chain.",
    "Seven products. One model. Fraud prediction, credit scoring, forensics and more.",
    "I see the pattern before the loss.",
    "Request early access, and let me watch what matters to you."
  ];

  var css = document.createElement('style');
  css.textContent =
    '@keyframes gEye{0%,100%{opacity:.25;transform:translate(-50%,-50%) scale(.8)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.15)}}' +
    '.g-eye{position:absolute;width:11%;aspect-ratio:1;border-radius:50%;pointer-events:none;' +
    'background:radial-gradient(circle, rgba(79,227,208,.95) 0%, rgba(79,227,208,.45) 40%, rgba(79,227,208,0) 70%);' +
    'opacity:0;transform:translate(-50%,-50%);}' +
    '.g-on .g-eye{animation:gEye 1.6s ease-in-out infinite;}' +
    '.g-eye.e2{animation-delay:.8s;}' +
    '.g-mouth{position:absolute;width:16%;height:3.5%;border-radius:999px;pointer-events:none;' +
    'background:radial-gradient(ellipse at center, rgba(79,227,208,.95) 0%, rgba(79,227,208,.4) 55%, rgba(79,227,208,0) 80%);' +
    'opacity:0;transform:translate(-50%,-50%) scaleY(.4);transition:opacity .3s ease;}';
  document.head.appendChild(css);

  if (getComputedStyle(portrait).position === 'static') portrait.style.position = 'relative';

  var mouth = null;

  var robot = new Image();
  var hasRobot = false;
  robot.onload = function(){
    hasRobot = true;
    robot.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;' +
      'object-fit:cover;object-position:50% 50%;display:block;opacity:0;' +
      'mix-blend-mode:screen;transition:opacity .6s ease;' +
      'transform:translate(' + FIT.x + '%,' + FIT.y + '%) scale(' + FIT.s + ');' +
      'border-radius:' + (getComputedStyle(img).borderRadius || '0');
    portrait.appendChild(robot);
    for (var e = 0; e < EYES_IMG.length; e++){
      var d = document.createElement('div');
      d.className = 'g-eye' + (e === 1 ? ' e2' : '');
      d.style.left = fx(EYES_IMG[e]) + '%';
      d.style.top  = fy(EYES_IMG[e]) + '%';
      portrait.appendChild(d);
    }
    mouth = document.createElement('div');
    mouth.className = 'g-mouth';
    mouth.style.left = fx(MOUTH_IMG) + '%';
    mouth.style.top  = fy(MOUTH_IMG) + '%';
    portrait.appendChild(mouth);
  };
  robot.src = '/robot.jpg';

  var scan = document.createElement('div');
  scan.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;' +
    'transition:opacity .4s ease;border-radius:inherit;mix-blend-mode:screen;' +
    'background:repeating-linear-gradient(0deg, rgba(79,227,208,0) 0px, rgba(79,227,208,0) 3px, rgba(79,227,208,.28) 4px);';
  portrait.appendChild(scan);

  var btn = document.createElement('button');
  btn.textContent = '\u25B8 Hear Guardian';
  btn.setAttribute('aria-label','Hear Guardian speak');
  btn.style.cssText = 'position:absolute;left:50%;bottom:10px;transform:translateX(-50%);' +
    'z-index:3;font:500 12px Inter,system-ui,sans-serif;color:#07080b;background:#d9b36c;' +
    'border:0;border-radius:999px;padding:8px 16px;cursor:pointer;white-space:nowrap;';
  portrait.appendChild(btn);

  var voice = null;
  function pickVoice(){
    var vs = speechSynthesis.getVoices();
    if (!vs.length) return;
    var names = ['Samantha','Google UK English Female','Karen','Victoria','Moira'];
    for (var i = 0; i < names.length; i++){
      for (var j = 0; j < vs.length; j++){
        if (vs[j].name.indexOf(names[i]) !== -1){ voice = vs[j]; return; }
      }
    }
    for (var k = 0; k < vs.length; k++){
      if (vs[k].lang.indexOf('en') === 0){ voice = vs[k]; return; }
    }
  }
  pickVoice();
  if (window.speechSynthesis){
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  var speaking = false;
  var mouthTimer = null;

  function mouthOn(){
    if (!mouth) return;
    mouth.style.opacity = '1';
    mouthTimer = setInterval(function(){
      var amp = 0.35 + Math.random() * 0.9;
      mouth.style.transform = 'translate(-50%,-50%) scaleY(' + amp.toFixed(2) + ') scaleX(' + (0.85 + Math.random()*0.3).toFixed(2) + ')';
      mouth.style.opacity = (0.55 + Math.random() * 0.45).toFixed(2);
    }, 110);
  }
  function mouthOff(){
    if (mouthTimer){ clearInterval(mouthTimer); mouthTimer = null; }
    if (mouth){ mouth.style.opacity = '0'; mouth.style.transform = 'translate(-50%,-50%) scaleY(.4)'; }
  }

  function morph(on){
    scan.style.opacity = on ? '1' : '0';
    if (hasRobot) robot.style.opacity = on ? '0.9' : '0';
    if (on){ portrait.classList.add('g-on'); mouthOn(); }
    else { portrait.classList.remove('g-on'); mouthOff(); }
  }

  function stopSpeak(){
    speaking = false;
    speechSynthesis.cancel();
    morph(false);
    btn.textContent = '\u25B8 Hear Guardian';
  }

  btn.addEventListener('click', function(){
    if (!window.speechSynthesis){ btn.textContent = 'Voice unavailable'; return; }
    if (speaking){ stopSpeak(); return; }
    speaking = true;
    btn.textContent = '\u25A0 Stop';
    morph(true);
    var idx = 0;
    function next(){
      if (!speaking || idx >= LINES.length){ stopSpeak(); return; }
      var u = new SpeechSynthesisUtterance(LINES[idx++]);
      if (voice) u.voice = voice;
      u.rate = 0.95;
      u.pitch = 0.85;
      u.onend = next;
      u.onerror = stopSpeak;
      speechSynthesis.speak(u);
    }
    next();
  });

  document.addEventListener('visibilitychange', function(){
    if (document.hidden && speaking) stopSpeak();
  });
})();
     
