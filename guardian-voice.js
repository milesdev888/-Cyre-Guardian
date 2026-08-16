(function(){
  var portrait = document.querySelector('.portrait');
  if (!portrait) return;
  var img = portrait.querySelector('img');
  if (!img) return;

  var LINES = [
    "I am Guardian, the intelligence at the core of Cyre.",
    "I watch real world assets as they move on chain.",
    "Seven products. One model. Fraud prediction, credit scoring, forensics and more.",
    "I see the pattern before the loss.",
    "Request early access, and let me watch what matters to you."
  ];

  portrait.style.position = 'relative';

  var robot = new Image();
  var hasRobot = false;
  robot.onload = function(){
    hasRobot = true;
    robot.style.cssText = img.style.cssText;
    robot.style.position = 'absolute';
    robot.style.inset = '0';
    robot.style.width = '100%';
    robot.style.height = '100%';
    robot.style.objectFit = getComputedStyle(img).objectFit || 'cover';
    robot.style.objectPosition = getComputedStyle(img).objectPosition;
    robot.style.opacity = '0';
    robot.style.transition = 'opacity .6s ease';
    robot.style.borderRadius = getComputedStyle(img).borderRadius;
    portrait.appendChild(robot);
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
  function morph(on){
    scan.style.opacity = on ? '1' : '0';
    if (hasRobot) robot.style.opacity = on ? '1' : '0';
    img.style.transition = 'filter .5s ease';
    img.style.filter = on ? 'saturate(.6) contrast(1.1)' : '';
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
