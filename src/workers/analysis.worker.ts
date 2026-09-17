interface WorkerMessage {
  type: 'CALCULATE_BIAS' | 'CALCULATE_CORRELATION' | 'CALCULATE_VWAP' | 'DETECT_FVG' | 'CALCULATE_RSI' | 'CALCULATE_EMA';
  payload: any;
  id: number;
}

interface BiasInputs {
  yields: { realYield: number; nominalYield: number; change24h: number };
  dxy: { value: number; ma20: number; atr: number; change24h: number };
  geo: { threatLevel: number; hotspotCount: number; defcon: number };
  macro: { surpriseIndex: number; eventCount: number; nextEventImpact: string };
  tech: { ema9: number; ema21: number; rsi: number; price: number; fvgDistance: number; orderBookBias: number };
}

const BIAS_WEIGHTS = {
  yields: 0.25,
  dxy: 0.25,
  geo: 0.20,
  macro: 0.15,
  tech: 0.15,
};

const BIAS_THRESHOLDS = {
  STRONG_BULLISH: 60,
  MODERATE_BULLISH: 20,
  NEUTRAL_UPPER: 20,
  NEUTRAL_LOWER: -20,
  MODERATE_BEARISH: -20,
  STRONG_BEARISH: -60,
};

let messageId = 0;
const pendingCallbacks = new Map<number, (result: any) => void>();

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, payload, id } = event.data;
  let result: any;

  try {
    switch (type) {
      case 'CALCULATE_BIAS':
        result = calculateBias(payload as BiasInputs);
        break;
      case 'CALCULATE_CORRELATION':
        result = calculateCorrelation(payload.gold, payload.other);
        break;
      case 'CALCULATE_VWAP':
        result = calculateVWAP(payload.candles);
        break;
      case 'DETECT_FVG':
        result = detectFVG(payload.candles);
        break;
      case 'CALCULATE_RSI':
        result = calculateRSI(payload.prices, payload.period);
        break;
      case 'CALCULATE_EMA':
        result = calculateEMA(payload.prices, payload.period);
        break;
      default:
        result = { error: 'Unknown message type' };
    }
  } catch (error) {
    result = { error: (error as Error).message };
  }

  self.postMessage({ id, result, type });
};

function calculateBias(inputs: BiasInputs) {
  const components = {
    yields: calculateYieldsScore(inputs.yields),
    dxy: calculateDXYScore(inputs.dxy),
    geo: calculateGeoScore(inputs.geo),
    macro: calculateMacroScore(inputs.macro),
    tech: calculateTechScore(inputs.tech),
  };

  const score = Math.round(
    components.yields * BIAS_WEIGHTS.yields +
    components.dxy * BIAS_WEIGHTS.dxy +
    components.geo * BIAS_WEIGHTS.geo +
    components.macro * BIAS_WEIGHTS.macro +
    components.tech * BIAS_WEIGHTS.tech
  );

  const clampedScore = Math.max(-100, Math.min(100, score));
  const label = getBiasLabel(clampedScore);

  return { score: clampedScore, label, components, timestamp: Date.now() };
}

function calculateYieldsScore(inputs: BiasInputs['yields']): number {
  const realYieldChange = inputs.change24h;
  let score = 0;

  if (realYieldChange < -0.05) score = 100;
  else if (realYieldChange < -0.02) score = 60;
  else if (realYieldChange < 0) score = 30;
  else if (realYieldChange < 0.02) score = -10;
  else if (realYieldChange < 0.05) score = -40;
  else score = -80;

  return Math.max(-100, Math.min(100, score));
}

function calculateDXYScore(inputs: BiasInputs['dxy']): number {
  const divergence = (inputs.value - inputs.ma20) / inputs.atr;
  let score = 0;

  if (divergence < -1.5) score = 100;
  else if (divergence < -1) score = 60;
  else if (divergence < -0.5) score = 30;
  else if (divergence < 0.5) score = -10;
  else if (divergence < 1) score = -40;
  else if (divergence < 1.5) score = -70;
  else score = -100;

  return Math.max(-100, Math.min(100, score));
}

