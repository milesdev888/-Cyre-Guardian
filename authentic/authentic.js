const $ = (id) => document.getElementById(id);

const state = {
  session: localStorage.getItem('ga_session') || '',
  wallet: localStorage.getItem('ga_wallet') || '',
  account: null,
  imageBase64: null,
  lastSerial: null
};

function hdr(json) {
  const h = {};
  if (json) h['Content-Type'] = 'application/json';
  if (state.session) h.Authorization = 'Bearer ' + state.session;
  return h;
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { ...hdr(!!opts.body), ...(opts.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function status(el, text, ok) {
  if (!el) return;
  el.textContent = text || '';
  el.classList.remove('ok', 'err');
  if (ok === true) el.classList.add('ok');
  if (ok === false) el.classList.add('err');
}

function renderAccount(a) {
  state.account = a;
  if (!a) {
    $('account-card').hidden = true;
    return;
  }
  $('account-card').hidden = false;
  $('step-pay').hidden = false;
  $('step-seal').hidden = false;
  $('step-pay').classList.toggle('muted', !!a.paid);
  $('step-seal').classList.toggle('muted', !a.paid);

  const w = a.wallet || '';
  const short = w ? w.slice(0, 6) + '…' + w.slice(-4) : '—';
  $('account-meta').innerHTML = `
    <dt>Wallet</dt><dd title="${w}">${short}</dd>
    <dt>Handle</dt><dd>@${a.handle}</dd>
    <dt>Account age</dt><dd>${a.accountAgeLabel || '—'} <small>(${a.accountAgeSource || 'user-supplied'})</small></dd>
    <dt>Payment</dt><dd>${a.paid ? 'Unlocked' : 'Required'}${
      a.paymentTx
        ? ` · <a href="https://basescan.org/tx/${a.paymentTx}" target="_blank" rel="noopener">tx</a>`
        : ''
    }</dd>
    <dt>Active serial</dt><dd>${a.activeSerial || '—'}</dd>
    <dt>Seals</dt><dd>${a.sealCount || 0}</dd>
  `;
  if (a.paid) status($('pay-status'), 'Unlocked — reissue is free.', true);
}

async function refreshAccount() {
  if (!state.session) return;
  const { res, data } = await api('/api/authentic/account');
  if (res.ok && data.account) renderAccount(data.account);
}

async function connect() {
  const el = $('connect-status');
  try {
    if (!window.ethereum) {
      status(el, 'No wallet detected. Open in a Base-ready wallet browser.', false);
      return;
    }
    const handle = ($('handle').value || '').replace(/^@/, '').trim();
    const age = ($('age').value || '').trim();
    status(el, 'Requesting wallet…');
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const wallet = accounts[0];
    state.wallet = wallet;
    localStorage.setItem('ga_wallet', wallet);

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2105' }]
      });
    } catch (e) {
      if (e && e.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x2105',
            chainName: 'Base',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://mainnet.base.org'],
            blockExplorerUrls: ['https://basescan.org']
          }]
        });
      }
    }

    const existing = await api('/api/authentic/account?wallet=' + encodeURIComponent(wallet));
    const registered = existing.res.ok && existing.data.account;
    if (!registered && !handle) {
      status(el, 'Enter a handle to seal on first connect.', false);
      return;
    }

    const nonceRes = await api('/api/authentic/account', {
      method: 'POST',
      body: JSON.stringify({
        action: 'nonce',
        wallet,
        handle: handle || (registered && existing.data.account.handle)
      })
    });
    if (!nonceRes.res.ok) {
      status(el, nonceRes.data.error || 'Could not start login', false);
      return;
    }

    status(el, 'Sign to prove ownership…');
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [nonceRes.data.message, wallet]
    });

    const loginRes = await api('/api/authentic/account', {
      method: 'POST',
      body: JSON.stringify({
        action: registered ? 'login' : 'register',
        wallet,
        handle,
        accountAgeLabel: age,
        message: nonceRes.data.message,
        signature
      })
    });
    if (!loginRes.res.ok) {
      status(el, loginRes.data.error || 'Login failed', false);
      return;
    }
    state.session = loginRes.data.session;
    localStorage.setItem('ga_session', state.session);
    renderAccount(loginRes.data.account);
    status(el, 'Connected as @' + loginRes.data.account.handle, true);
  } catch (e) {
    status(el, e.message || String(e), false);
  }
}

async function pay() {
  const el = $('pay-status');
  const txEl = $('pay-tx');
  txEl.hidden = true;
  try {
    status(el, 'Opening Base USDC payment…');
    try {
      const { wrapFetchWithPaymentFromConfig } = await import('https://esm.sh/@x402/fetch@0.2.0');
      const { ExactEvmScheme } = await import('https://esm.sh/@x402/evm@0.2.0');
      const { createWalletClient, custom } = await import('https://esm.sh/viem@2.21.0');
      const { base } = await import('https://esm.sh/viem@2.21.0/chains');
      const walletClient = createWalletClient({
        account: state.wallet,
        chain: base,
        transport: custom(window.ethereum)
      });
      const fetchPaid = wrapFetchWithPaymentFromConfig(fetch, {
        schemes: [{ network: 'eip155:8453', client: new ExactEvmScheme(walletClient) }],
        maxPaymentAmount: 25_000_000n
      });
      status(el, 'Confirm $25 USDC in your wallet…');
      const res = await fetchPaid('/api/authentic/pay', {
        method: 'POST',
        headers: hdr(true),
        body: JSON.stringify({ wallet: state.wallet })
      });
      const data = await res.json();
      if (!res.ok) {
        status(el, data.error || data.detail || 'Payment failed', false);
        return;
      }
      status(el, data.alreadyPaid ? 'Already unlocked.' : 'Paid — generation unlocked.', true);
      if (data.paymentTx) {
        txEl.hidden = false;
        txEl.innerHTML = `Tx <a href="https://basescan.org/tx/${data.paymentTx}" target="_blank" rel="noopener">${data.paymentTx}</a>`;
      }
      await refreshAccount();
      return;
    } catch (e) {
      const { res, data } = await api('/api/authentic/pay', {
        method: 'POST',
        body: JSON.stringify({ wallet: state.wallet })
      });
      if (res.status === 402) {
        status(el, 'Payment required. x402 client: ' + (e.message || e), false);
        return;
      }
      if (!res.ok) {
        status(el, data.error || data.detail || 'Payment failed', false);
        return;
      }
      status(el, data.alreadyPaid ? 'Already unlocked.' : 'Paid.', true);
      if (data.paymentTx) {
        txEl.hidden = false;
        txEl.textContent = data.paymentTx;
      }
      await refreshAccount();
    }
  } catch (e) {
    status(el, e.message || String(e), false);
  }
}

