// api/_authentic-compose.js — photo + discreet seal (QR plate + handle text).
// Hard floor: ≥5 px/module. If that exceeds the ~9% discreet budget, scannable wins + warn.

import QRCode from 'qrcode';
import jpeg from 'jpeg-js';
import { decodePng, encodePng } from './_badge-og-render.js';

export const PLATFORMS = {
  'x-banner': { w: 1500, h: 500, label: 'X banner' },
  'x-avatar': { w: 400, h: 400, label: 'X avatar' },
  'tg-banner': { w: 1280, h: 640, label: 'Telegram banner' },
  'tg-avatar': { w: 512, h: 512, label: 'Telegram avatar' }
};

export const CORNERS = new Set(['top-right', 'top-left', 'bottom-right', 'bottom-left']);

const MIN_MODULE_PX = 5;
const DISCREET_FRAC = 0.09;
const SEAL_PAD = 10;
const QUIET = 4;
const GLYPH_W = 5;
const GLYPH_H = 7;

const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10001', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10001', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  _: ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
  '@': ['01110', '10001', '10101', '10111', '10100', '10000', '01111'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000']
};

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function decodeUpload(buf) {
  if (!buf || !buf.length) throw new Error('empty_image');
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    const img = decodePng(buf);
    return { rgba: Buffer.from(img.rgba), width: img.width, height: img.height };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    const img = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
    return { rgba: Buffer.from(img.data), width: img.width, height: img.height };
  }
  throw new Error('unsupported_image');
}

export function coverResize(src, sw, sh, tw, th) {
  const scale = Math.max(tw / sw, th / sh);
  const rw = Math.round(sw * scale);
  const rh = Math.round(sh * scale);
  const ox = Math.floor((rw - tw) / 2);
  const oy = Math.floor((rh - th) / 2);
  const out = Buffer.alloc(tw * th * 4);
  for (let y = 0; y < th; y++) {
    const sy = clamp(Math.floor(((y + oy) * sh) / rh), 0, sh - 1);
    for (let x = 0; x < tw; x++) {
      const sx = clamp(Math.floor(((x + ox) * sw) / rw), 0, sw - 1);
      const si = (sy * sw + sx) * 4;
      const di = (y * tw + x) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3];
    }
  }
  return out;
}

function fillRect(dst, dw, dh, x, y, w, h, rgb) {
  for (let yy = y; yy < y + h; yy++) {
    if (yy < 0 || yy >= dh) continue;
    for (let xx = x; xx < x + w; xx++) {
      if (xx < 0 || xx >= dw) continue;
      const o = (yy * dw + xx) * 4;
      dst[o] = rgb[0];
      dst[o + 1] = rgb[1];
      dst[o + 2] = rgb[2];
      dst[o + 3] = 255;
    }
  }
}

function blit(dst, dw, dh, src, sw, sh, dx, dy) {
  for (let y = 0; y < sh; y++) {
    const ty = dy + y;
    if (ty < 0 || ty >= dh) continue;
    for (let x = 0; x < sw; x++) {
      const tx = dx + x;
      if (tx < 0 || tx >= dw) continue;
      const si = (y * sw + x) * 4;
      const di = (ty * dw + tx) * 4;
      const a = src[si + 3] / 255;
      if (a <= 0) continue;
      dst[di] = Math.round(src[si] * a + dst[di] * (1 - a));
      dst[di + 1] = Math.round(src[si + 1] * a + dst[di + 1] * (1 - a));
      dst[di + 2] = Math.round(src[si + 2] * a + dst[di + 2] * (1 - a));
      dst[di + 3] = 255;
    }
  }
}

function textWidth(text, scale) {
  return String(text || '').length * (GLYPH_W + 1) * scale;
}

function drawText(dst, dw, dh, text, x, y, scale, rgb) {
  const t = String(text || '').toUpperCase();
  let cx = x;
  for (const ch of t) {
    const g = FONT[ch] || FONT['.'];
    for (let row = 0; row < GLYPH_H; row++) {
      for (let col = 0; col < GLYPH_W; col++) {
        if (g[row][col] !== '1') continue;
        fillRect(dst, dw, dh, cx + col * scale, y + row * scale, scale, scale, rgb);
      }
    }
    cx += (GLYPH_W + 1) * scale;
  }
}

async function buildQrModules(url) {
  const matrix = await QRCode.create(url, { errorCorrectionLevel: 'M' });
  return matrix.modules;
}

function moduleSpan(modules) {
  return modules.size + QUIET * 2;
}

