// api/authentic-image.js

import QRCode from 'qrcode';
import { getSeal, siteBase } from './_authentic-store.js';
import { cors } from './_authentic-auth.js';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).end('method_not_allowed');
  }

  const serial = String((req.query && req.query.serial) || '')
    .trim()
    .toUpperCase();
  if (!serial) return res.status(400).end('serial_required');
  const seal = await getSeal(serial);
  if (!seal) return res.status(404).end('not_found');

  if (String(req.query.plate || '') === '1') {
    const url = `${siteBase(req)}/authentic/c/${seal.serial}`;
    const png = await QRCode.toBuffer(url, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 4,
      width: 512,
      color: { dark: '#000000', light: '#ffffff' }
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(png);
  }

  if (!seal.imagePngBase64) return res.status(404).end('no_image');
  const buf = Buffer.from(seal.imagePngBase64, 'base64');
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Content-Disposition', `inline; filename="${seal.serial}.png"`);
  return res.status(200).send(buf);
}
