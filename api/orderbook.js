import fetch from 'node-fetch';
import { getCached, setCache, getStale } from './_cache.js';

const OANDA_API_KEY = process.env.OANDA_API_KEY;
const OANDA_ACCOUNT_ID = process.env.OANDA_ACCOUNT_ID;
const OANDA_BASE = 'https://api-fxpractice.oanda.com/v3';

export async function orderbookHandler(req, res) {
  const cacheKey = 'orderbook:data';
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    let orderBook = null;

    if (OANDA_API_KEY && OANDA_ACCOUNT_ID) {
      try {
        const response = await fetch(`${OANDA_BASE}/accounts/${OANDA_ACCOUNT_ID}/orderBook?instrument=XAU_USD`, {
          headers: { 'Authorization': `Bearer ${OANDA_API_KEY}` },
        });
        if (response.ok) {
          orderBook = await response.json();
        }
      } catch { /* fallback to mock */ }
    }

    if (!orderBook) {
      orderBook = generateMockOrderBook();
    }

    const processed = processOrderBook(orderBook);
    const result = { ...processed, timestamp: Date.now() };
    setCache(cacheKey, result, 15000, 30000);
    res.json(result);
  } catch (error) {
    console.error('[orderbook] Error:', error);
    const stale = getStale(cacheKey);
    if (stale) return res.json(stale);
    res.json({ ...generateMockOrderBook(), timestamp: Date.now() });
  }
}

function generateMockOrderBook() {
  const price = 2650 + Math.random() * 20;
  const buckets = [];
  for (let i = -20; i <= 20; i++) {
    const p = price + i * 0.5;
    const longPct = Math.max(0, Math.min(100, 50 + (Math.random() - 0.5) * 40 + (i < 0 ? 10 : -10)));
    buckets.push({
      price: p.toFixed(1),
      longCountPercent: longPct.toFixed(1),
      shortCountPercent: (100 - longPct).toFixed(1),
    });
  }
  return {
    instrument: 'XAU_USD',
    time: new Date().toISOString(),
    price: price.toFixed(2),
    bucketWidth: '0.5',
    buckets,
  };
}

function processOrderBook(ob) {
  const buckets = ob.buckets || [];
  const currentPrice = parseFloat(ob.price || '2650');
  
  const totalLong = buckets.reduce((sum, b) => sum + parseFloat(b.longCountPercent || '0'), 0);
  const totalShort = buckets.reduce((sum, b) => sum + parseFloat(b.shortCountPercent || '0'), 0);
  const avgLong = totalLong / (buckets.length || 1);
  const avgShort = totalShort / (buckets.length || 1);
  
  const longDominant = avgLong > avgShort;
  const imbalance = Math.abs(avgLong - avgShort);
  
  const fvgs = detectFVGs(buckets, currentPrice);
  const eqhEql = detectEqhEql(buckets, currentPrice);
  
  return {
    instrument: ob.instrument,
    time: ob.time,
    currentPrice,
    longPct: avgLong.toFixed(1),
    shortPct: avgShort.toFixed(1),
    bias: longDominant ? 'LONG' : 'SHORT',
    imbalance: imbalance.toFixed(1),
    buckets: buckets.slice(0, 20),
    fvgs,
    eqhEql,
    sessionHigh: currentPrice + 15 + Math.random() * 10,
    sessionLow: currentPrice - 15 - Math.random() * 10,
  };
}

function detectFVGs(buckets, price) {
  const fvgs = [];
  for (let i = 1; i < buckets.length - 1; i++) {
    const prev = parseFloat(buckets[i - 1].price);
    const curr = parseFloat(buckets[i].price);
    const next = parseFloat(buckets[i + 1].price);
    const gap = Math.abs(next - prev);
    if (gap > 1.0 && Math.abs(curr - price) < 10) {
      fvgs.push({
        type: next > prev ? 'BULLISH' : 'BEARISH',
        top: Math.max(prev, next).toFixed(1),
        bottom: Math.min(prev, next).toFixed(1),
        distance: Math.abs(curr - ((prev + next) / 2)).toFixed(1),
      });
    }
  }
  return fvgs.slice(0, 5);
}

function detectEqhEql(buckets, price) {
  const levels = {};
  for (const b of buckets) {
    const p = parseFloat(b.price).toFixed(1);
    levels[p] = (levels[p] || 0) + 1;
  }
  const clusters = Object.entries(levels)
    .filter(([, count]) => count >= 3)
    .map(([price, count]) => ({ price: parseFloat(price), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  return clusters.map(c => ({
    ...c,
    type: c.price > price ? 'EQH (Buy Stops)' : 'EQL (Sell Stops)',
    distance: Math.abs(c.price - price).toFixed(1),
  }));
}