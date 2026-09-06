// api/_badge-og-render.js — 1200×630 OG card from LIVE check state.
// Pure Node (zlib) PNG — no native deps. Seal right-of-center; REVOKED = gray seal + red stamp.

import zlib from 'node:zlib';

const W = 1200;
const H = 630;

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/** @param {Buffer} rgba width*height*4 */
export function encodePng(rgba, width, height) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function fillRect(rgba, x, y, w, h, r, g, b, a = 255) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 4;
      const srcA = a / 255;
      const dstA = rgba[i + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      if (outA <= 0) continue;
      rgba[i] = Math.round((r * srcA + rgba[i] * dstA * (1 - srcA)) / outA);
      rgba[i + 1] = Math.round((g * srcA + rgba[i + 1] * dstA * (1 - srcA)) / outA);
      rgba[i + 2] = Math.round((b * srcA + rgba[i + 2] * dstA * (1 - srcA)) / outA);
      rgba[i + 3] = Math.round(outA * 255);
    }
  }
}

function fillCircle(rgba, cx, cy, radius, r, g, b, a = 255) {
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const x1 = Math.min(W, Math.ceil(cx + radius));
  const y1 = Math.min(H, Math.ceil(cy + radius));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const dx = xx + 0.5 - cx;
      const dy = yy + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) {
        const i = (yy * W + xx) * 4;
        rgba[i] = r;
        rgba[i + 1] = g;
        rgba[i + 2] = b;
        rgba[i + 3] = a;
      }
    }
  }
}

/** Tiny 5x7 bitmap font (subset). */
const GLYPHS = {
  ' ': [0, 0, 0, 0, 0],
  '-': [0, 0, 31, 0, 0],
  '.': [0, 0, 0, 0, 4],
  ':': [0, 4, 0, 4, 0],
  '/': [1, 2, 4, 8, 16],
  $: [4, 15, 20, 15, 4],
  _: [0, 0, 0, 0, 31],
  '0': [14, 17, 17, 17, 14],
  '1': [4, 12, 4, 4, 14],
  '2': [14, 1, 14, 16, 31],
  '3': [30, 1, 14, 1, 30],
  '4': [17, 17, 31, 1, 1],
  '5': [31, 16, 30, 1, 30],
  '6': [14, 16, 30, 17, 14],
  '7': [31, 1, 2, 4, 8],
  '8': [14, 17, 14, 17, 14],
  '9': [14, 17, 15, 1, 14],
  A: [14, 17, 31, 17, 17],
  B: [30, 17, 30, 17, 30],
  C: [14, 17, 16, 17, 14],
  D: [30, 17, 17, 17, 30],
  E: [31, 16, 30, 16, 31],
  F: [31, 16, 30, 16, 16],
  G: [14, 16, 19, 17, 14],
  H: [17, 17, 31, 17, 17],
  I: [14, 4, 4, 4, 14],
  J: [1, 1, 1, 17, 14],
  K: [17, 18, 28, 18, 17],
  L: [16, 16, 16, 16, 31],
  M: [17, 27, 21, 17, 17],
  N: [17, 25, 21, 19, 17],
  O: [14, 17, 17, 17, 14],
  P: [30, 17, 30, 16, 16],
  Q: [14, 17, 17, 19, 15],
  R: [30, 17, 30, 18, 17],
  S: [15, 16, 14, 1, 30],
  T: [31, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 14],
  V: [17, 17, 17, 10, 4],
  W: [17, 17, 21, 21, 10],
  X: [17, 10, 4, 10, 17],
  Y: [17, 10, 4, 4, 4],
  Z: [31, 2, 4, 8, 31]
};

function drawText(rgba, text, x, y, scale, r, g, b) {
  let cursor = x;
  const up = String(text || '').toUpperCase();
  for (const ch of up) {
    const g5 = GLYPHS[ch] || GLYPHS['-'];
    for (let row = 0; row < 5; row++) {
      const bits = g5[row] ?? 0;
      for (let col = 0; col < 5; col++) {
        if (bits & (16 >> col)) {
          fillRect(rgba, cursor + col * scale, y + row * scale, scale, scale, r, g, b, 255);
        }
      }
    }
    cursor += 6 * scale;
  }
}

