import { Panel } from './Panel';

interface OrderBookData {
  currentPrice: number;
  longPct: string;
  shortPct: string;
  bias: string;
  imbalance: string;
  buckets: any[];
  fvgs: any[];
  eqhEql: any[];
  sessionHigh: number;
  sessionLow: number;
}

export class LiquidityPanel extends Panel {
  private orderBookEl!: HTMLElement;
  private fvgEl!: HTMLElement;
  private eqhEqlEl!: HTMLElement;
  private sessionLevelsEl!: HTMLElement;
  private priceSeries: { time: number; price: number }[] = [];

  constructor() {
    super({ id: 'liquidity', title: 'LIQUIDITY', className: 'liquidity', showCount: false, trackActivity: false });
    this.render();
  }

  private render(): void {
    this.content.innerHTML = `
      <div class="liquidity-header">
        <div class="position-ratio">
          <div class="ratio-bar">
            <div class="ratio-fill long" id="longFill"></div>
            <div class="ratio-fill short" id="shortFill"></div>
          </div>
          <div class="ratio-labels">
            <span class="long-label">LONG <span id="longPct">50%</span></span>
            <span class="short-label">SHORT <span id="shortPct">50%</span></span>
          </div>
        </div>
        <div class="bias-indicator" id="biasIndicator">NEUTRAL</div>
      </div>
      <div class="liquidity-sections">
        <div class="liq-section">
          <div class="section-title">FAIR VALUE GAPS (5m/15m)</div>
          <div class="fvg-list" id="fvgList"></div>
        </div>
        <div class="liq-section">
          <div class="section-title">EQH / EQL (LIQUIDITY POOLS)</div>
          <div class="eqh-eql-list" id="eqhEqlList"></div>
        </div>
        <div class="liq-section">
          <div class="section-title">SESSION LEVELS</div>
          <div class="session-levels" id="sessionLevels"></div>
        </div>
      </div>
      <div class="orderbook-book" id="orderbookBook"></div>
    `;

    this.orderBookEl = this.content.querySelector('#orderbookBook')!;
    this.fvgEl = this.content.querySelector('#fvgList')!;
    this.eqhEqlEl = this.content.querySelector('#eqhEqlList')!;
    this.sessionLevelsEl = this.content.querySelector('#sessionLevels')!;
  }

  public update(data: OrderBookData): void {
    this.lastData = this.buildTechnicals(data);
    this.renderPositionRatio(data);
    this.renderFVGs(data.fvgs);
    this.renderEqhEql(data.eqhEql);
    this.renderSessionLevels(data);
    this.renderOrderBook(data.buckets, data.currentPrice);
  }

  private buildTechnicals(data: OrderBookData): any {
    const price = data.currentPrice;

    const last = this.priceSeries[this.priceSeries.length - 1];
    if (this.priceSeries.length === 0 || !last || Math.abs(last.price - price) > 0.001) {
      this.priceSeries.push({ time: Date.now(), price });
      if (this.priceSeries.length > 200) this.priceSeries.shift();
    }

    const prices = this.priceSeries.map(p => p.price);

    let nearestFvg = Infinity;
    for (const fvg of data.fvgs || []) {
      const d = parseFloat(fvg.distance);
      if (!isNaN(d)) nearestFvg = Math.min(nearestFvg, d);
    }
    if (nearestFvg === Infinity) nearestFvg = 5;

    let orderBookBias = 0;
    if (data.bias?.toUpperCase() === 'LONG') orderBookBias = 1;
    else if (data.bias?.toUpperCase() === 'SHORT') orderBookBias = -1;
    const longPct = parseFloat(data.longPct);
    if (!isNaN(longPct)) orderBookBias = Math.max(-1, Math.min(1, orderBookBias + (longPct - 50) / 25));

    return {
      ema9: ema(prices, 9),
      ema21: ema(prices, 21),
      rsi: rsi(prices, 14),
      price,
      fvgDistance: nearestFvg,
      orderBookBias: parseFloat(orderBookBias.toFixed(2)),
      longPct: longPct || 50,
      bias: data.bias,
    };
  }

