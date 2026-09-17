import { Panel } from './Panel';
import { calculateBias, BiasInputs, BiasResult, getBiasColor } from '@/services/bias-calculator';

export class BiasEnginePanel extends Panel {
  private componentBars: Record<string, HTMLElement> = {};
  private scoreEl!: HTMLElement;
  private labelEl!: HTMLElement;
  private lastInputs: BiasInputs | null = null;

  constructor() {
    super({ id: 'biasEngine', title: 'BIAS ENGINE', className: 'bias-engine', showCount: false, trackActivity: false });
    this.render();
  }

  private render(): void {
    this.content.innerHTML = `
      <div class="bias-header">
        <div class="bias-score" id="biasScore">0</div>
        <div class="bias-label" id="biasLabel">NEUTRAL</div>
        <div class="bias-subtitle">Composite Score: -100 to +100</div>
      </div>
      <div class="bias-components" id="biasComponents"></div>
      <div class="bias-weights">
        <div class="weight-item"><span class="weight-name">Real Yields</span><span class="weight-value">25%</span></div>
        <div class="weight-item"><span class="weight-name">DXY Momentum</span><span class="weight-value">25%</span></div>
        <div class="weight-item"><span class="weight-name">Geopolitical</span><span class="weight-value">20%</span></div>
        <div class="weight-item"><span class="weight-name">Macro Surprise</span><span class="weight-value">15%</span></div>
        <div class="weight-item"><span class="weight-name">Technical</span><span class="weight-value">15%</span></div>
      </div>
    `;

    this.scoreEl = this.content.querySelector('#biasScore')!;
    this.labelEl = this.content.querySelector('#biasLabel')!;
    this.initComponents();
  }

  private initComponents(): void {
    const container = this.content.querySelector('#biasComponents');
    if (!container) return;

    const components = [
      { id: 'yields', name: 'REAL YIELDS & US10Y SPREAD', desc: 'Falling real yields = Bullish Gold' },
      { id: 'dxy', name: 'US DOLLAR INDEX MOMENTUM', desc: 'DXY weakening = Bullish Gold' },
      { id: 'geo', name: 'GEOPOLITICAL ESCALATION', desc: 'Conflict escalation = Safe-haven bid' },
      { id: 'macro', name: 'MACRO SURPRISE FACTOR', desc: 'CPI/NFP/FOMC deviations' },
      { id: 'tech', name: 'TECHNICAL STRUCTURE', desc: 'EMA/RSI/FVG/Order Flow' },
    ];

    components.forEach(c => {
      const el = document.createElement('div');
      el.className = 'bias-component';
      el.dataset.component = c.id;
      el.innerHTML = `
        <div class="component-header">
          <span class="component-name">${c.name}</span>
          <span class="component-score" id="${c.id}Score">0</span>
        </div>
        <div class="component-bar">
          <div class="component-fill" id="${c.id}Fill"></div>
        </div>
        <div class="component-desc">${c.desc}</div>
        <div class="component-detail" id="${c.id}Detail"></div>
      `;
      container.appendChild(el);
      this.componentBars[c.id] = el.querySelector(`#${c.id}Fill`)!;
    });
  }

  public update(data: {
    goldPrice: any;
    intermarket: any;
    geopolitics: any;
    macro: any;
    technical: any;
  }): void {
    const inputs = this.buildInputs(data);
    this.lastInputs = inputs;
    const result = calculateBias(inputs);
    this.renderResult(result);
  }

  private buildInputs(data: any): BiasInputs {
    const gold = data.goldPrice || {};
    const im = data.intermarket?.symbols || [];
    const geo = data.geopolitics || {};
    const macro = data.macro || {};
    const tech = data.technical || {};

    const dxy = im.find((s: any) => s.id === 'DXY') || { value: 104, change24h: 0 };
    const us10y = im.find((s: any) => s.id === 'US10Y') || { value: 4.2, change24h: 0 };
    const tips = im.find((s: any) => s.id === 'TIPS10Y') || { value: 2.1, change24h: 0 };

    return {
      yields: {
        realYield: tips.value,
        nominalYield: us10y.value,
        change24h: tips.change24h || 0,
      },
      dxy: {
        value: dxy.value,
        ma20: dxy.value - dxy.change24h * 5,
        atr: 0.8,
        change24h: dxy.change24h || 0,
      },
      geo: {
        threatLevel: geo.threatLevel || 25,
        hotspotCount: geo.hotspots?.filter((h: any) => h.intensity > 40).length || 0,
        defcon: geo.defcon || 5,
      },
      macro: {
        surpriseIndex: macro.surpriseIndex || 0,
        eventCount: macro.events?.length || 0,
        nextEventImpact: macro.nextEventImpact || 'MEDIUM',
      },
      tech: {
        ema9: tech.ema9 || gold.mid || 2650,
        ema21: tech.ema21 || gold.mid || 2650,
        rsi: tech.rsi || 50,
        price: gold.mid || 2650,
        fvgDistance: tech.fvgDistance || 5,
        orderBookBias: tech.orderBookBias || 0,
      },
    };
  }

  private renderResult(result: BiasResult): void {
    if (this.scoreEl) {
      this.scoreEl.textContent = result.score.toString();
      this.scoreEl.style.color = getBiasColor(result.score);
    }
    if (this.labelEl) {
      this.labelEl.textContent = result.label;
      this.labelEl.style.color = getBiasColor(result.score);
    }

    Object.entries(result.components).forEach(([key, score]) => {
      const fill = this.componentBars[key];
      const scoreElement = this.content.querySelector(`#${key}Score`) as HTMLElement;
      const detailEl = this.content.querySelector(`#${key}Detail`) as HTMLElement;

      if (fill) {
        const pct = ((score + 100) / 200) * 100;
        (fill as HTMLElement).style.width = `${pct}%`;
        (fill as HTMLElement).style.background = score >= 0 
          ? `linear-gradient(90deg, #ff4444, #ffaa00 ${50}%, #44ff88)`
          : `linear-gradient(90deg, #ff4444, #ffaa00 ${50}%, #44ff88)`;
        (fill as HTMLElement).style.opacity = '0.8';
      }
      if (scoreElement) {
        scoreElement.textContent = score >= 0 ? `+${score}` : score.toString();
        scoreElement.style.color = getBiasColor(score);
      }
      if (detailEl && this.lastInputs) {
        detailEl.textContent = this.getDetailText(key, this.lastInputs[key as keyof BiasInputs]);
      }
    });
  }

  private getDetailText(component: string, inputs: any): string {
    switch (component) {
      case 'yields':
        return `Real Yield: ${inputs.realYield?.toFixed(2)}% | 24h Change: ${inputs.change24h >= 0 ? '+' : ''}${inputs.change24h.toFixed(3)}%`;
      case 'dxy':
        return `DXY: ${inputs.value?.toFixed(2)} | 24h: ${inputs.change24h >= 0 ? '+' : ''}${inputs.change24h.toFixed(2)}%`;
      case 'geo':
        return `Threat: ${inputs.threatLevel} | Hotspots: ${inputs.hotspotCount} | DEFCON: ${inputs.defcon}`;
      case 'macro':
        return `Surprise Index: ${inputs.surpriseIndex?.toFixed(2)} | Events: ${inputs.eventCount}`;
      case 'tech':
        return `EMA9: ${inputs.ema9?.toFixed(2)} | EMA21: ${inputs.ema21?.toFixed(2)} | RSI: ${inputs.rsi?.toFixed(1)}`;
      default:
        return '';
    }
  }
}