function fileToB64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || '');
      resolve(s.includes(',') ? s.split(',')[1] : s);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function showJobResult(job, seal) {
  const el = $('seal-status');
  const panel = $('job-panel');
  const result = $('result');
  panel.hidden = true;
  status(el, 'Ready · ' + job.resultSerial, true);
  $('result-img').src = seal.imageUrl + '&t=' + Date.now();
  $('result-dl').href = seal.imageUrl;
  $('result-dl').download = job.resultSerial + '.png';
  $('result-check').href = '/authentic/c/' + job.resultSerial;
  const warn = $('result-warn');
  if (job.warnScannableOverride || (seal && seal.warnScannableOverride)) {
    warn.hidden = false;
    warn.textContent = 'Scannable won over discreet — modules held at 5px on this size.';
  } else {
    warn.hidden = true;
  }
  result.hidden = false;
  state.lastSerial = job.resultSerial;
  await refreshAccount();
  $('btn-seal').disabled = false;
}

async function pollUntilDone(jobId) {
  const el = $('seal-status');
  const panel = $('job-panel');
  for (;;) {
    const poll = await api('/api/authentic/jobs?id=' + encodeURIComponent(jobId));
    const job = poll.data.job;
    if (!job) {
      status(el, 'Job missing', false);
      $('btn-seal').disabled = false;
      return;
    }
    if (job.status === 'pending') {
      panel.hidden = false;
      $('job-note').textContent = job.queueNote || 'Waiting in queue…';
      await api('/api/authentic/worker', { method: 'POST', body: '{}' }).catch(() => {});
    } else if (job.status === 'running') {
      panel.hidden = false;
      $('job-note').textContent = 'Compositing…';
    } else if (job.status === 'done') {
      await showJobResult(job, poll.data.seal);
      return;
    } else if (job.status === 'error') {
      panel.hidden = true;
      status(el, job.error || 'Failed', false);
      $('btn-seal').disabled = false;
      return;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

async function queueSeal() {
  const el = $('seal-status');
  const panel = $('job-panel');
  const result = $('result');
  result.hidden = true;
  if (!state.imageBase64) {
    status(el, 'Choose a photo first.', false);
    return;
  }
  if (!state.account || !state.account.paid) {
    status(el, 'Pay $25 USDC first.', false);
    return;
  }
  $('btn-seal').disabled = true;
  panel.hidden = false;
  $('job-note').textContent = 'Queued — one seal at a time…';
  status(el, 'Submitting…');

  try {
    const { res, data } = await api('/api/authentic/jobs', {
      method: 'POST',
      body: JSON.stringify({
        platform: $('platform').value,
        corner: $('corner').value,
        imageBase64: state.imageBase64
      })
    });
    if (res.status === 402) {
      status(el, 'Payment required.', false);
      panel.hidden = true;
      $('btn-seal').disabled = false;
      return;
    }
    if (!res.ok) {
      status(el, data.error || 'Queue failed', false);
      panel.hidden = true;
      $('btn-seal').disabled = false;
      return;
    }

    const jobId = data.job.id;
    if (data.job.status === 'done') {
      const poll = await api('/api/authentic/jobs?id=' + encodeURIComponent(jobId));
      await showJobResult(poll.data.job, poll.data.seal);
      return;
    }
    status(el, 'Queued');
    await pollUntilDone(jobId);
  } catch (e) {
    status(el, e.message || String(e), false);
    panel.hidden = true;
    $('btn-seal').disabled = false;
  }
}

async function revoke() {
  const serial = state.lastSerial || (state.account && state.account.activeSerial);
  if (!serial) return;
  if (!confirm('Revoke ' + serial + '? Check page will show a loud red REVOKED state.')) return;
  const { res, data } = await api('/api/authentic/revoke', {
    method: 'POST',
    body: JSON.stringify({ serial })
  });
  if (!res.ok) {
    alert(data.error || 'Revoke failed');
    return;
  }
  status($('seal-status'), serial + ' revoked.', true);
  await refreshAccount();
}

$('btn-connect').addEventListener('click', connect);
$('btn-pay').addEventListener('click', pay);
$('btn-seal').addEventListener('click', queueSeal);
$('btn-revoke').addEventListener('click', revoke);
$('photo').addEventListener('change', async (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  state.imageBase64 = await fileToB64(f);
  $('btn-seal').disabled = false;
  status($('seal-status'), f.name + ' ready');
});
$('btn-ios-hint').addEventListener('click', () => $('ios-dialog').showModal());
$('ios-close').addEventListener('click', () => $('ios-dialog').close());

if (state.session) {
  refreshAccount().catch(() => {
    localStorage.removeItem('ga_session');
    state.session = '';
  });
}
