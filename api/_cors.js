// CORS headers & origin whitelisting + CSP for TradingView
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://xauusd-watcher.onrender.com',
  /\.onrender\.com$/,
];

const CSP = [
  "default-src 'self' https: wss:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://s3.tradingview.com https://static.tradingview.com https://www.tradingview-widget.com https://tradingview-gateway.com blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://static.tradingview.com",
  "font-src 'self' https://fonts.gstatic.com https://static.tradingview.com",
  "img-src 'self' data: https: blob:",
  "connect-src 'self' https: wss: https://api.metals.live https://api.gold-api.com https://api.exchangerate.host https://api.metals-api.com https://api.gdeltproject.org https://*.tradingview.com",
  "frame-src 'self' https://s3.tradingview.com https://www.tradingview-widget.com",
  "worker-src 'self' blob:",
].join('; ');

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
    'Content-Security-Policy': CSP,
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