function rasterQr(modules, modulePx) {
  const size = modules.size;
  const dim = (size + QUIET * 2) * modulePx;
  const rgba = Buffer.alloc(dim * dim * 4, 255);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dark = typeof modules.get === 'function' ? modules.get(x, y) : modules.data[y * size + x];
      if (!dark) continue;
      const x0 = (x + QUIET) * modulePx;
      const y0 = (y + QUIET) * modulePx;
      for (let dy = 0; dy < modulePx; dy++) {
        for (let dx = 0; dx < modulePx; dx++) {
          const o = ((y0 + dy) * dim + (x0 + dx)) * 4;
          rgba[o] = 0;
          rgba[o + 1] = 0;
          rgba[o + 2] = 0;
          rgba[o + 3] = 255;
        }
      }
    }
  }
  return { rgba, width: dim, height: dim };
}

/**
 * @returns {{ png: Buffer, meta: object }}
 */
export async function composeAuthenticSeal({
  imageBuf,
  platform,
  corner = 'top-right',
  handle,
  checkUrl
}) {
  const spec = PLATFORMS[platform];
  if (!spec) throw new Error('bad_platform');
  if (!CORNERS.has(corner)) corner = 'top-right';
  const h = String(handle || '').replace(/^@/, '');
  if (!h) throw new Error('missing_handle');
  if (!checkUrl) throw new Error('missing_check_url');

  const src = decodeUpload(imageBuf);
  const rgba = coverResize(src.rgba, src.width, src.height, spec.w, spec.h);
  const short = Math.min(spec.w, spec.h);

  const modules = await buildQrModules(checkUrl);
  const mCount = moduleSpan(modules);
  const discreetBudget = Math.round(short * DISCREET_FRAC);
  const minQrPx = mCount * MIN_MODULE_PX;
  let modulePx = MIN_MODULE_PX;
  let warnScannableOverride = false;
  if (minQrPx <= discreetBudget) {
    modulePx = Math.max(MIN_MODULE_PX, Math.floor(discreetBudget / mCount));
  } else {
    modulePx = MIN_MODULE_PX;
    warnScannableOverride = true;
  }

  const qr = rasterQr(modules, modulePx);
  const handleLabel = '@' + h;
  let textScale = Math.max(2, Math.round(qr.width / 90));
  while (textScale > 1 && textWidth(handleLabel, textScale) > qr.width) textScale -= 1;
  const textH = GLYPH_H * textScale;
  const plateW = qr.width + SEAL_PAD * 2;
  const plateH = qr.height + textH + SEAL_PAD * 3;
  const plate = Buffer.alloc(plateW * plateH * 4, 255);
  fillRect(plate, plateW, plateH, 0, 0, plateW, plateH, [250, 246, 235]);
  for (let i = 0; i < plateW; i++) {
    fillRect(plate, plateW, plateH, i, 0, 1, 2, [212, 168, 75]);
    fillRect(plate, plateW, plateH, i, plateH - 2, 1, 2, [212, 168, 75]);
  }
  for (let j = 0; j < plateH; j++) {
    fillRect(plate, plateW, plateH, 0, j, 2, 1, [212, 168, 75]);
    fillRect(plate, plateW, plateH, plateW - 2, j, 2, 1, [212, 168, 75]);
  }
  blit(plate, plateW, plateH, qr.rgba, qr.width, qr.height, SEAL_PAD, SEAL_PAD);
  const tx = SEAL_PAD + Math.max(0, Math.floor((qr.width - textWidth(handleLabel, textScale)) / 2));
  const ty = SEAL_PAD + qr.height + Math.floor(SEAL_PAD / 2);
  drawText(plate, plateW, plateH, handleLabel, tx, ty, textScale, [24, 28, 22]);

  const margin = Math.max(8, Math.round(short * 0.02));
  let dx = margin;
  let dy = margin;
  if (corner.includes('right')) dx = spec.w - plateW - margin;
  if (corner.includes('bottom')) dy = spec.h - plateH - margin;
  dx = clamp(dx, 0, spec.w - plateW);
  dy = clamp(dy, 0, spec.h - plateH);
  blit(rgba, spec.w, spec.h, plate, plateW, plateH, dx, dy);

  return {
    png: encodePng(rgba, spec.w, spec.h),
    meta: {
      platform,
      width: spec.w,
      height: spec.h,
      corner,
      handle: h,
      checkUrl,
      modulePx,
      qrModules: modules.size,
      qrPx: qr.width,
      sealPx: Math.max(plateW, plateH),
      discreetBudget,
      warnScannableOverride,
      sealFrac: Math.max(plateW, plateH) / short
    }
  };
}
