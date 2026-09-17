import type { NewsItem, BiasResult, MacroEvent, IntermarketSymbol, GeopoliticsData, OrderBookData, GoldPrice } from '@/types';
import {
  POLL_INTERVALS,
  DEFAULT_PANELS,
  STORAGE_KEYS,
} from '@/config';
import { fetchGoldPrice, fetchNews, fetchMacroCalendar, fetchGeopolitics, fetchIntermarket, fetchOrderBook } from '@/services/api';
import { streamManager } from '@/services/stream-manager';
import { calculateBias, BiasInputs } from '@/services/bias-calculator';
import { correlationEngine } from '@/services/correlation';
import { loadFromStorage } from '@/services/storage';
import { HeaderBar } from '@/components/HeaderBar';
import { ChartCanvas } from '@/components/ChartCanvas';
import { BiasEnginePanel } from '@/components/BiasEnginePanel';
import { GeopoliticsPanel } from '@/components/GeopoliticsPanel';
import { NewsTerminal } from '@/components/NewsTerminal';
import { EconomicPanel } from '@/components/EconomicPanel';
import { IntermarketPanel } from '@/components/IntermarketPanel';
import { LiquidityPanel } from '@/components/LiquidityPanel';
import { StatusFooter } from '@/components/StatusFooter';
import { Panel } from '@/components/Panel';

interface PanelInstance extends Panel {
  update?: (data: any) => void;
}

export class App {
  private container: HTMLElement;
  private headerBar!: HeaderBar;
  private chartCanvas!: ChartCanvas;
  private biasEngine!: BiasEnginePanel;
  private geopolitics!: GeopoliticsPanel;
  private newsTerminal!: NewsTerminal;
  private economicPanel!: EconomicPanel;
  private intermarketPanel!: IntermarketPanel;
  private liquidityPanel!: LiquidityPanel;
  private statusFooter!: StatusFooter;

