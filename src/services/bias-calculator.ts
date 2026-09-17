import { BIAS_WEIGHTS, BIAS_THRESHOLDS, DXY_CONFIG, GEO_CONFIG, TECH_CONFIG } from '@/config/thresholds';

export interface BiasInputs {
  yields: { realYield: number; nominalYield: number; change24h: number };
  dxy: { value: number; ma20: number; atr: number; change24h: number };
  geo: { threatLevel: number; hotspotCount: number; defcon: number };
  macro: { surpriseIndex: number; eventCount: number; nextEventImpact: string };
  tech: { ema9: number; ema21: number; rsi: number; price: number; fvgDistance: number; orderBookBias: number };
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

function normalize(value: number, min: number, max: number): number {
  return Math.max(-1, Math.min(1, (value - min) / (max - min) * 2 - 1));
}

export function calculateBias(inputs: BiasInputs): BiasResult {
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

  return {
    score: clampedScore,
    label,
    components,
    details: {
      yields: { ...inputs.yields, normalized: normalize(inputs.yields.change24h, -2, 2) },
      dxy: { ...inputs.dxy, divergence: (inputs.dxy.value - inputs.dxy.ma20) / inputs.dxy.atr },
      geo: { ...inputs.geo },
      macro: { ...inputs.macro },
      tech: { ...inputs.tech },
    },
    timestamp: Date.now(),
  };
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

  if (divergence < -DXY_CONFIG.divergenceThreshold) score = 100;
  else if (divergence < -1) score = 60;
  else if (divergence < -0.5) score = 30;
  else if (divergence < 0.5) score = -10;
  else if (divergence < 1) score = -40;
  else if (divergence < DXY_CONFIG.divergenceThreshold) score = -70;
  else score = -100;

  return Math.max(-100, Math.min(100, score));
}

function calculateGeoScore(inputs: BiasInputs['geo']): number {
  const { threatLevel, hotspotCount, defcon } = inputs;
  let score = 0;

  score += (threatLevel / GEO_CONFIG.maxScore) * 70 * GEO_CONFIG.hotspotWeight;
  score += Math.min(hotspotCount * 5, 20) * GEO_CONFIG.hotspotWeight;
  score += (6 - defcon) * 10 * GEO_CONFIG.chokePointWeight;

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

  if (inputs.rsi > TECH_CONFIG.rsiOverbought) score -= 40;
  else if (inputs.rsi < TECH_CONFIG.rsiOversold) score += 40;
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

export function getBiasColor(score: number): string {
  if (score >= 60) return '#44ff88';
  if (score >= 20) return '#88ff88';
  if (score > -20) return '#ffaa00';
  if (score >= -60) return '#ff8844';
  return '#ff4444';
}