  private renderPositionRatio(data: OrderBookData): void {
    const longFill = this.content.querySelector('#longFill') as HTMLElement;
    const shortFill = this.content.querySelector('#shortFill') as HTMLElement;
    const longPct = this.content.querySelector('#longPct') as HTMLElement;
    const shortPct = this.content.querySelector('#shortPct') as HTMLElement;
    const biasEl = this.content.querySelector('#biasIndicator') as HTMLElement;

    const long = parseFloat(data.longPct);
    const short = parseFloat(data.shortPct);

    longFill.style.width = `${long}%`;
    shortFill.style.width = `${short}%`;
    longPct.textContent = `${long.toFixed(1)}%`;
    shortPct.textContent = `${short.toFixed(1)}%`;
    biasEl.textContent = data.bias;
    biasEl.className = `bias-indicator ${data.bias.toLowerCase()}`;
  }

  private renderFVGs(fvgs: any[]): void {
    if (!this.fvgEl) return;

    this.fvgEl.innerHTML = fvgs.length > 0 ? fvgs.map(fvg => `
      <div class="fvg-item ${fvg.type.toLowerCase()}">
        <span class="fvg-type">${fvg.type}</span>
        <span class="fvg-range">${fvg.bottom} — ${fvg.top}</span>
        <span class="fvg-distance">${fvg.distance} pts away</span>
      </div>
    `).join('') : '<div class="empty-state">No active FVGs</div>';
  }

  private renderEqhEql(eqhEql: any[]): void {
    if (!this.eqhEqlEl) return;

    this.eqhEqlEl.innerHTML = eqhEql.length > 0 ? eqhEql.map(level => `
      <div class="eqh-eql-item ${level.type.includes('EQH') ? 'eqh' : 'eql'}">
        <span class="eqh-eql-type">${level.type}</span>
        <span class="eqh-eql-price">${level.price}</span>
        <span class="eqh-eql-distance">${level.distance} pts</span>
        <span class="eqh-eql-count">${level.count} touches</span>
      </div>
    `).join('') : '<div class="empty-state">No significant EQH/EQL levels</div>';
  }

  private renderSessionLevels(data: OrderBookData): void {
    if (!this.sessionLevelsEl) return;

    this.sessionLevelsEl.innerHTML = `
      <div class="level-item high">
        <span class="level-label">SESSION HIGH</span>
        <span class="level-price">${data.sessionHigh.toFixed(2)}</span>
      </div>
      <div class="level-item current">
        <span class="level-label">CURRENT</span>
        <span class="level-price">${data.currentPrice.toFixed(2)}</span>
      </div>
      <div class="level-item low">
        <span class="level-label">SESSION LOW</span>
        <span class="level-price">${data.sessionLow.toFixed(2)}</span>
      </div>
    `;
  }

private renderOrderBook(buckets: any[], currentPrice: number): void {
    if (!this.orderBookEl) return;

    const sorted = [...buckets].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    const maxCount = Math.max(...sorted.map(b => parseFloat(b.longCountPercent) + parseFloat(b.shortCountPercent)));

    this.orderBookEl.innerHTML = sorted.slice(0, 15).map(b => {
      const price = parseFloat(b.price);
      const longPct = parseFloat(b.longCountPercent);
      const shortPct = parseFloat(b.shortCountPercent);
      const isCurrent = Math.abs(price - currentPrice) < 0.25;

      return `
        <div class="ob-row ${isCurrent ? 'current' : ''}">
          <div class="ob-short" style="width: ${maxCount > 0 ? (shortPct / maxCount) * 100 : 0}%"></div>
          <div class="ob-price">${price.toFixed(1)}</div>
          <div class="ob-long" style="width: ${maxCount > 0 ? (longPct / maxCount) * 100 : 0}%"></div>
        </div>
      `;
    }).join('');
  }
}

function ema(prices: number[], period: number): number {
  if (prices.length === 0) return 2650;
  const seed = prices[prices.length - 1];
  if (seed === undefined) return 2650;
  if (prices.length < period) return seed;
  const multiplier = 2 / (period + 1);
  let value = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    const p = prices[i];
    if (p !== undefined) value = (p - value) * multiplier + value;
  }
  return parseFloat(value.toFixed(2));
}

function rsi(prices: number[], period: number): number {
  if (prices.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const curr = prices[prices.length - i];
    const prev = prices[prices.length - i - 1];
    if (curr === undefined || prev === undefined) continue;
    const change = curr - prev;
    if (change > 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < prices.length; i++) {
    const curr = prices[i];
    const prev = prices[i - 1];
    if (curr === undefined || prev === undefined) continue;
    const change = curr - prev;
    avgGain = (avgGain * (period - 1) + Math.max(0, change)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -change)) / period;
  }
  if (avgLoss === 0) return 100;
  return parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(1));
}