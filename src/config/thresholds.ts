export const BIAS_WEIGHTS = {
  yields: 0.25,
  dxy: 0.25,
  geo: 0.20,
  macro: 0.15,
  tech: 0.15,
} as const;

export const BIAS_THRESHOLDS = {
  STRONG_BULLISH: 60,
  MODERATE_BULLISH: 20,
  NEUTRAL_UPPER: 20,
  NEUTRAL_LOWER: -20,
  MODERATE_BEARISH: -20,
  STRONG_BEARISH: -60,
} as const;

export const YIELD_CONFIG = {
  lookbackPeriods: 20,
  realYieldWeight: 0.6,
  nominalYieldWeight: 0.4,
  inverseCorrelation: true,
} as const;

export const DXY_CONFIG = {
  maPeriod: 20,
  atrPeriod: 14,
  divergenceThreshold: 1.5,
} as const;

export const GEO_CONFIG = {
  maxScore: 100,
  hotspotWeight: 0.7,
  chokePointWeight: 0.3,
  decayHalfLife: 3600000,
} as const;

export const MACRO_CONFIG = {
  surpriseLookback: 12,
  highImpactEvents: [
    'CPI', 'CORE_CPI', 'PPI', 'NFP', 'UNEMPLOYMENT',
    'FOMC', 'PCE', 'CORE_PCE', 'GDP',
  ],
  standardDeviations: {
    CPI: 0.2,
    CORE_CPI: 0.15,
    PPI: 0.3,
    NFP: 80000,
    UNEMPLOYMENT: 0.1,
    FOMC: 0.25,
    PCE: 0.15,
    CORE_PCE: 0.1,
    GDP: 0.5,
  } as Record<string, number>,
} as const;

export const TECH_CONFIG = {
  emaShort: 9,
  emaMedium: 21,
  emaLong: 50,
  rsiPeriod: 14,
  rsiOverbought: 70,
  rsiOversold: 30,
  fvgLookback: 50,
  orderBookImbalanceThreshold: 15,
} as const;

export const ALERT_LEVELS = {
  CRITICAL: { threshold: 80, color: '#ff0000', label: 'CRITICAL', sound: true },
  HIGH: { threshold: 60, color: '#ff4444', label: 'HIGH', sound: true },
  ELEVATED: { threshold: 40, color: '#ffaa00', label: 'ELEVATED', sound: false },
  WATCH: { threshold: 20, color: '#44ff88', label: 'WATCH', sound: false },
  NORMAL: { threshold: 0, color: '#888888', label: 'NORMAL', sound: false },
} as const;