(function(){
  var ENDPOINT = 'https://formspree.io/f/xqpzddvy';

  var css = document.createElement('style');
  css.textContent =
    '.axm-bg{position:fixed;inset:0;background:rgba(7,8,11,.8);backdrop-filter:blur(4px);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px;}' +
    '.axm{background:#0d1017;border:1px solid #1f2634;border-radius:16px;padding:28px 24px;max-width:420px;width:100%;z-index:9999;font-family:Inter,system-ui,sans-serif;}' +
    '.axm h3{font-family:Sora,Inter,sans-serif;font-weight:700;font-size:20px;color:#e8ecf3;margin:0 0 6px;}' +
    '.axm p.axs{font-size:13px;color:#8892a4;margin:0 0 18px;line-height:1.5;}' +
    '.axm label{display:block;font-size:12px;color:#8892a4;margin:0 0 6px;}' +
    '.axm input,.axm textarea{width:100%;box-sizing:border-box;background:#12161f;border:1px solid #1f2634;border-radius:8px;color:#e8ecf3;font:400 14px Inter,sans-serif;padding:11px 12px;margin:0 0 14px;outline:none;}' +
    '.axm input:focus,.axm textarea:focus{border-color:#4fe3d0;}' +
    '.axm textarea{min-height:70px;resize:vertical;}' +
    '.axm .axb{width:100%;background:#d9b36c;color:#07080b;border:0;border-radius:999px;padding:13px;font:500 14px Inter,sans-serif;cursor:pointer;}' +
    '.axm .axb:disabled{opacity:.6;cursor:wait;}' +
    '.axm .axx{position:absolute;top:14px;right:16px;background:none;border:0;color:#8892a4;font-size:20px;cursor:pointer;line-height:1;}' +
    '.axm .axe{font-size:13px;color:#ff7a7a;margin:0 0 10px;display:none;}' +
    '.axm .axok{text-align:center;padding:18px 0;display:none;}' +
    '.axm .axok b{display:block;font-family:Sora,sans-serif;font-size:18px;color:#4fe3d0;margin:0 0 8px;}' +
    '.axm .axok span{font-size:14px;color:#8892a4;}';
  document.head.appendChild(css);

  var bg = null;

  function close(){ if (bg){ bg.remove(); bg = null; } }

  function open(){
    if (bg) return;
    bg = document.createElement('div');
    bg.className = 'axm-bg';
    bg.innerHTML =
      '<div class="axm" style="position:relative">' +
      '<button class="axx" aria-label="Close">\u00d7</button>' +
      '<div class="axf">' +
      '<h3>Request early access</h3>' +
      '<p class="axs">Tell us where to reach you. We onboard a small number of protocols and teams at a time.</p>' +
      '<p class="axe"></p>' +
      '<label for="ax-email">Email</label>' +
      '<input id="ax-email" name="email" type="email" required placeholder="you@protocol.xyz">' +
      '<label for="ax-name">Name / company</label>' +
      '<input id="ax-name" name="name" type="text" placeholder="Jane \u00b7 Ondo">' +
      '<label for="ax-msg">What are you building?</label>' +
      '<textarea id="ax-msg" name="message" placeholder="RWA lending protocol, need pre-settlement fraud scoring\u2026"></textarea>' +
      '<button class="axb">Request access</button>' +
      '</div>' +
      '<div class="axok"><b>Request received</b><span>Guardian has logged it. We\u2019ll be in touch soon.</span></div>' +
      '</div>';
    document.body.appendChild(bg);

    bg.addEventListener('click', function(e){ if (e.target === bg) close(); });
    bg.querySelector('.axx').addEventListener('click', close);

    var btn = bg.querySelector('.axb');
    var err = bg.querySelector('.axe');
    btn.addEventListener('click', function(){
      var email = bg.querySelector('#ax-email').value.trim();
      if (!email || email.indexOf('@') < 1){
        err.textContent = 'Enter a valid email address.';
        err.style.display = 'block';
        return;
      }
      err.style.display = 'none';
      btn.disabled = true;
      btn.textContent = 'Sending\u2026';
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          email: email,
          name: bg.querySelector('#ax-name').value.trim(),
          message: bg.querySelector('#ax-msg').value.trim(),
          _subject: 'CYRE early access request'
        })
      }).then(function(r){
        if (r.ok){
          bg.querySelector('.axf').style.display = 'none';
          bg.querySelector('.axok').style.display = 'block';
        } else {
          throw new Error('bad status');
        }
      }).catch(function(){
        btn.disabled = false;
        btn.textContent = 'Request access';
        err.textContent = 'Something went wrong \u2014 try again in a moment.';
        err.style.display = 'block';
      });
    });
    setTimeout(function(){ bg.querySelector('#ax-email').focus(); }, 50);
  }

  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') close(); });

  document.addEventListener('click', function(e){
    var el = e.target.closest('a,button');
    if (!el) return;
    var txt = (el.textContent || '').toLowerCase();
    if (txt.indexOf('request early access') !== -1 || txt.trim() === 'request access'){
      e.preventDefault();
      open();
    }
  }, true);
})();
