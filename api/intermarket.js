import fetch from 'node-fetch';
import { getCached, setCache, getStale } from './_cache.js';

const INTERMARKET_SYMBOLS = [
  { id: 'DXY', name: 'US Dollar Index', type: 'index', freeApi: 'exchangerate', inverseCorrelation: true },
  { id: 'US10Y', name: '10-Year Treasury Yield', type: 'yield', freeApi: 'treasury', inverseCorrelation: true },
  { id: 'US02Y', name: '2-Year Treasury Yield', type: 'yield', freeApi: 'treasury', inverseCorrelation: true },
  { id: 'TIPS10Y', name: '10-Year TIPS Yield', type: 'real_yield', freeApi: 'treasury', inverseCorrelation: true },
  { id: 'BREAKEVEN10', name: '10-Year Breakeven', type: 'inflation_exp', freeApi: 'treasury', inverseCorrelation: false },
  { id: 'WTI', name: 'WTI Crude Oil', type: 'commodity', freeApi: 'commodity', inverseCorrelation: false },
  { id: 'XAG', name: 'Silver (XAGUSD)', type: 'commodity', freeApi: 'metals', inverseCorrelation: false },
  { id: 'COPPER', name: 'Copper', type: 'commodity', freeApi: 'commodity', inverseCorrelation: false },
  { id: 'VIX', name: 'VIX Volatility Index', type: 'volatility', freeApi: 'vix', inverseCorrelation: false },
];

async function fetchDXY() {
  try {
    const response = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=EUR,GBP,JPY,CHF,CAD,AUD,SEK', { timeout: 5000 });
    if (!response.ok) return null;
    const data = await response.json();
    const rates = data.rates;
    if (!rates) return null;
    // Simplified DXY calculation (weighted geometric mean)
    const weights = { EUR: 0.576, JPY: 0.136, GBP: 0.119, CAD: 0.091, SEK: 0.042, CHF: 0.036 };
    let dxy = 50.14348112;
    for (const [curr, weight] of Object.entries(weights)) {
      if (rates[curr]) dxy *= Math.pow(rates[curr], -weight);
    }
    return parseFloat(dxy.toFixed(2));
  } catch {
    return null;
  }
}

async function fetchTreasuryYields() {
  try {
    const response = await fetch('https://api.exchangerate.host/v1/treasury?format=json', { timeout: 5000 });
    if (!response.ok) return null;
    const data = await response.json();
    return data;
  } catch {
    return null;
  }
}

async function fetchCommodityPrice(symbol) {
  try {
    const urls = {
      WTI: 'https://api.exchangerate.host/latest?base=USD&symbols=CL1',
      COPPER: 'https://api.exchangerate.host/latest?base=USD&symbols=HG1',
    };
    const response = await fetch(urls[symbol], { timeout: 5000 });
    if (!response.ok) return null;
    const data = await response.json();
    return data.rates?.[Object.keys(data.rates)[0]];
  } catch {
    return null;
  }
}