  private panels: Map<string, PanelInstance> = new Map();
  private panelOrder: string[] = [];
  private refreshTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private wsConnected = false;
  private lastGoldPrice: GoldPrice | null = null;
  private biasWorker: Worker | null = null;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container ${containerId} not found`);
    this.container = el;

    this.loadPanelLayout();
    this.initComponents();
    this.initWorkers();
  }

  private initComponents(): void {
    this.headerBar = new HeaderBar();
    this.chartCanvas = new ChartCanvas();
    this.biasEngine = new BiasEnginePanel();
    this.geopolitics = new GeopoliticsPanel();
    this.newsTerminal = new NewsTerminal();
    this.economicPanel = new EconomicPanel();
    this.intermarketPanel = new IntermarketPanel();
    this.liquidityPanel = new LiquidityPanel();
    this.statusFooter = new StatusFooter();

    this.panels.set('headerBar', this.headerBar);
    this.panels.set('chartCanvas', this.chartCanvas);
    this.panels.set('biasEngine', this.biasEngine);
    this.panels.set('geopolitics', this.geopolitics);
    this.panels.set('newsTerminal', this.newsTerminal);
    this.panels.set('economicCalendar', this.economicPanel);
    this.panels.set('intermarket', this.intermarketPanel);
    this.panels.set('liquidity', this.liquidityPanel);
    this.panels.set('statusFooter', this.statusFooter);

    this.renderLayout();
    this.setupEventListeners();
    this.setupStreamManager();
  }

  private initWorkers(): void {
    if (typeof Worker !== 'undefined') {
      this.biasWorker = new Worker(new URL('./workers/analysis.worker.ts', import.meta.url), { type: 'module' });
      this.biasWorker.onmessage = (e) => {
        if (e.data.type === 'CALCULATE_BIAS' && e.data.result) {
          this.renderBiasResult(e.data.result);
        }
      };
    }
  }

  private renderLayout(): void {
    this.container.innerHTML = '';
    
    this.container.appendChild(this.headerBar.getElement());
    
    const mainContent = document.createElement('div');
    mainContent.className = 'main-content';
    mainContent.innerHTML = `
      <div class="chart-section" id="chartSection"></div>
      <div class="panels-grid" id="panelsGrid"></div>
    `;
    
    const chartSection = mainContent.querySelector('#chartSection')!;
    const panelsGrid = mainContent.querySelector('#panelsGrid')!;
    
    chartSection.appendChild(this.chartCanvas.getElement());
    
    this.panelOrder = ['biasEngine', 'geopolitics', 'newsTerminal', 'economicCalendar', 'intermarket', 'liquidity'];
    this.panelOrder.forEach(id => {
      const panel = this.panels.get(id);
      if (panel) {
        panelsGrid.appendChild(panel.getElement());
        if (DEFAULT_PANELS[id]?.span) {
          panel.getElement().classList.add(`span-${DEFAULT_PANELS[id].span}`);
        }
      }
    });
    
    this.container.appendChild(mainContent);
    this.container.appendChild(this.statusFooter.getElement());
  }

  private setupEventListeners(): void {
    window.addEventListener('xauusd:refresh', () => this.refreshAll());
    window.addEventListener('xauusd:critical-news', () => {
      if (this.headerBar.isSoundEnabled()) this.headerBar.playAlert();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        document.body.classList.add('animations-paused');
      } else {
        document.body.classList.remove('animations-paused');
        this.refreshAll();
      }
    });

    window.addEventListener('resize', () => this.chartCanvas.resize());
  }

  private setupStreamManager(): void {
    streamManager.onStateChange((state) => {
      this.wsConnected = state === 'open';
      this.updateConnectionStatus();
    });

    streamManager.onMessage('gold', (data) => this.onGoldUpdate(data));
    streamManager.onMessage('news', (data) => this.onNewsUpdate(data));
    streamManager.onMessage('macro', (data) => this.onMacroUpdate(data));
    streamManager.onMessage('geo', (data) => this.onGeoUpdate(data));
    streamManager.onMessage('intermarket', (data) => this.onIntermarketUpdate(data));
    streamManager.onMessage('orderbook', (data) => this.onOrderBookUpdate(data));

    streamManager.connect().catch(console.error);
  }

  private updateConnectionStatus(): void {
    const latency = streamManager.getLatency();
    this.statusFooter.updateWebSocket(this.wsConnected, Math.round(latency.current));
  }

  public async init(): Promise<void> {
    await this.refreshAll();
    this.startPolling();
  }

  private startPolling(): void {
    this.refreshTimers.set('gold', setInterval(() => this.fetchAndUpdate('gold'), POLL_INTERVALS.gold));
    this.refreshTimers.set('news', setInterval(() => this.fetchAndUpdate('news'), POLL_INTERVALS.news));
    this.refreshTimers.set('macro', setInterval(() => this.fetchAndUpdate('macro'), POLL_INTERVALS.macro));
    this.refreshTimers.set('geo', setInterval(() => this.fetchAndUpdate('geo'), POLL_INTERVALS.geopolitics));
    this.refreshTimers.set('intermarket', setInterval(() => this.fetchAndUpdate('intermarket'), POLL_INTERVALS.intermarket));
    this.refreshTimers.set('orderbook', setInterval(() => this.fetchAndUpdate('orderbook'), POLL_INTERVALS.orderbook));
  }

  private async refreshAll(): Promise<void> {
    await Promise.allSettled([
      this.fetchAndUpdate('gold'),
      this.fetchAndUpdate('news'),
      this.fetchAndUpdate('macro'),
      this.fetchAndUpdate('geo'),
      this.fetchAndUpdate('intermarket'),
      this.fetchAndUpdate('orderbook'),
    ]);
  }

  private async fetchAndUpdate(type: string): Promise<void> {
    try {
      let data: any;
      switch (type) {
        case 'gold': data = await fetchGoldPrice(); break;
        case 'news': data = await fetchNews(); break;
        case 'macro': data = await fetchMacroCalendar(); break;
        case 'geo': data = await fetchGeopolitics(); break;
        case 'intermarket': data = await fetchIntermarket(); break;
        case 'orderbook': data = await fetchOrderBook(); break;
      }
      this.handleData(type, data);
      this.statusFooter.updateApiStatus(type, 'ok');
    } catch (error) {
      console.error(`[App] ${type} fetch failed:`, error);
      this.statusFooter.updateApiStatus(type, 'error');
    }
  }

  private handleData(type: string, data: any): void {
    switch (type) {
      case 'gold':
        this.lastGoldPrice = data;
        this.headerBar.updatePrice(data);
        break;
      case 'news':
        this.newsTerminal.update(data);
        break;
      case 'macro':
        this.economicPanel.update(data);
        break;
      case 'geo':
        this.geopolitics.update(data);
        break;
      case 'intermarket':
        this.intermarketPanel.update(data);
        break;
      case 'orderbook':
        this.liquidityPanel.update(data);
        break;
    }
    this.updateBiasEngine();
  }

  private onGoldUpdate(data: GoldPrice): void {
    this.lastGoldPrice = data;
    this.headerBar.updatePrice(data);
    this.chartCanvas.updatePrice(data.mid);
    this.updateBiasEngine();
  }

  private onNewsUpdate(data: { items: NewsItem[]; errors: string[] }): void {
    this.newsTerminal.update(data);
  }

  private onMacroUpdate(data: { events: MacroEvent[]; nextEvent: any; timestamp: number }): void {
    this.economicPanel.update(data);
  }

  private onGeoUpdate(data: GeopoliticsData): void {
    this.geopolitics.update(data);
    this.updateBiasEngine();
  }

  private onIntermarketUpdate(data: { symbols: IntermarketSymbol[]; correlations: any; goldSilverRatio: string }): void {
    this.intermarketPanel.update(data);
    this.updateCorrelations(data.symbols);
    this.updateBiasEngine();
  }

  private onOrderBookUpdate(data: OrderBookData): void {
    this.liquidityPanel.update(data);
    this.updateBiasEngine();
  }

  private updateCorrelations(symbols: IntermarketSymbol[]): void {
    const goldPrice = this.lastGoldPrice?.mid || 2650;
    correlationEngine.addGoldPoint(goldPrice, Date.now());
    symbols.forEach(s => correlationEngine.addSymbolPoint(s.id, s.value, Date.now()));
  }

  private updateBiasEngine(): void {
    if (!this.lastGoldPrice) return;

    const inputs = this.buildBiasInputs();
    
    if (this.biasWorker) {
      this.biasWorker.postMessage({
        type: 'CALCULATE_BIAS',
        payload: inputs,
        id: Date.now()
      });
    } else {
      const result = calculateBias(inputs);
      this.renderBiasResult(result);
    }
  }

  private buildBiasInputs(): BiasInputs {
    const im = this.intermarketPanel as any;
    const geo = this.geopolitics as any;
    const macro = this.economicPanel as any;
    const tech = this.liquidityPanel as any;

    const dxySymbol = im?.lastData?.symbols?.find((s: IntermarketSymbol) => s.id === 'DXY');
    const us10ySymbol = im?.lastData?.symbols?.find((s: IntermarketSymbol) => s.id === 'US10Y');
    const tipsSymbol = im?.lastData?.symbols?.find((s: IntermarketSymbol) => s.id === 'TIPS10Y');

    return {
      yields: {
        realYield: tipsSymbol?.value || 2.1,
        nominalYield: us10ySymbol?.value || 4.2,
        change24h: tipsSymbol?.change24h || 0,
      },
      dxy: {
        value: dxySymbol?.value || 104,
        ma20: (dxySymbol?.value || 104) - (dxySymbol?.change24h || 0) * 5,
        atr: 0.8,
        change24h: dxySymbol?.change24h || 0,
      },
      geo: {
        threatLevel: geo?.lastData?.threatLevel || 25,
        hotspotCount: geo?.lastData?.hotspots?.filter((h: any) => h.intensity > 40).length || 0,
        defcon: geo?.lastData?.defcon || 5,
      },
      macro: {
        surpriseIndex: macro?.lastData?.surpriseIndex || 0,
        eventCount: macro?.lastData?.events?.length || 0,
        nextEventImpact: macro?.lastData?.nextEventImpact || 'MEDIUM',
      },
      tech: {
        ema9: tech?.lastData?.ema9 || this.lastGoldPrice?.mid || 2650,
        ema21: tech?.lastData?.ema21 || this.lastGoldPrice?.mid || 2650,
        rsi: tech?.lastData?.rsi || 50,
        price: this.lastGoldPrice?.mid || 2650,
        fvgDistance: tech?.lastData?.fvgDistance || 5,
        orderBookBias: tech?.lastData?.orderBookBias || 0,
      },
    };
  }

  private renderBiasResult(result: BiasResult): void {
    this.biasEngine.update({
      goldPrice: this.lastGoldPrice,
      intermarket: (this.intermarketPanel as any).lastData,
      geopolitics: (this.geopolitics as any).lastData,
      macro: (this.economicPanel as any).lastData,
      technical: (this.liquidityPanel as any).lastData,
    });
    
    this.headerBar.updateBias({ score: result.score, label: result.label });
  }

  private loadPanelLayout(): void {
    const saved = loadFromStorage<string[]>(STORAGE_KEYS.panelOrder, []);
    if (saved.length > 0) this.panelOrder = saved;
  }

  public destroy(): void {
    this.refreshTimers.forEach(timer => clearInterval(timer));
    this.refreshTimers.clear();
    streamManager.destroy();
    if (this.biasWorker) this.biasWorker.terminate();
    this.panels.forEach(p => p.destroy());
  }
}