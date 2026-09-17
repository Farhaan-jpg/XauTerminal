import fetch from 'node-fetch';
import { getCached, setCache, getStale } from './_cache.js';

const FRED_API_KEY = process.env.FRED_API_KEY;
const FRED_BASE = 'https://api.stlouisfed.org/fred';

const HIGH_IMPACT_EVENTS = [
  { id: 'CPI', name: 'CPI', country: 'US', impact: 'HIGH', freq: 'Monthly', series: 'CPIAUCSL' },
  { id: 'CORE_CPI', name: 'Core CPI', country: 'US', impact: 'HIGH', freq: 'Monthly', series: 'CPILFESL' },
  { id: 'PPI', name: 'PPI', country: 'US', impact: 'HIGH', freq: 'Monthly', series: 'PPIACO' },
  { id: 'NFP', name: 'Non-Farm Payrolls', country: 'US', impact: 'HIGH', freq: 'Monthly', series: 'PAYEMS' },
  { id: 'UNEMPLOYMENT', name: 'Unemployment Rate', country: 'US', impact: 'HIGH', freq: 'Monthly', series: 'UNRATE' },
  { id: 'FOMC', name: 'FOMC Rate Decision', country: 'US', impact: 'HIGH', freq: '8x/year', series: 'FEDFUNDS' },
  { id: 'PCE', name: 'PCE Price Index', country: 'US', impact: 'HIGH', freq: 'Monthly', series: 'PCEPI' },
  { id: 'CORE_PCE', name: 'Core PCE', country: 'US', impact: 'HIGH', freq: 'Monthly', series: 'PCEPILFE' },
  { id: 'GDP', name: 'GDP QoQ', country: 'US', impact: 'HIGH', freq: 'Quarterly', series: 'GDP' },
  { id: 'RETAIL', name: 'Retail Sales', country: 'US', impact: 'MEDIUM', freq: 'Monthly', series: 'RSAFS' },
  { id: 'ISM_MFG', name: 'ISM Manufacturing PMI', country: 'US', impact: 'MEDIUM', freq: 'Monthly', series: 'NAPM' },
  { id: 'ISM_SVC', name: 'ISM Services PMI', country: 'US', impact: 'MEDIUM', freq: 'Monthly', series: 'NMFGNOI' },
  { id: 'JOLTS', name: 'JOLTS Job Openings', country: 'US', impact: 'MEDIUM', freq: 'Monthly', series: 'JTSJOL' },
  { id: 'MICH_SENT', name: 'Michigan Consumer Sentiment', country: 'US', impact: 'MEDIUM', freq: 'Monthly', series: 'UMCSENT' },
];

async function fetchFredSeries(seriesId) {
  if (!FRED_API_KEY) return [];
  try {
    const response = await fetch(
      `${FRED_BASE}/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=12`
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.observations?.map((o) => ({
      date: o.date,
      value: parseFloat(o.value),
    })).filter((o) => !isNaN(o.value)) || [];
  } catch {
    return [];
  }
}

function generateMockEvents() {
  const now = Date.now();
  const day = 86400000;
  return [
    { id: 'CPI', name: 'CPI', country: 'US', impact: 'HIGH', date: new Date(now + 3 * day).toISOString(), forecast: '3.2%', previous: '3.1%', actual: null },
    { id: 'FOMC', name: 'FOMC Rate Decision', country: 'US', impact: 'HIGH', date: new Date(now + 10 * day).toISOString(), forecast: '5.25%', previous: '5.25%', actual: null },
    { id: 'NFP', name: 'Non-Farm Payrolls', country: 'US', impact: 'HIGH', date: new Date(now + 17 * day).toISOString(), forecast: '180K', previous: '206K', actual: null },
    { id: 'PCE', name: 'PCE Price Index', country: 'US', impact: 'HIGH', date: new Date(now + 24 * day).toISOString(), forecast: '2.6%', previous: '2.7%', actual: null },
    { id: 'GDP', name: 'GDP QoQ', country: 'US', impact: 'HIGH', date: new Date(now + 30 * day).toISOString(), forecast: '2.1%', previous: '1.6%', actual: null },
  ];
}

export async function macroCalendarHandler(req, res) {
  const cacheKey = 'macro:calendar';
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const events = await Promise.all(HIGH_IMPACT_EVENTS.map(async (event) => {
      const observations = await fetchFredSeries(event.series);
      const latest = observations[0];
      const previous = observations[1];
      return {
        ...event,
        date: latest?.date || new Date(Date.now() + Math.random() * 30 * 86400000).toISOString().split('T')[0],
        actual: latest?.value?.toFixed(1) + '%' || null,
        previous: previous?.value?.toFixed(1) + '%' || 'N/A',
        forecast: 'N/A',
        deviation: latest && previous ? ((latest.value - previous.value) / Math.abs(previous.value) * 100).toFixed(2) : 'N/A',
      };
    }));

    const sorted = events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const nextEvent = sorted.find(e => !e.actual || e.actual === 'N/A') || sorted[0];

    const result = {
      events: sorted,
      nextEvent: nextEvent ? {
        ...nextEvent,
        countdownMs: Math.max(0, new Date(nextEvent.date).getTime() - Date.now()),
      } : null,
      timestamp: Date.now(),
    };

    setCache(cacheKey, result, 300000, 600000);
    res.json(result);
  } catch (error) {
    console.error('[macro-calendar] Error:', error);
    const stale = getStale(cacheKey);
    if (stale) return res.json(stale);
    res.json({ events: generateMockEvents(), nextEvent: generateMockEvents()[0], timestamp: Date.now() });
  }
}