function calculateGeoScore(inputs: BiasInputs['geo']): number {
  const { threatLevel, hotspotCount, defcon } = inputs;
  let score = 0;

  score += (threatLevel / 100) * 70 * 0.7;
  score += Math.min(hotspotCount * 5, 20) * 0.7;
  score += (6 - defcon) * 10 * 0.3;

  return Math.max(-100, Math.min(100, score));
}

function calculateMacroScore(inputs: BiasInputs['macro']): number {
  const { surpriseIndex, eventCount } = inputs;
  let score = surpriseIndex * 15;
  
  if (eventCount > 2) score *= 1.2;
  else if (eventCount === 0) score *= 0.5;

  return Math.max(-100, Math.min(100, score));
}

function calculateTechScore(inputs: BiasInputs['tech']): number {
  let score = 0;

  if (inputs.ema9 > inputs.ema21) score += 30;
  else score -= 30;

  if (inputs.rsi > 70) score -= 40;
  else if (inputs.rsi < 30) score += 40;
  else if (inputs.rsi > 55) score += 10;
  else if (inputs.rsi < 45) score -= 10;

  if (inputs.fvgDistance < 2) score += 20;
  else if (inputs.fvgDistance < 5) score += 10;
  else score -= 10;

  score += inputs.orderBookBias * 0.5;

  return Math.max(-100, Math.min(100, score));
}

function getBiasLabel(score: number): string {
  if (score >= BIAS_THRESHOLDS.STRONG_BULLISH) return 'STRONG BULLISH';
  if (score >= BIAS_THRESHOLDS.MODERATE_BULLISH) return 'MODERATE BULLISH';
  if (score > BIAS_THRESHOLDS.NEUTRAL_LOWER) return 'NEUTRAL';
  if (score >= BIAS_THRESHOLDS.MODERATE_BEARISH) return 'MODERATE BEARISH';
  return 'STRONG BEARISH';
}

function calculateCorrelation(gold: number[], other: number[]): number {
  if (gold.length !== other.length || gold.length < 2) return 0;
  
  const n = gold.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += gold[i];
    sumY += other[i];
    sumXY += gold[i] * other[i];
    sumX2 += gold[i] * gold[i];
    sumY2 += other[i] * other[i];
  }
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
}

function calculateVWAP(candles: Array<{ high: number; low: number; close: number; volume: number }>): number {
  let totalVolume = 0;
  let totalPV = 0;
  
  for (const c of candles) {
    const typical = (c.high + c.low + c.close) / 3;
    totalPV += typical * c.volume;
    totalVolume += c.volume;
  }
  
  return totalVolume === 0 ? 0 : totalPV / totalVolume;
}

function detectFVG(candles: Array<{ high: number; low: number; open: number; close: number }>): Array<{ type: 'BULLISH' | 'BEARISH'; top: number; bottom: number; index: number }> {
  const fvgs: Array<{ type: 'BULLISH' | 'BEARISH'; top: number; bottom: number; index: number }> = [];
  
  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const next = candles[i + 1];
    
    const gap = Math.abs(next.high - prev.low);
    if (gap > 0.5 && (curr.high < Math.max(prev.low, next.low) || curr.low > Math.min(prev.high, next.high))) {
      if (next.high > prev.low) {
        fvgs.push({ type: 'BULLISH', top: next.high, bottom: prev.low, index: i });
      } else {
        fvgs.push({ type: 'BEARISH', top: prev.high, bottom: next.low, index: i });
      }
    }
  }
  
  return fvgs.slice(-5);
}

function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const change = prices[prices.length - i] - prices[prices.length - i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(0, change)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -change)) / period;
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  if (prices.length < period) return prices[prices.length - 1];
  
  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  
  return ema;
}