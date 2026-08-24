/* scan-swap.js — Guardian Protected Swap gate (SWAP-SPEC §6)
   Scan first, swap second. Jupiter Plugin embedded; no custom tx code. */

(function () {
  'use strict';

  var SOL = 'So11111111111111111111111111111111111111112';
  var cfg = window.CYRE_SWAP_CONFIG || {};
  var GATE_MS = (cfg.scanGateMinutes || 10) * 60 * 1000;

  var state = 'IDLE';
  var scanned = null;
  var pluginReady = false;
  var expiryTimer = null;

  function $(id) { return document.getElementById(id); }

  function shortMint(m) {
    if (!m || m.length < 12) return m || '—';
    return m.slice(0, 4) + '…' + m.slice(-4);
  }

  function fmtTime(d) {
    try { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch (_) { return ''; }
  }

  function isExpired() {
    return !scanned || (Date.now() - scanned.at > GATE_MS);
  }

  function setProceedEnabled(on) {
    var btn = $('proceed-swap');
    if (btn) btn.disabled = !on;
  }

  function showGateNotice(msg) {
    var el = $('swap-notice');
    if (!el) return;
    if (msg) { el.textContent = msg; el.style.display = 'block'; }
    else el.style.display = 'none';
  }

  function hideSwapPanel() {
    var panel = $('swap-panel');
    var jup = $('jup');
    if (panel) panel.style.display = 'none';
    if (jup) jup.innerHTML = '';
    if (window.Jupiter && typeof window.Jupiter.close === 'function') {
      try { window.Jupiter.close(); } catch (_) {}
    }
    var rem = $('scan-reminder');
    if (rem) rem.style.display = 'none';
  }

  function showProceedBlock(show) {
    var block = $('proceed-block');
    if (block) block.style.display = show ? 'block' : 'none';
  }

  function updateHighGate(risk) {
    var wrap = $('high-confirm');
    var box = $('high-read');
    if (!wrap || !box) return;
    if (risk === 'HIGH') {
      wrap.style.display = 'block';
      box.checked = false;
      setProceedEnabled(false);
    } else {
      wrap.style.display = 'none';
      box.checked = false;
      setProceedEnabled(!isExpired());
    }
  }

  function showSwapTeaser(show) {
    var el = $('swap-teaser');
    if (!el) return;
    el.classList.toggle('is-unlocked', !show);
  }

  function resetToIdle() {
    state = 'IDLE';
    scanned = null;
    if (expiryTimer) { clearTimeout(expiryTimer); expiryTimer = null; }
    hideSwapPanel();
    showProceedBlock(false);
    showSwapTeaser(true);
    showGateNotice('');
    setProceedEnabled(false);
  }

  function onScanSuccess(mint, data) {
    scanned = { mint: mint, risk: data.risk, at: Date.now() };
    state = 'SCANNED';
    hideSwapPanel();
    showProceedBlock(true);
    showSwapTeaser(false);
    updateHighGate(data.risk);
    showGateNotice('');

    var block = $('proceed-block');
    if (block && block.scrollIntoView) {
      block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    if (expiryTimer) clearTimeout(expiryTimer);
    expiryTimer = setTimeout(function () {
      if (state === 'SCANNED') {
        setProceedEnabled(false);
        showGateNotice('Scan expired — run Guardian scan again before swapping.');
      }
      if (state === 'SWAP') {
        rearmGate('Scan expired — re-scan this token before swapping.');
      }
    }, GATE_MS);
  }

  function rearmGate(reason) {
    state = 'SCANNED';
    hideSwapPanel();
    showProceedBlock(true);
    showSwapTeaser(false);
    setProceedEnabled(false);
    updateHighGate(scanned && scanned.risk);
    showGateNotice(reason || 'Output token changed — scan the token you want to swap.');
  }

  function loadPluginScript(cb) {
    if (pluginReady) return cb();
    var url = cfg.pluginScript || 'https://plugin.jup.ag/plugin-v1.js';
    if (document.querySelector('script[data-cyre-jup-plugin]')) {
      pluginReady = true;
      return cb();
    }
    var s = document.createElement('script');
    s.src = url;
    s.defer = true;
    s.setAttribute('data-preload', '');
    s.setAttribute('data-cyre-jup-plugin', '1');
    s.onload = function () { pluginReady = true; cb(); };
    s.onerror = function () { showGateNotice('Could not load swap widget — refresh and try again.'); };
    document.head.appendChild(s);
  }

  function mountJupiter(mint) {
    if (!cfg.referralAccount) {
      showGateNotice('Swap fee routing is being configured. Scan works; swap unlocks once the Jupiter referral account is set in swap-config.js.');
      return;
    }
    if (!window.Jupiter || typeof window.Jupiter.init !== 'function') {
      showGateNotice('Swap widget still loading — try again in a moment.');
      return;
    }

    var panel = $('swap-panel');
    var jup = $('jup');
    if (panel) panel.style.display = 'block';
    if (jup) jup.innerHTML = '';

    var formProps = {
      initialInputMint: cfg.solMint || SOL,
      initialOutputMint: mint,
      fixedMint: mint,
      referralAccount: cfg.referralAccount,
      referralFee: cfg.referralFeeBps || 50,
    };

    var brand = cfg.branding || {};
    window.Jupiter.init({
      displayMode: 'integrated',
      integratedTargetId: 'jup',
      formProps: formProps,
      branding: {
        name: brand.name || 'CYRE Guardian',
        logoUri: brand.logoUri || 'https://cyre.dev/cyre-token-512.png',
      },
      onFormUpdate: function (form) {
        var out = (form && (form.outputMint || form.toMint || (form.to && form.to.address))) || '';
        if (state === 'SWAP' && out && out !== mint) {
          rearmGate('Output token changed inside the widget — scan the token you want to swap.');
        }
      },
    });

    var rem = $('scan-reminder');
    if (rem) {
      rem.textContent = 'Scanned ' + shortMint(mint) + ' at ' + fmtTime(new Date(scanned.at)) + '. Patterns, not verdicts — the trade is yours.';
      rem.style.display = 'block';
    }
    showGateNotice('');
  }

  function proceedToSwap() {
    if (state !== 'SCANNED' || !scanned || isExpired()) {
      showGateNotice('Scan expired — run Guardian scan again before swapping.');
      return;
    }
    if (scanned.risk === 'HIGH') {
      var box = $('high-read');
      if (!box || !box.checked) return;
    }
    state = 'SWAP';
    showProceedBlock(false);
    showSwapTeaser(false);
    loadPluginScript(function () { mountJupiter(scanned.mint); });
  }

  function wireUi() {
    var proceed = $('proceed-swap');
    var highBox = $('high-read');
    var mintInput = $('mint');

    if (proceed) proceed.addEventListener('click', proceedToSwap);
    if (highBox) {
      highBox.addEventListener('change', function () {
        if (state === 'SCANNED' && scanned && scanned.risk === 'HIGH') {
          setProceedEnabled(highBox.checked && !isExpired());
        }
      });
    }
    if (mintInput) {
      mintInput.addEventListener('input', function () {
        if (state !== 'IDLE') resetToIdle();
      });
    }
  }

  window.CyreScanSwap = {
    onScanSuccess: onScanSuccess,
    onScanStart: function () { resetToIdle(); },
    reset: resetToIdle,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireUi);
  } else wireUi();
})();
