const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/(.*\.)?edgepannel\.app$/,
  /^https:\/\/worldmonitor-[a-z0-9-]+-elie-[a-z0-9]+\.vercel\.app$/,
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/tauri\.localhost(:\d+)?$/,
  /^https?:\/\/[a-z0-9-]+\.tauri\.localhost(:\d+)?$/i,
  /^tauri:\/\/localhost$/,
  /^asset:\/\/localhost$/,
];

function isAllowedOrigin(origin) {
  return Boolean(origin) && ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

export function getCorsHeaders(req, methods = 'GET, OPTIONS') {
  const origin = req.headers.get('origin') || '';
  const allowOrigin = isAllowedOrigin(origin) ? origin : 'https://edgepannel.app';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': methods,
    // X-WorldMonitor-Token: legacy alias kept for clients not yet updated after the rename.
    // TODO: remove X-WorldMonitor-Token once all clients use X-EdgePannel-Token (target: 2026-Q3).
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-EdgePannel-Key, X-EdgePannel-Token, X-WorldMonitor-Token',
    'Access-Control-Expose-Headers': 'X-Data-Status, X-Cache, X-Cache-Tier, ETag',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function isDisallowedOrigin(req) {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  return !isAllowedOrigin(origin);
}
