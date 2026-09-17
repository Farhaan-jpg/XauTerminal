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
    this.renderPositionRatio(data);
    this.renderFVGs(data.fvgs);
    this.renderEqhEql(data.eqhEql);
    this.renderSessionLevels(data);
    this.renderOrderBook(data.buckets, data.currentPrice);
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