// api/_badge-scan-qr.test.js — phone-scan plate: quiet≥4, modulePx≥5, ECC Q, short /v/ URL.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import jsqr from 'jsqr';
import { renderScanQrPng, sealVerifyUrl } from './_badge-seal-render.js';
import { decodePng } from './_badge-og-render.js';
import { GENESIS_SERIAL } from './_badge-registry.js';

const url = sealVerifyUrl(GENESIS_SERIAL);
assert.match(url, /\/v\/GRD-2026-00001$/);

const plate = await renderScanQrPng(url, { modulePx: 5, ecc: 'Q', quiet: 4 });
assert.ok(plate.scale >= 5, `modulePx must be ≥5, got ${plate.scale}`);
assert.ok(plate.quiet >= 4, `quiet zone must be ≥4 modules, got ${plate.quiet}`);
assert.equal(plate.url, url);

const img = decodePng(plate.png);
assert.equal(img.width, plate.width);
assert.equal(img.height, plate.height);

const code = jsqr(new Uint8ClampedArray(img.rgba), img.width, img.height);
assert.ok(code && code.data, 'scan QR plate must decode (jsQR)');
assert.equal(code.data, url);

const artDir = '/opt/cursor/artifacts';
fs.mkdirSync(artDir, { recursive: true });
fs.writeFileSync(`${artDir}/GRD-2026-00001-scan-qr.png`, plate.png);
fs.writeFileSync(
  `${artDir}/scan-qr-report.json`,
  JSON.stringify(
    {
      cause: 2,
      causeLabel: 'module size vs display resolution (embedded seal QR scaled below ~3px/module)',
      serial: GENESIS_SERIAL,
      url,
      modules: plate.modules,
      modulePx: plate.scale,
      quietModules: plate.quiet,
      quietPx: plate.quiet * plate.scale,
      platePx: plate.width,
      dataPx: plate.dataPx,
      ecc: 'Q',
      decoded: code.data,
      sealDisplayUiPx: 88,
      ogQrDisplayPx: 200,
      ogQrModulePxApprox: Number(((200 / plate.width) * plate.scale).toFixed(2)),
      pass: true
    },
    null,
    2
  )
);

console.log(
  `_badge-scan-qr.test.js: ok — ${plate.modules} modules × ${plate.scale}px · quiet ${plate.quiet} · ${plate.width}px → ${code.data}`
);