function drawSeal(rgba, cx, cy, radius, revoked) {
  const outer = revoked ? [110, 110, 110] : [201, 162, 39];
  const mid = revoked ? [150, 150, 150] : [232, 198, 90];
  const inner = revoked ? [70, 70, 70] : [120, 90, 20];
  const iris = revoked ? [90, 90, 90] : [61, 220, 132];
  const eye = [20, 28, 22];

  // Coin body
  fillCircle(rgba, cx, cy, radius, mid[0], mid[1], mid[2], 255);
  // Rings
  for (let i = 0; i < 4; i++) {
    const rr = radius - 4 - i * 5;
    for (let a = 0; a < 360; a += 2) {
      const rad = (a * Math.PI) / 180;
      const x = Math.round(cx + rr * Math.cos(rad));
      const y = Math.round(cy + rr * Math.sin(rad));
      if (x >= 0 && y >= 0 && x < W && y < H) {
        const idx = (y * W + x) * 4;
        rgba[idx] = outer[0];
        rgba[idx + 1] = outer[1];
        rgba[idx + 2] = outer[2];
        rgba[idx + 3] = 255;
      }
    }
  }
  fillCircle(rgba, cx, cy, radius * 0.62, inner[0], inner[1], inner[2], 255);
  // Eye almond approx as ellipse
  fillCircle(rgba, cx, cy, radius * 0.34, eye[0], eye[1], eye[2], 255);
  fillCircle(rgba, cx, cy, radius * 0.2, iris[0], iris[1], iris[2], 255);
  fillCircle(rgba, cx, cy, radius * 0.09, 10, 12, 10, 255);
  fillCircle(rgba, cx - radius * 0.06, cy - radius * 0.08, radius * 0.04, 255, 240, 180, 220);

  if (revoked) {
    // Crack lines
    for (const [x0, y0, x1, y1] of [
      [cx - radius * 0.35, cy - radius * 0.7, cx + radius * 0.45, cy + radius * 0.55],
      [cx + radius * 0.4, cy - radius * 0.55, cx - radius * 0.5, cy + radius * 0.4],
      [cx - radius * 0.7, cy + radius * 0.05, cx + radius * 0.55, cy + radius * 0.35]
    ]) {
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = Math.round(x0 + (x1 - x0) * t);
        const y = Math.round(y0 + (y1 - y0) * t);
        fillRect(rgba, x - 1, y - 1, 3, 3, 30, 30, 30, 230);
      }
    }
  }
}

/**
 * @param {{
 *  serial: string,
 *  symbol?: string|null,
 *  name?: string|null,
 *  pathLabel?: string|null,
 *  pathFamily?: string|null,
 *  grade?: string|null,
 *  score?: number|null,
 *  lpTier?: string|null,
 *  status: 'VALID'|'REVOKED'|'EXPIRED',
 *  issuedAt?: string|null,
 *  liveGrade?: string|null,
 *  livePath?: string|null,
 *  checkedAt?: string|null
 * }} input
 */
export function renderBadgeOg(input) {
  const rgba = Buffer.alloc(W * H * 4, 0);
  // Background gradient-ish
  for (let y = 0; y < H; y++) {
    const t = y / H;
    const r = Math.round(11 + t * 8);
    const g = Math.round(18 + t * 10);
    const b = Math.round(16 + t * 8);
    fillRect(rgba, 0, y, W, 1, r, g, b, 255);
  }
  fillRect(rgba, 40, 40, W - 80, H - 80, 18, 26, 22, 255);
  fillRect(rgba, 44, 44, W - 88, H - 88, 12, 18, 15, 255);

  const revoked = input.status === 'REVOKED';
  const expired = input.status === 'EXPIRED';

  drawText(rgba, 'GUARDIAN', 72, 70, 5, 201, 162, 39);
  drawText(rgba, input.status === 'VALID' ? 'BADGE VERIFIED' : input.status, 72, 120, 4, revoked ? 217 : expired ? 212 : 61, revoked ? 106 : expired ? 160 : 220, revoked ? 94 : expired ? 23 : 132);

  const title = (input.symbol ? `$${input.symbol}` : input.name || 'TOKEN').slice(0, 16);
  drawText(rgba, title, 72, 200, 7, 231, 239, 232);

  const pathLine = `PATH ${(input.livePath || input.pathLabel || 'NONE').toUpperCase()}`.slice(0, 28);
  drawText(rgba, pathLine, 72, 270, 3, 201, 162, 39);

  const gradeLine = `GRADE ${input.liveGrade || input.grade || '—'} · ${input.lpTier || '—'}`.slice(0, 36);
  drawText(rgba, gradeLine, 72, 320, 3, 180, 190, 180);

  drawText(rgba, String(input.serial || '').toUpperCase(), 72, 390, 3, 200, 210, 200);

  const issued = input.issuedAt ? `ISSUED ${formatUtc(input.issuedAt)}` : '';
  const checked = input.checkedAt ? `LIVE ${formatUtc(input.checkedAt)}` : '';
  if (issued) drawText(rgba, issued, 72, 450, 2, 138, 154, 144);
  if (checked) drawText(rgba, checked, 72, 490, 2, 138, 154, 144);

  // Seal right-of-center
  const sealSize = 280;
  const sealX = Math.round(W * 0.74);
  const sealY = Math.round(H / 2);
  drawSeal(rgba, sealX, sealY, sealSize / 2, revoked || expired);

  if (revoked) {
    // Red REVOKED stamp
    fillRect(rgba, 70, 540, 420, 48, 180, 40, 40, 220);
    drawText(rgba, 'REVOKED', 90, 550, 5, 255, 220, 210);
  }

  return encodePng(rgba, W, H);
}

export function formatUtc(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return String(iso).slice(0, 19) + 'Z';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}
