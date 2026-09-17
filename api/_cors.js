// CORS headers & origin whitelisting
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://xauusd-watcher.onrender.com',
  /\.onrender\.com$/,
];

export function corsHeaders(req) {
  const origin = req.headers.origin || req.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.some((o) =>
    typeof o === 'string' ? o === origin : o.test(origin)
  );

  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

export function handleCors(req, res) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    res.setHeader('Content-Length', '0');
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}