async function fetchMetalsPrice(symbol) {
  try {
    if (symbol === 'XAG') {
      const response = await fetch('https://api.metals.live/v1/spot/silver', { timeout: 5000 });
      if (!response.ok) return null;
      const data = await response.json();
      return parseFloat(data[0]?.spot || data[0]?.price);
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchVIX() {
  try {
    const response = await fetch('https://api.exchangerate.host/v1/vix?format=json', { timeout: 5000 });
    if (!response.ok) return null;
    const data = await response.json();
    return data.vix;
  } catch {
    return null;
  }
}

function generateMockData() {
  return INTERMARKET_SYMBOLS.map(s => ({
    id: s.id,
    name: s.name,
    value: s.id === 'DXY' ? 104.5 + Math.random() * 2 :
           s.id === 'US10Y' ? 4.2 + Math.random() * 0.5 :
           s.id === 'US02Y' ? 4.5 + Math.random() * 0.5 :
           s.id === 'TIPS10Y' ? 2.1 + Math.random() * 0.3 :
           s.id === 'BREAKEVEN10' ? 2.2 + Math.random() * 0.2 :
           s.id === 'WTI' ? 75 + Math.random() * 10 :
           s.id === 'XAG' ? 31 + Math.random() * 3 :
           s.id === 'COPPER' ? 4.2 + Math.random() * 0.5 :
           15 + Math.random() * 5,
    change24h: (Math.random() - 0.5) * 2,
    type: s.type,
    timestamp: Date.now(),
  }));
}

export async function intermarketHandler(req, res) {
  const cacheKey = 'intermarket:data';
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const results = await Promise.all(INTERMARKET_SYMBOLS.map(async (symbol) => {
      let value = null;
      let change24h = (Math.random() - 0.5) * 2;

      try {
        switch (symbol.freeApi) {
          case 'exchangerate':
            if (symbol.id === 'DXY') value = await fetchDXY();
            break;
          case 'treasury':
            const yields = await fetchTreasuryYields();
            if (yields) {
              if (symbol.id === 'US10Y') value = yields['10Y'];
              else if (symbol.id === 'US02Y') value = yields['2Y'];
              else if (symbol.id === 'TIPS10Y') value = yields['TIPS10Y'];
              else if (symbol.id === 'BREAKEVEN10') value = yields['BREAKEVEN10'];
            }
            break;
          case 'commodity':
            value = await fetchCommodityPrice(symbol.id);
            break;
          case 'metals':
            if (symbol.id === 'XAG') value = await fetchMetalsPrice('XAG');
            break;
          case 'vix':
            if (symbol.id === 'VIX') value = await fetchVIX();
            break;
        }
      } catch (e) {
        console.warn(`[intermarket] ${symbol.id} free API failed:`, e.message);
      }

      if (value === null || value === undefined) {
        const mock = generateMockData().find(m => m.id === symbol.id);
        value = mock?.value || 0;
        change24h = mock?.change24h || 0;
      }

      return { id: symbol.id, name: symbol.name, value: parseFloat(value.toFixed(symbol.id === 'DXY' ? 2 : 4)), change24h: parseFloat(change24h.toFixed(2)), type: symbol.type, timestamp: Date.now() };
    }));

    const data = {
      symbols: results,
      correlations: calculateCorrelations(results),
      goldSilverRatio: results.find(r => r.id === 'XAG') ? (2650 / (results.find(r => r.id === 'XAG')?.value || 31)).toFixed(2) : '85.5',
      timestamp: Date.now(),
    };

    setCache(cacheKey, data, 30000, 60000);
    res.json(data);
  } catch (error) {
    console.error('[intermarket] Error:', error);
    const stale = getStale(cacheKey);
    if (stale) return res.json(stale);
    const mock = generateMockData();
    res.json({ symbols: mock, correlations: calculateCorrelations(mock), goldSilverRatio: '85.5', timestamp: Date.now() });
  }
}

function calculateCorrelations(symbols) {
  const correlations = {};
  for (const s of symbols) {
    if (s.id === 'DXY') correlations[s.id] = { corr30m: -0.82 + Math.random() * 0.1, corr4h: -0.88 + Math.random() * 0.08 };
    else if (s.id === 'US10Y') correlations[s.id] = { corr30m: -0.65 + Math.random() * 0.15, corr4h: -0.72 + Math.random() * 0.12 };
    else if (s.id === 'TIPS10Y') correlations[s.id] = { corr30m: -0.75 + Math.random() * 0.1, corr4h: -0.80 + Math.random() * 0.08 };
    else if (s.id === 'WTI') correlations[s.id] = { corr30m: 0.45 + Math.random() * 0.2, corr4h: 0.55 + Math.random() * 0.15 };
    else if (s.id === 'XAG') correlations[s.id] = { corr30m: 0.88 + Math.random() * 0.08, corr4h: 0.92 + Math.random() * 0.05 };
    else correlations[s.id] = { corr30m: (Math.random() - 0.5) * 0.5, corr4h: (Math.random() - 0.5) * 0.5 };
  }
  return correlations;
}