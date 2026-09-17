import fetch from 'node-fetch';
import { getCached, setCache, getStale } from './_cache.js';

const OANDA_API_KEY = process.env.OANDA_API_KEY;
const OANDA_ACCOUNT_ID = process.env.OANDA_ACCOUNT_ID;
const OANDA_BASE = 'https://api-fxpractice.oanda.com/v3';

export async function goldPriceHandler(req, res) {
  const cacheKey = 'gold:price';
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    let priceData = null;

    if (OANDA_API_KEY && OANDA_ACCOUNT_ID) {
      const response = await fetch(`${OANDA_BASE}/accounts/${OANDA_ACCOUNT_ID}/pricing?instruments=XAU_USD`, {
        headers: { 'Authorization': `Bearer ${OANDA_API_KEY}` },
      });
      if (response.ok) {
        const data = await response.json();
        const price = data.prices?.[0];
        if (price) {
          const bid = parseFloat(price.bids[0]?.price);
          const ask = parseFloat(price.asks[0]?.price);
          priceData = {
            symbol: 'XAUUSD',
            bid,
            ask,
            mid: (bid + ask) / 2,
            spread: (ask - bid).toFixed(2),
            high24h: 0,
            low24h: 0,
            change24h: 0,
            changePct24h: 0,
            timestamp: Date.now(),
            source: 'OANDA',
          };
        }
      }
    }

    if (!priceData) {
      const alphaKey = process.env.ALPHA_VANTAGE_API_KEY;
      if (alphaKey) {
        const response = await fetch(
          `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=XAU&to_currency=USD&apikey=${alphaKey}`
        );
        if (response.ok) {
          const data = await response.json();
          const rate = data['Realtime Currency Exchange Rate'];
          if (rate) {
            const mid = parseFloat(rate['5. Exchange Rate']);
            priceData = {
              symbol: 'XAUUSD',
              bid: mid - 0.05,
              ask: mid + 0.05,
              mid,
              spread: '0.10',
              high24h: 0,
              low24h: 0,
              change24h: 0,
              changePct24h: 0,
              timestamp: Date.now(),
              source: 'Alpha Vantage',
            };
          }
        }
      }
    }

    if (!priceData) {
      const response = await fetch('https://api.metalpriceapi.com/v1/latest?api_key=demo&base=USD&currencies=XAU');
      if (response.ok) {
        const data = await response.json();
        const xauUsd = 1 / data.rates.XAU;
        priceData = {
          symbol: 'XAUUSD',
          bid: xauUsd - 0.05,
          ask: xauUsd + 0.05,
          mid: xauUsd,
          spread: '0.10',
          high24h: 0,
          low24h: 0,
          change24h: 0,
          changePct24h: 0,
          timestamp: Date.now(),
          source: 'MetalPriceAPI (demo)',
        };
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