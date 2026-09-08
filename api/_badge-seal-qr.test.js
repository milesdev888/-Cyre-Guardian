// api/_badge-seal-qr.test.js — CI acceptance: seal QR must decode at 320px display.
// Renders GRD-2026-00001 full-res seal, downscales to 320×320, decodes with jsQR.
// Fail this test = fail CI (phone-unscannable QR must not ship).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import jsqr from 'jsqr';
import {
  renderOfficialSealWithMeta,
  SEAL_CANVAS,
  QR_MODULE_PX,
  QR_MARGIN_PX,
  sealVerifyUrl
} from './_badge-seal-render.js';
import { decodePng, downscaleRgba, encodePng } from './_badge-og-render.js';
import { GENESIS_SERIAL, GENESIS_MINT } from './_badge-registry.js';

const DISPLAY_PX = 320;
const EXPECT_URL = sealVerifyUrl(GENESIS_SERIAL);

const sealMeta = await renderOfficialSealWithMeta({
  serial: GENESIS_SERIAL,
  ca: GENESIS_MINT,
  status: 'VALID',
  pathMark: 'SECURED'
});

assert.ok(sealMeta.png && sealMeta.png[0] === 137, 'seal PNG required');
assert.ok(sealMeta.qr, 'full-res seal must include QR');
assert.equal(sealMeta.qr.qrDim, QR_MODULE_PX, `QR module field must be ${QR_MODULE_PX}px`);
assert.equal(sealMeta.qr.pad, QR_MARGIN_PX, `QR quiet-zone margin must be ${QR_MARGIN_PX}px`);
assert.equal(sealMeta.qr.dim, QR_MODULE_PX + QR_MARGIN_PX * 2);
assert.equal(sealMeta.qr.url, EXPECT_URL);
assert.ok(
  Math.abs(sealMeta.qr.qrDim / SEAL_CANVAS - 300 / 1800) < 1e-9,
  'QR must be 16.7% of 1800 master'
);

const img = decodePng(sealMeta.png);
assert.equal(img.width, SEAL_CANVAS);
assert.equal(img.height, SEAL_CANVAS);

const scaled = downscaleRgba(img.rgba, img.width, img.height, DISPLAY_PX, DISPLAY_PX);
// Composite onto opaque white so transparent seal corners do not confuse the decoder.
for (let i = 0; i < scaled.length; i += 4) {
  const a = scaled[i + 3] / 255;
  scaled[i] = Math.round(scaled[i] * a + 255 * (1 - a));
  scaled[i + 1] = Math.round(scaled[i + 1] * a + 255 * (1 - a));
  scaled[i + 2] = Math.round(scaled[i + 2] * a + 255 * (1 - a));
  scaled[i + 3] = 255;
}

const code = jsqr(new Uint8ClampedArray(scaled), DISPLAY_PX, DISPLAY_PX);
assert.ok(
  code && code.data,
  `QR must decode at ${DISPLAY_PX}px display — render fails CI if unscannable`
);
assert.equal(
  code.data,
  EXPECT_URL,
  `decoded URL must be ${EXPECT_URL}, got ${code && code.data}`
);

// Artifact for the report (optional path; ignore write failures in CI sandboxes).
try {
  fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
  fs.writeFileSync('/opt/cursor/artifacts/GRD-2026-00001-qr300-master.png', sealMeta.png);
  fs.writeFileSync(
    '/opt/cursor/artifacts/GRD-2026-00001-qr300-320px.png',
    encodePng(scaled, DISPLAY_PX, DISPLAY_PX)
  );
  fs.writeFileSync(
    '/opt/cursor/artifacts/seal-qr-decode-320-report.json',
    JSON.stringify(
      {
        serial: GENESIS_SERIAL,
        qrDim: sealMeta.qr.qrDim,
        plate: sealMeta.qr.dim,
        pct: Number((sealMeta.qr.qrDim / SEAL_CANVAS).toFixed(4)),
        displayPx: DISPLAY_PX,
        decoded: code.data,
        pass: true
      },
      null,
      2
    )
  );
} catch (_) {
  /* ignore */
}

console.log(
  `_badge-seal-qr.test.js: ok — decode@${DISPLAY_PX} → ${code.data} (module ${sealMeta.qr.qrDim}px / ${(
    (sealMeta.qr.qrDim / SEAL_CANVAS) *
    100
  ).toFixed(1)}%)`
);
