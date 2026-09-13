const $ = (id) => document.getElementById(id);

function serialFromLocation() {
  const m = location.pathname.match(/\/authentic\/c\/([^/]+)/i);
  if (m) return decodeURIComponent(m[1]).toUpperCase();
  return (new URLSearchParams(location.search).get('serial') || '').toUpperCase();
}

function render(data) {
  $('verdict').hidden = false;
  const banner = $('status-banner');
  banner.className = 'banner ' + data.status;
  if (data.status === 'valid') banner.textContent = 'VALID';
  else if (data.status === 'superseded') banner.textContent = 'SUPERSEDED — a newer seal exists';
  else if (data.status === 'revoked') banner.textContent = 'REVOKED — do not trust this image';
  else banner.textContent = String(data.status || 'UNKNOWN').toUpperCase();

  $('check-meta').innerHTML = `
    <dt>Serial</dt><dd>${data.serial}</dd>
    <dt>Handle</dt><dd>@${data.handle || '—'}</dd>
    <dt>Account age</dt><dd>${data.accountAgeLabel || '—'} <small>(${data.accountAgeSource || 'user-supplied'})</small></dd>
    <dt>Registered</dt><dd>${data.registeredAt || '—'}</dd>
    <dt>Sealed</dt><dd>${data.createdAt || '—'}</dd>
    ${
      data.supersededBy
        ? `<dt>Superseded by</dt><dd><a href="/authentic/c/${data.supersededBy}">${data.supersededBy}</a></dd>`
        : ''
    }
    ${data.revokedAt ? `<dt>Revoked</dt><dd>${data.revokedAt}</dd>` : ''}
  `;

  const img = $('check-img');
  if (data.imageUrl) {
    img.hidden = false;
    img.src = data.imageUrl + '&t=' + Date.now();
  } else {
    img.hidden = true;
  }

  const openQr = () => {
    $('qr-full').src = (data.expandQrUrl || data.imageUrl) + '&t=' + Date.now();
    $('qr-dialog').showModal();
  };
  $('btn-expand-qr').onclick = openQr;
  $('glyph-btn').onclick = openQr;
}

async function runCheck(serial) {
  const res = await fetch('/api/authentic/check?serial=' + encodeURIComponent(serial));
  const data = await res.json();
  if (!data.ok) {
    $('verdict').hidden = false;
    $('status-banner').className = 'banner revoked';
    $('status-banner').textContent = 'NOT FOUND';
    $('check-meta').innerHTML = `<dt>Serial</dt><dd>${serial}</dd>`;
    $('check-img').hidden = true;
    return;
  }
  render(data);
  history.replaceState(null, '', '/authentic/c/' + encodeURIComponent(serial));
}

$('check-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const s = ($('serial').value || '').trim().toUpperCase();
  if (s) runCheck(s);
});
$('qr-close').addEventListener('click', () => $('qr-dialog').close());

const initial = serialFromLocation();
if (initial) {
  $('serial').value = initial;
  runCheck(initial);
}
