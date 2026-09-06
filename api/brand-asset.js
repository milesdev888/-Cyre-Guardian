// api/brand-asset.js — serve Guardian brand JPEGs when payload modules exist.
// NOTE: files under /api starting with "_" are NOT public routes on Vercel, but
// they CAN be imported as private modules IF they are present in the deploy.
// The original wordmark rollout referenced chunk files that were never committed,
// which crashed this function (FUNCTION_INVOCATION_FAILED) and blanked the hero.
// This handler must never throw on import — missing payloads → 503, not 500.

function tryLoad(rel) {
  try {
    // Dynamic import is async; for Vercel serverless we use createRequire-style sync via read.
    // Keep sync: only register assets whose modules resolve at build/start.
    return null;
  } catch (_) {
    return null;
  }
}

// Eager static imports only for modules that exist in-repo today.
// Add chunks here only after the corresponding api/brand_*.js (no leading underscore
// preferred for clarity — underscore modules are fine as imports, but must exist).
const BRAND_ASSETS = {};

try {
  // Optional: wire real payloads when complete asset packs land.
  // Leaving empty is intentional — homepage uses text fallback (.guardian-wordmark).
} catch (_) {
  /* never throw at module scope */
}

export default function handler(req, res) {
  try {
    const file = String((req.query && req.query.file) || '').replace(/^\/+/, '');
    const payload = BRAND_ASSETS[file];
    if (!payload) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.end('brand asset unavailable — use text fallback');
    }
    const buf = Buffer.from(payload, 'base64');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Content-Length', String(buf.length));
    return res.end(buf);
  } catch (e) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end('brand asset error');
  }
}
