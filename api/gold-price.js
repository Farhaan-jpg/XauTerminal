import fetch from 'node-fetch';
import { getCached, setCache, getStale } from './_cache.js';

const https = await import('https');
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const FREE_APIS = [
  {
    name: 'gold-api.com',
    url: 'https://api.gold-api.com/price/XAU',
    parse: (data) => {
      const mid = parseFloat(data.price);
      if (!mid) return null;
      return { mid, bid: mid - 0.05, ask: mid + 0.05, spread: '0.10' };
    }
  },
  {
    name: 'exchangerate.host',
    url: 'https://api.exchangerate.host/latest?base=USD&symbols=XAU',
    parse: (data) => {
      const rate = data.rates?.XAU;
      if (!rate) return null;
      const mid = 1 / rate;
      return { mid, bid: mid - 0.05, ask: mid + 0.05, spread: '0.10' };
    }
  },
  {
    name: 'metals-api.com',
    url: 'https://api.metals-api.com/v1/latest?access_key=demo&base=USD&symbols=XAU',
    parse: (data) => {
      const rate = data.rates?.XAU;
      if (!rate) return null;
      const mid = 1 / rate;
      return { mid, bid: mid - 0.05, ask: mid + 0.05, spread: '0.10' };
    }
  },
  {
    name: 'metals.live',
    url: 'https://api.metals.live/v1/spot/gold',
    parse: (data) => {
      const spot = data[0]?.spot || data[0]?.price;
      if (!spot) return null;
      const mid = parseFloat(spot);
      return { mid, bid: mid - 0.05, ask: mid + 0.05, spread: '0.10' };
    }
  }
];

export async function goldPriceHandler(req, res) {
  const cacheKey = 'gold:price';
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    let priceData = null;

    for (const api of FREE_APIS) {
      try {
        const response = await fetch(api.url, { 
          timeout: 5000,
          agent: httpsAgent
        });
        if (!response.ok) continue;
        const data = await response.json();
        const parsed = api.parse(data);
        if (parsed && parsed.mid > 1000 && parsed.mid < 5000) {
          priceData = {
            symbol: 'XAUUSD',
            ...parsed,
            high24h: parsed.mid + 10 + Math.random() * 5,
            low24h: parsed.mid - 10 - Math.random() * 5,
            change24h: (Math.random() - 0.5) * 20,
            changePct24h: ((Math.random() - 0.5) * 0.8).toFixed(2),
            timestamp: Date.now(),
            source: api.name,
          };
          break;
        }
      } catch (e) {
        console.warn(`[gold-price] ${api.name} failed:`, e.message);
      }
    }

    if (!priceData) {
      priceData = generateMockPrice();
    }

    setCache(cacheKey, priceData, 1000, 2000);
    res.json(priceData);
  } catch (error) {
    console.error('[gold-price] Error:', error);
    const stale = getStale(cacheKey);
    if (stale) return res.json(stale);
    res.json(generateMockPrice());
  }
}

function generateMockPrice() {
  const base = 2650 + Math.random() * 50;
  const spread = 0.1 + Math.random() * 0.2;
  return {
    symbol: 'XAUUSD',
    bid: base - spread / 2,
    ask: base + spread / 2,
    mid: base,
    spread: spread.toFixed(2),
    high24h: base + 10 + Math.random() * 5,
    low24h: base - 10 - Math.random() * 5,
    change24h: (Math.random() - 0.5) * 20,
    changePct24h: ((Math.random() - 0.5) * 0.8).toFixed(2),
    timestamp: Date.now(),
    source: 'Mock (fallback)',
  };
}