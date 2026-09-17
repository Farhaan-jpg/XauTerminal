import fetch from 'node-fetch';
import { getCached, setCache, getStale } from './_cache.js';

const GDELT_BASE = 'https://api.gdeltproject.org/api/v2/geo/geo';

const HOTSPOTS = [
  { id: 'israel-gaza', name: 'Israel-Gaza', lat: 31.5, lon: 34.5, weight: 1.0, keywords: ['gaza', 'hamas', 'israel', 'idf', 'ceasefire', 'hostage'] },
  { id: 'ukraine-russia', name: 'Ukraine-Russia', lat: 49.0, lon: 32.0, weight: 1.0, keywords: ['ukraine', 'russia', 'putin', 'zelensky', 'donbas', 'crimea'] },
  { id: 'taiwan-strait', name: 'Taiwan Strait', lat: 23.5, lon: 121.0, weight: 0.9, keywords: ['taiwan', 'china', 'pla', 'taiwan strait', 'tsmc'] },
  { id: 'korea', name: 'Korean Peninsula', lat: 38.5, lon: 127.0, weight: 0.8, keywords: ['north korea', 'kim jong', 'missile', 'south korea', 'dmz'] },
  { id: 'syria', name: 'Syria', lat: 34.8, lon: 38.9, weight: 0.7, keywords: ['syria', 'assad', 'idlib', 'aleppo', 'homs'] },
  { id: 'yemen', name: 'Yemen-Red Sea', lat: 15.5, lon: 48.5, weight: 0.8, keywords: ['yemen', 'houthi', 'red sea', 'shipping', 'bab el mandeb'] },
  { id: 'iran', name: 'Iran', lat: 32.4, lon: 53.7, weight: 0.9, keywords: ['iran', 'nuclear', 'sanctions', 'tehran', 'revolutionary guard'] },
  { id: 'venezuela', name: 'Venezuela-Guyana', lat: 5.4, lon: -62.0, weight: 0.5, keywords: ['venezuela', 'guyana', 'essequibo', 'maduro'] },
];

const CHOKE_POINTS = [
  { id: 'hormuz', name: 'Strait of Hormuz', lat: 26.6, lon: 56.3, critical: true },
  { id: 'malacca', name: 'Strait of Malacca', lat: 2.8, lon: 101.3, critical: true },
  { id: 'suez', name: 'Suez Canal', lat: 30.3, lon: 32.3, critical: true },
  { id: 'bab-mandeb', name: 'Bab el-Mandeb', lat: 12.6, lon: 43.5, critical: true },
  { id: 'panama', name: 'Panama Canal', lat: 9.1, lon: -79.7, critical: false },
];

async function fetchGdeltEvents() {
  try {
    const response = await fetch(`${GDELT_BASE}?format=json&maxrecords=100&theme=CONFLICT,CRISIS,DISASTER`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.features || [];
  } catch {
    return [];
  }
}

function calculateThreatLevel(features) {
  let score = 0;
  for (const feature of features) {
    const props = feature.properties;
    const themes = (props.themes || '').toLowerCase();
    let weight = 1;
    if (themes.includes('war')) weight = 3;
    else if (themes.includes('conflict') || themes.includes('crisis')) weight = 2;
    else if (themes.includes('protest') || themes.includes('unrest')) weight = 1.5;
    score += weight * (props.numarticles || 1);
  }
  return Math.min(100, score / 10);
}

export async function geopoliticsHandler(req, res) {
  const cacheKey = 'geopolitics:data';
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const gdeltFeatures = await fetchGdeltEvents();
    const threatLevel = calculateThreatLevel(gdeltFeatures);

    const hotspotActivity = HOTSPOTS.map(hotspot => {
      const relevant = gdeltFeatures.filter(f => {
        const text = (f.properties?.themes || '').toLowerCase();
        return hotspot.keywords.some(kw => text.includes(kw));
      });
      const intensity = Math.min(100, relevant.length * 15 + Math.random() * 20);
      return {
        ...hotspot,
        intensity,
        eventCount: relevant.length,
        lastEvent: relevant[0]?.properties?.date || null,
        status: intensity > 70 ? 'CRITICAL' : intensity > 40 ? 'ELEVATED' : 'WATCH',
      };
    });

    const result = {
      threatLevel: Math.round(threatLevel),
      defcon: threatLevel > 80 ? 3 : threatLevel > 50 ? 4 : 5,
      hotspots: hotspotActivity,
      chokePoints: CHOKE_POINTS,
      gdeltEventCount: gdeltFeatures.length,
      timestamp: Date.now(),
    };

    setCache(cacheKey, result, 60000, 120000);
    res.json(result);
  } catch (error) {
    console.error('[geopolitics] Error:', error);
    const stale = getStale(cacheKey);
    if (stale) return res.json(stale);
    res.json({
      threatLevel: 25,
      defcon: 5,
      hotspots: HOTSPOTS.map(h => ({ ...h, intensity: 10 + Math.random() * 30, eventCount: 0, status: 'WATCH' })),
      chokePoints: CHOKE_POINTS,
      gdeltEventCount: 0,
      timestamp: Date.now(),
    });
  }
}