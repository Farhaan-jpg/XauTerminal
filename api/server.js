import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { handleCors } from './_cors.js';
import { rateLimitMiddleware } from './_rate-limit.js';
import { getCached, setCache, getStale, clearCache } from './_cache.js';
import { goldPriceHandler } from './gold-price.js';
import { newsFeedHandler } from './news-feed.js';
import { macroCalendarHandler } from './macro-calendar.js';
import { geopoliticsHandler } from './geopolitics.js';
import { intermarketHandler } from './intermarket.js';
import { orderbookHandler } from './orderbook.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = parseInt(process.env.PORT || '10000', 10);
const DIST_DIR = join(__dirname, '../dist');

app.use(express.json());

app.use((req, res, next) => {
  if (handleCors(req, res)) return;
  if (rateLimitMiddleware(req, res)) return;
  next();
});

app.use(express.static(DIST_DIR));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), uptime: process.uptime() });
});

app.get('/api/gold', goldPriceHandler);
app.get('/api/news', newsFeedHandler);
app.get('/api/calendar', macroCalendarHandler);
app.get('/api/geopolitics', geopoliticsHandler);
app.get('/api/intermarket', intermarketHandler);
app.get('/api/orderbook', orderbookHandler);

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(join(DIST_DIR, 'index.html'));
});

wss.on('connection', (ws, req) => {
  console.log('[WS] Client connected:', req.socket.remoteAddress);
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === 'subscribe') {
        ws.subscriptions = data.channels || [];
      }
    } catch { /* ignore */ }
  });
  ws.on('close', () => console.log('[WS] Client disconnected'));
});

const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => clearInterval(heartbeatInterval));

function broadcast(channel, data) {
  const payload = JSON.stringify({ channel, data, timestamp: Date.now() });
  wss.clients.forEach((ws) => {
    if (ws.readyState === 1 && (!ws.subscriptions || ws.subscriptions.includes(channel))) {
      ws.send(payload);
    }
  });
}

// Internal fetch helpers for broadcasting
async function fetchGoldInternal() {
  try {
    const res = await fetch(`http://localhost:${PORT}/api/gold`);
    return res.json();
  } catch (e) {
    console.error('[WS] Gold fetch error:', e);
    return null;
  }
}

async function fetchNewsInternal() {
  try {
    const res = await fetch(`http://localhost:${PORT}/api/news`);
    return res.json();
  } catch (e) {
    console.error('[WS] News fetch error:', e);
    return null;
  }
}

setInterval(async () => {
  const goldData = await fetchGoldInternal();
  if (goldData) broadcast('gold', goldData);
}, 1000);

setInterval(async () => {
  const news = await fetchNewsInternal();
  if (news) broadcast('news', news);
}, 15000);

server.listen(PORT, () => {
  console.log(`[Server] XAUUSD Watcher running on port ${PORT}`);
  console.log(`[Server] WebSocket server on ws://localhost:${PORT}/ws`);
});

export { broadcast, server, wss };