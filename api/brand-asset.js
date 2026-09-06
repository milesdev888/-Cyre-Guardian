// api/brand-asset.js — serve Guardian wordmark / OG / X-banner JPEGs.
import { PAYLOAD as wordmark_1x_0 } from './_brand_wordmark_1x_0.js';
import { PAYLOAD as wordmark_1x_1 } from './_brand_wordmark_1x_1.js';
import { PAYLOAD as wordmark_2x_0 } from './_brand_wordmark_2x_0.js';
import { PAYLOAD as wordmark_2x_1 } from './_brand_wordmark_2x_1.js';
import { PAYLOAD as wordmark_2x_2 } from './_brand_wordmark_2x_2.js';
import { PAYLOAD as wordmark_2x_3 } from './_brand_wordmark_2x_3.js';
import { PAYLOAD as wordmark_2x_4 } from './_brand_wordmark_2x_4.js';
import { PAYLOAD as og_0 } from './_brand_og_0.js';
import { PAYLOAD as og_1 } from './_brand_og_1.js';
import { PAYLOAD as banner_0 } from './_brand_banner_0.js';
import { PAYLOAD as banner_1 } from './_brand_banner_1.js';
import { PAYLOAD as banner_2 } from './_brand_banner_2.js';
import { PAYLOAD as banner_2x_0 } from './_brand_banner_2x_0.js';
import { PAYLOAD as banner_2x_1 } from './_brand_banner_2x_1.js';
import { PAYLOAD as banner_2x_2 } from './_brand_banner_2x_2.js';
import { PAYLOAD as banner_2x_3 } from './_brand_banner_2x_3.js';
import { PAYLOAD as banner_2x_4 } from './_brand_banner_2x_4.js';
import { PAYLOAD as banner_2x_5 } from './_brand_banner_2x_5.js';

const BRAND_ASSETS = {
  "guardian-wordmark.jpg": wordmark_1x_0 + wordmark_1x_1,
  "guardian-wordmark@2x.jpg": wordmark_2x_0 + wordmark_2x_1 + wordmark_2x_2 + wordmark_2x_3 + wordmark_2x_4,
  "guardian-wordmark-og.jpg": og_0 + og_1,
  "guardian-x-banner.jpg": banner_0 + banner_1 + banner_2,
  "guardian-x-banner@2x.jpg": banner_2x_0 + banner_2x_1 + banner_2x_2 + banner_2x_3 + banner_2x_4 + banner_2x_5,
};

export default function handler(req, res) {
  const file = String(req.query.file || '').replace(/^\/+/, '');
  const payload = BRAND_ASSETS[file];
  if (!payload) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('not found');
  }
  const buf = Buffer.from(payload, 'base64');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  res.setHeader('Content-Length', String(buf.length));
  res.end(buf);
}
