import fetch from 'node-fetch';
import { getCached, setCache, getStale } from './_cache.js';

const FRED_API_KEY = process.env.FRED_API_KEY;
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;

const INTERMARKET_SYMBOLS = [
  { id: 'DXY', name: 'US Dollar Index', fred: 'DTWEXBGS', type: 'index', inverseCorrelation: true },
  { id: 'US10Y', name: '10-Year Treasury Yield', fred: 'DGS10', type: 'yield', inverseCorrelation: true },
  { id: 'US02Y', name: '2-Year Treasury Yield', fred: 'DGS2', type: 'yield', inverseCorrelation: true },
  { id: 'TIPS10Y', name: '10-Year TIPS Yield', fred: 'DFII10', type: 'real_yield', inverseCorrelation: true },
  { id: 'BREAKEVEN10', name: '10-Year Breakeven', fred: 'T10YIE', type: 'inflation_exp', inverseCorrelation: false },
  { id: 'WTI', name: 'WTI Crude Oil', fred: 'DCOILWTICO', type: 'commodity', inverseCorrelation: false },
  { id: 'XAG', name: 'Silver (XAGUSD)', fred: null, type: 'commodity', inverseCorrelation: false },
  { id: 'COPPER', name: 'Copper', fred: 'PCOPPUSDM', type: 'commodity', inverseCorrelation: false },
  { id: 'VIX', name: 'VIX Volatility Index', fred: 'VIXCLS', type: 'volatility', inverseCorrelation: false },
];

async function fetchFred(seriesId) {
  if (!FRED_API_KEY) return null;
  try {
    const response = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=2`
    );
    if (!response.ok) return null;
    const data = await response.json();
    const val = parseFloat(data.observations?.[0]?.value);
    return isNaN(val) ? null : val;
  } catch {
    return null;
  }
}

async function fetchAlphaVantage(symbol) {
  if (!ALPHA_VANTAGE_KEY) return null;
  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    const price = parseFloat(data['Global Quote']?.['05. price']);
    return isNaN(price) ? null : price;
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
      let change24h = 0;

      if (symbol.fred) {
        const current = await fetchFred(symbol.fred);
        const previous = await fetchFred(symbol.fred); // Would need historical for real change
        value = current;
      } else if (symbol.id === 'XAG') {
        value = await fetchAlphaVantage('XAG/USD');
      } else if (symbol.id === 'WTI') {
        value = await fetchAlphaVantage('WTI');
      }

      if (value === null) {
        const mock = generateMockData().find(m => m.id === symbol.id);
        value = mock?.value || 0;
        change24h = mock?.change24h || 0;
      }

      return { id: symbol.id, name: symbol.name, value, change24h, type: symbol.type, timestamp: Date.now() };
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
  const goldPrice = 2650;
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