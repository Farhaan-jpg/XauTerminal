import { Panel } from './Panel';

interface IntermarketSymbol {
  id: string;
  name: string;
  value: number;
  change24h: number;
  type: string;
  timestamp: number;
}

interface CorrelationData {
  symbol: string;
  corr30m: number;
  corr4h: number;
  corr24h?: number;
}

export class IntermarketPanel extends Panel {
  private symbolsContainer: HTMLElement | null = null;
  private corrContainer: HTMLElement | null = null;
  private gsRatioEl: HTMLElement | null = null;

  constructor() {
    super({ id: 'intermarket', title: 'INTERMARKET', className: 'intermarket', showCount: false, trackActivity: false });
    this.render();
  }

  private render(): void {
    this.content.innerHTML = `
      <div class="intermarket-header">
        <div class="gs-ratio">
          <span class="ratio-label">GOLD/SILVER RATIO</span>
          <span class="ratio-value" id="gsRatio">--</span>
        </div>
        <div class="decouple-alert" id="decoupleAlert" style="display:none;">
          ⚠ ABNORMAL DECOUPLE DETECTED
        </div>
      </div>
      <div class="intermarket-symbols" id="symbolsList"></div>
      <div class="correlation-matrix" id="corrMatrix"></div>
    `;

    this.symbolsContainer = this.content.querySelector('#symbolsList');
    this.corrContainer = this.content.querySelector('#corrMatrix');
    this.gsRatioEl = this.content.querySelector('#gsRatio');
  }

  public update(data: { symbols: IntermarketSymbol[]; correlations: Record<string, CorrelationData>; goldSilverRatio: string }): void {
    this.renderSymbols(data.symbols);
    this.renderCorrelations(data.correlations);
    this.checkDecouple(data.symbols, data.correlations);
    
    if (this.gsRatioEl) {
      this.gsRatioEl.textContent = data.goldSilverRatio;
    }
  }

  private renderSymbols(symbols: IntermarketSymbol[]): void {
    if (!this.symbolsContainer) return;

    const typeColors: Record<string, string> = {
      index: '#4a9eff',
      yield: '#ff8800',
      real_yield: '#ff44ff',
      inflation_exp: '#44ffff',
      commodity: '#d4af37',
      volatility: '#ff4444',
    };

    this.symbolsContainer.innerHTML = symbols.map(s => `
      <div class="intermarket-symbol ${s.type}">
        <div class="symbol-info">
          <span class="symbol-name">${s.name}</span>
          <span class="symbol-id">${s.id}</span>
        </div>
        <div class="symbol-value">${s.value.toFixed(s.id === 'DXY' ? 2 : s.id === 'VIX' ? 1 : 2)}</div>
        <div class="symbol-change ${s.change24h >= 0 ? 'positive' : 'negative'}">
          ${s.change24h >= 0 ? '+' : ''}${s.change24h.toFixed(2)}%
        </div>
        <div class="symbol-type" style="border-color: ${typeColors[s.type] || '#888'}">${s.type.toUpperCase()}</div>
      </div>
    `).join('');
  }

  private renderCorrelations(correlations: Record<string, CorrelationData>): void {
    if (!this.corrContainer) return;

    const order = ['DXY', 'US10Y', 'TIPS10Y', 'BREAKEVEN10', 'WTI', 'XAG', 'COPPER', 'VIX'];
    
    this.corrContainer.innerHTML = `
      <div class="corr-header">ROLLING CORRELATIONS vs GOLD</div>
      <div class="corr-table">
        <div class="corr-row header">
          <div class="corr-cell">ASSET</div>
          <div class="corr-cell">30M</div>
          <div class="corr-cell">4H</div>
          <div class="corr-cell">24H</div>
        </div>
        ${order.map(id => {
          const corr = correlations[id];
          if (!corr) return '';
          return `
            <div class="corr-row">
              <div class="corr-cell symbol">${id}</div>
              <div class="corr-cell ${this.getCorrClass(corr.corr30m)}">${corr.corr30m.toFixed(2)}</div>
              <div class="corr-cell ${this.getCorrClass(corr.corr4h)}">${corr.corr4h.toFixed(2)}</div>
              <div class="corr-cell ${this.getCorrClass(corr.corr24h || corr.corr4h)}">${(corr.corr24h || corr.corr4h).toFixed(2)}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  private getCorrClass(corr: number): string {
    if (corr <= -0.7) return 'strong-negative';
    if (corr <= -0.3) return 'negative';
    if (corr <= 0.3) return 'neutral';
    if (corr <= 0.7) return 'positive';
    return 'strong-positive';
  }

  private checkDecouple(symbols: IntermarketSymbol[], correlations: Record<string, CorrelationData>): void {
    const alertEl = this.content.querySelector('#decoupleAlert') as HTMLElement;
    if (!alertEl) return;

    const dxy = symbols.find(s => s.id === 'DXY');
    const dxyCorr = correlations['DXY'];
    
    if (dxy && dxyCorr) {
      const dxyUp = dxy.change24h > 0;
      
      // Gold rising with DXY rising = abnormal decouple
      const decoupled = (dxyUp && dxy.change24h > 0.5) || (dxyCorr.corr4h > -0.3);
      
      alertEl.style.display = decoupled ? 'block' : 'none';
      if (decoupled) {
        alertEl.textContent = dxyUp 
          ? '⚠ GOLD & DXY RISING TOGETHER — SAFE-HAVEN BID OVERRIDES USD CORRELATION'
          : '⚠ CORRELATION BREAKDOWN — REGIME SHIFT POSSIBLE';
      }
    }
  }
}