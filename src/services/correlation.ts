export interface CorrelationData {
  symbol: string;
  values: number[];
  timestamps: number[];
}

export interface CorrelationResult {
  symbol: string;
  pearson30m: number;
  pearson4h: number;
  pearson24h: number;
  timestamp: number;
}

class RollingCorrelation {
  private maxPoints = 500;
  private goldData: CorrelationData = { symbol: 'XAUUSD', values: [], timestamps: [] };
  private symbolData: Map<string, CorrelationData> = new Map();

  addGoldPoint(price: number, timestamp: number): void {
    this.goldData.values.push(price);
    this.goldData.timestamps.push(timestamp);
    this.trim(this.goldData);
  }

  addSymbolPoint(symbol: string, price: number, timestamp: number): void {
    let data = this.symbolData.get(symbol);
    if (!data) {
      data = { symbol, values: [], timestamps: [] };
      this.symbolData.set(symbol, data);
    }
    data.values.push(price);
    data.timestamps.push(timestamp);
    this.trim(data);
  }

  private trim(data: CorrelationData): void {
    if (data.values.length > this.maxPoints) {
      data.values = data.values.slice(-this.maxPoints);
      data.timestamps = data.timestamps.slice(-this.maxPoints);
    }
  }

  calculate(symbol: string): CorrelationResult | null {
    const gold = this.goldData;
    const other = this.symbolData.get(symbol);
    if (!other || gold.values.length < 20 || other.values.length < 20) return null;

    const aligned = this.alignSeries(gold, other);
    if (aligned.length < 10) return null;

    return {
      symbol,
      pearson30m: this.pearson(aligned.slice(-30)),
      pearson4h: this.pearson(aligned.slice(-240)),
      pearson24h: this.pearson(aligned),
      timestamp: Date.now(),
    };
  }

  private alignSeries(gold: CorrelationData, other: CorrelationData): Array<[number, number]> {
    const aligned: Array<[number, number]> = [];
    let goldIdx = gold.values.length - 1;
    let otherIdx = other.values.length - 1;

    while (goldIdx >= 0 && otherIdx >= 0) {
      const goldTime = gold.timestamps[goldIdx];
      const otherTime = other.timestamps[otherIdx];
      if (goldTime === undefined || otherTime === undefined) break;
      
      const diff = goldTime - otherTime;

      if (Math.abs(diff) < 60000) {
        const goldVal = gold.values[goldIdx];
        const otherVal = other.values[otherIdx];
        if (goldVal !== undefined && otherVal !== undefined) {
          aligned.unshift([goldVal, otherVal]);
        }
        goldIdx--;
        otherIdx--;
      } else if (diff > 0) {
        goldIdx--;
      } else {
        otherIdx--;
      }
    }

    return aligned;
  }

  private pearson(pairs: Array<[number, number]>): number {
    if (pairs.length < 2) return 0;

    const n = pairs.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

    for (const [x, y] of pairs) {
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
      sumY2 += y * y;
    }

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return 0;
    return numerator / denominator;
  }

  getAllCorrelations(): CorrelationResult[] {
    const results: CorrelationResult[] = [];
    for (const symbol of this.symbolData.keys()) {
      const corr = this.calculate(symbol);
      if (corr) results.push(corr);
    }
    return results;
  }

  clear(): void {
    this.goldData = { symbol: 'XAUUSD', values: [], timestamps: [] };
    this.symbolData.clear();
  }
}

export const correlationEngine = new RollingCorrelation();