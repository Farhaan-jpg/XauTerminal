export interface GoldPrice {
  symbol: string;
  bid: number;
  ask: number;
  mid: number;
  spread: string;
  high24h: number;
  low24h: number;
  change24h: number;
  changePct24h: string;
  timestamp: number;
  source?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  link: string;
  pubDate: number;
  source: string;
  category: string;
  tier: number;
  impact: number;
  label: string;
  keywords?: string[];
}

export interface MacroEvent {
  id: string;
  name: string;
  country: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  date: string;
  actual: string | null;
  forecast: string;
  previous: string;
  deviation: string;
}

export interface IntermarketSymbol {
  id: string;
  name: string;
  value: number;
  change24h: number;
  type: string;
  timestamp: number;
}

export interface CorrelationData {
  symbol: string;
  corr30m: number;
  corr4h: number;
  corr24h?: number;
  timestamp: number;
}

export interface GeopoliticsData {
  threatLevel: number;
  defcon: number;
  hotspots: Array<{
    id: string;
    name: string;
    lat: number;
    lon: number;
    intensity: number;
    eventCount: number;
    status: string;
    lastEvent: string | null;
  }>;
  chokePoints: Array<{
    id: string;
    name: string;
    lat: number;
    lon: number;
    critical: boolean;
  }>;
  gdeltEventCount: number;
  timestamp: number;
}

export interface OrderBookData {
  instrument: string;
  time: string;
  currentPrice: number;
  longPct: string;
  shortPct: string;
  bias: 'LONG' | 'SHORT' | 'NEUTRAL';
  imbalance: string;
  buckets: Array<{
    price: string;
    longCountPercent: string;
    shortCountPercent: string;
  }>;
  fvgs: Array<{
    type: 'BULLISH' | 'BEARISH';
    top: string;
    bottom: string;
    distance: string;
  }>;
  eqhEql: Array<{
    price: number;
    count: number;
    type: string;
    distance: string;
  }>;
  sessionHigh: number;
  sessionLow: number;
  timestamp: number;
}

export interface BiasResult {
  score: number;
  label: string;
  components: {
    yields: number;
    dxy: number;
    geo: number;
    macro: number;
    tech: number;
  };
  details: Record<string, any>;
  timestamp: number;
}

export interface FeedSource {
  name: string;
  url: string;
  category: 'geopolitics' | 'macro' | 'gold' | 'commodities' | 'defense' | 'central_bank';
  tier: 1 | 2 | 3 | 4;
  enabled: boolean;
}