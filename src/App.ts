import type { NewsItem, BiasResult, MacroEvent, IntermarketSymbol, GeopoliticsData, OrderBookData, GoldPrice } from '@/types';
import {
  POLL_INTERVALS,
  DEFAULT_PANELS,
  STORAGE_KEYS,
  LAYOUT_PRESETS,
  ALL_PANEL_IDS,
  DEFAULT_VIEW_STATE,
  type PanelViewState,
} from '@/config';
import { fetchGoldPrice, fetchNews, fetchMacroCalendar, fetchGeopolitics, fetchIntermarket, fetchOrderBook } from '@/services/api';
import { streamManager } from '@/services/stream-manager';
import { calculateBias, BiasInputs } from '@/services/bias-calculator';
import { correlationEngine } from '@/services/correlation';
import { loadFromStorage, saveToStorage } from '@/services/storage';
import { HeaderBar } from '@/components/HeaderBar';
import { ChartCanvas } from '@/components/ChartCanvas';
import { BiasEnginePanel } from '@/components/BiasEnginePanel';
import { GeopoliticsPanel } from '@/components/GeopoliticsPanel';
import { NewsTerminal } from '@/components/NewsTerminal';
import { EconomicPanel } from '@/components/EconomicPanel';
import { IntermarketPanel } from '@/components/IntermarketPanel';
import { LiquidityPanel } from '@/components/LiquidityPanel';
import { StatusFooter } from '@/components/StatusFooter';
import { Panel, PANEL_ACTION_EVENT, type PanelActionDetail } from '@/components/Panel';

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
  private mainContent!: HTMLElement;
  private chartSection!: HTMLElement;
  private panelsGrid!: HTMLElement;
  private maximizedId: string | null = null;
  private viewState: PanelViewState = DEFAULT_VIEW_STATE;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container ${containerId} not found`);
    this.container = el;

    this.initComponents();
    this.initWorkers();
    this.setupLayoutEvents();
    this.startUptime();
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
    this.applyViewState();
    this.setupEventListeners();
    this.setupStreamManager();
  }

  private initWorkers(): void {
    if (typeof Worker !== 'undefined') {
      try {
        this.biasWorker = new Worker(new URL('./workers/analysis.worker.ts', import.meta.url), { type: 'module' });
        this.biasWorker.onmessage = (e) => {
          if (e.data.type === 'CALCULATE_BIAS' && e.data.result) {
            this.renderBiasResult(e.data.result);
          }
        };
      } catch {
        this.biasWorker = null;
      }
    }
  }

  private renderLayout(): void {
    this.container.innerHTML = '';

    this.container.appendChild(this.headerBar.getElement());

    this.mainContent = document.createElement('div');
    this.mainContent.className = 'main-content';
    this.mainContent.innerHTML = `
      <div class="chart-section" id="chartSection"></div>
      <div class="panels-grid" id="panelsGrid"></div>
    `;

    this.chartSection = this.mainContent.querySelector('#chartSection')!;
    this.panelsGrid = this.mainContent.querySelector('#panelsGrid')!;

    this.chartSection.appendChild(this.chartCanvas.getElement());

    const savedOrder = loadFromStorage<string[]>(STORAGE_KEYS.panelOrder, []);
    this.panelOrder = ALL_PANEL_IDS.filter(id => savedOrder.includes(id));
    ALL_PANEL_IDS.forEach(id => {
      if (!this.panelOrder.includes(id)) this.panelOrder.push(id);
    });

    this.panelOrder.forEach(id => {
      const panel = this.panels.get(id);
      if (panel) {
        this.panelsGrid.appendChild(panel.getElement());
        const span = DEFAULT_PANELS[id]?.span;
        if (span && !panel.getElement().classList.contains('span-1')) {
          panel.getElement().classList.add(`span-${span}`);
        }
      }
    });

    this.container.appendChild(this.mainContent);
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
        this.chartCanvas.resize();
        this.refreshAll();
      }
    });

    let resizeDebounce: ReturnType<typeof setTimeout> | null = null;
    window.addEventListener('resize', () => {
      if (resizeDebounce) clearTimeout(resizeDebounce);
      resizeDebounce = setTimeout(() => this.chartCanvas.resize(), 150);
    });

    window.addEventListener('xauusd:panel-resized', () => {
      setTimeout(() => this.chartCanvas.resize(), 50);
    });
  }

  private setupLayoutEvents(): void {
    window.addEventListener(PANEL_ACTION_EVENT, (e) => {
      const detail = (e as CustomEvent<PanelActionDetail>).detail;
      this.handlePanelAction(detail.id, detail.action);
    });

    window.addEventListener('xauusd:chart-expand', () => {
      this.toggleChartExpand();
    });

    window.addEventListener('xauusd:layout-preset', (e) => {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      this.applyLayoutPreset(id);
    });

    window.addEventListener('xauusd:toggle-panel', (e) => {
      const { id, visible } = (e as CustomEvent<{ id: string; visible: boolean }>).detail;
      this.togglePanelVisibility(id, visible);
    });

    window.addEventListener('xauusd:reset-layout', () => {
      this.resetLayout();
    });

    window.addEventListener('xauusd:menu-open', () => {
      window.dispatchEvent(new CustomEvent('xauusd:panel-state', {
        detail: {
          presetId: this.viewState.presetId,
          hidden: this.buildHiddenRecord(),
          chartOnly: this.viewState.chartOnly,
        },
      }));
    });

    document.addEventListener('click', (e) => {
      if (!this.maximizedId) return;
      const target = e.target as HTMLElement;
      if (target.closest('.panel.maximized')) return;
      this.handlePanelAction(this.maximizedId, 'restore');
    });
  }

  private startUptime(): void {
    setInterval(() => this.statusFooter.updateUptime(), 60000);
    this.statusFooter.updateUptime();
  }

  // ---- Layout engine ----

  private handlePanelAction(id: string, action: string): void {
    const panel = this.panels.get(id);
    if (!panel) return;

    switch (action) {
      case 'collapse':
        this.setPanelCollapsed(id, true);
        break;
      case 'expand':
        this.setPanelCollapsed(id, false);
        break;
      case 'maximize':
        this.maximizePanel(id);
        break;
      case 'restore':
        if (panel.isMaximized()) {
          panel.restore();
          this.clearMaximized();
        }
        break;
      case 'close':
        this.togglePanelVisibility(id, false);
        break;
      case 'open':
        this.togglePanelVisibility(id, true);
        break;
    }

    if (id === 'chartCanvas') {
      this.chartCanvas.resize();
    }
  }

  private maximizePanel(id: string): void {
    if (this.maximizedId && this.maximizedId !== id) {
      const prev = this.panels.get(this.maximizedId);
      prev?.restore();
    }
    const panel = this.panels.get(id);
    if (!panel) return;
    panel.maximize();
    this.maximizedId = id;
    document.body.classList.add('has-maximized');
  }

  private clearMaximized(): void {
    this.maximizedId = null;
    document.body.classList.remove('has-maximized');
  }

  private setPanelCollapsed(id: string, collapsed: boolean): void {
    const panel = this.panels.get(id);
    if (!panel) return;
    if (collapsed) panel.collapse();
    else panel.expand();

    if (collapsed) this.viewState.collapsed[id] = true;
    else delete this.viewState.collapsed[id];

    this.saveViewState();
    setTimeout(() => this.chartCanvas.resize(), 80);
  }

  private togglePanelVisibility(id: string, visible: boolean): void {
    const panel = this.panels.get(id);
    if (!panel) return;
    if (visible) panel.open();
    else panel.close();

    if (visible) delete this.viewState.hidden[id];
    else this.viewState.hidden[id] = true;

    this.saveViewState();
    setTimeout(() => this.chartCanvas.resize(), 80);
  }

  private buildHiddenRecord(): Record<string, boolean> {
    const hidden: Record<string, boolean> = { ...this.viewState.hidden };
    ALL_PANEL_IDS.forEach(id => {
      const panel = this.panels.get(id);
      if (panel && panel.getElement().classList.contains('hidden')) {
        hidden[id] = true;
      } else if (!hidden[id]) {
        delete hidden[id];
      }
    });
    return hidden;
  }

  private applyLayoutPreset(id: string): void {
    const preset = LAYOUT_PRESETS.find(p => p.id === id);
    if (!preset) return;

    this.viewState.presetId = id;
    this.viewState.hidden = {};
    this.viewState.collapsed = {};

    const spans = preset.spans || {};
    ALL_PANEL_IDS.forEach(pid => {
      const panel = this.panels.get(pid);
      if (!panel) return;

      const visible = preset.visible.includes(pid);
      if (visible) panel.open();
      else panel.close();
      if (visible) delete this.viewState.hidden[pid];
      else this.viewState.hidden[pid] = true;

      const meta = DEFAULT_PANELS[pid];
      const span = spans[pid] || (id === 'default' ? meta?.span : undefined) || 1;
      panel.getElement().classList.remove('span-1', 'span-2', 'span-3', 'span-4');
      panel.getElement().classList.add(`span-${span}`);
    });

    this.setChartOnly(Boolean(preset.chartOnly));
    this.saveViewState();
    setTimeout(() => this.chartCanvas.resize(), 150);
  }

  private setChartOnly(enabled: boolean): void {
    this.viewState.chartOnly = enabled;
    this.mainContent.classList.toggle('chart-only', enabled);
    document.body.classList.toggle('chart-full', enabled);
  }

  private toggleChartExpand(): void {
    const enabled = !this.viewState.chartOnly;
    this.setChartOnly(enabled);
    this.saveViewState();
    setTimeout(() => this.chartCanvas.resize(), 150);
  }

  private resetLayout(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.layout);
      localStorage.removeItem('xauusd-panel-spans');
      localStorage.removeItem('xauusd-panel-heights');
    } catch { /* ignore */ }

    ALL_PANEL_IDS.forEach(id => {
      const panel = this.panels.get(id);
      if (!panel) return;
      panel.open();
      panel.expand();
      panel.restore();
      const meta = DEFAULT_PANELS[id];
      panel.getElement().classList.remove('span-1', 'span-2', 'span-3', 'span-4');
      if (meta?.span) panel.getElement().classList.add(`span-${meta.span}`);
      else panel.getElement().classList.add('span-1');
      panel.resetHeight();
    });

    this.clearMaximized();
    this.mainContent.classList.remove('chart-only');
    document.body.classList.remove('chart-full');
    this.viewState = { ...DEFAULT_VIEW_STATE };
    this.saveViewState();
    setTimeout(() => this.chartCanvas.resize(), 150);
  }

  private applyViewState(): void {
    const saved = loadFromStorage<Partial<PanelViewState>>(STORAGE_KEYS.layout, {});
    this.viewState = { ...DEFAULT_VIEW_STATE, ...saved };

    if (this.viewState.presetId !== 'default') {
      const preset = LAYOUT_PRESETS.find(p => p.id === this.viewState.presetId);
      if (preset) {
        this.viewState.hidden = {};
        const spans = preset.spans || {};
        ALL_PANEL_IDS.forEach(pid => {
          const panel = this.panels.get(pid);
          if (!panel) return;
          if (preset.visible.includes(pid)) panel.open();
          else {
            panel.close();
            this.viewState.hidden![pid] = true;
          }
          const span = spans[pid] || 1;
          panel.getElement().classList.add(`span-${span}`);
        });
      }
    }

    ALL_PANEL_IDS.forEach(id => {
      const panel = this.panels.get(id);
      if (!panel) return;
      if (this.viewState.collapsed?.[id]) panel.collapse();
      if (this.viewState.hidden?.[id]) panel.close();
    });

    if (this.viewState.chartOnly) {
      this.mainContent.classList.add('chart-only');
      document.body.classList.add('chart-full');
    }
  }

  private saveViewState(): void {
    saveToStorage(STORAGE_KEYS.layout, this.viewState);
  }

  // ---- Data flow ----

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
        this.chartCanvas.updatePrice(data.mid);
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

    const imSymbols = im?.lastData?.symbols || [];
    const dxySymbol = imSymbols.find((s: IntermarketSymbol) => s.id === 'DXY');
    const us10ySymbol = imSymbols.find((s: IntermarketSymbol) => s.id === 'US10Y');
    const tipsSymbol = imSymbols.find((s: IntermarketSymbol) => s.id === 'TIPS10Y');

    return {
      yields: {
        realYield: tipsSymbol?.value ?? 2.1,
        nominalYield: us10ySymbol?.value ?? 4.2,
        change24h: tipsSymbol?.change24h ?? 0,
      },
      dxy: {
        value: dxySymbol?.value ?? 104,
        ma20: (dxySymbol?.value ?? 104) - (dxySymbol?.change24h ?? 0) * 5,
        atr: 0.8,
        change24h: dxySymbol?.change24h ?? 0,
      },
      geo: {
        threatLevel: geo?.lastData?.threatLevel ?? 25,
        hotspotCount: geo?.lastData?.hotspots?.filter((h: any) => h.intensity > 40).length ?? 0,
        defcon: geo?.lastData?.defcon ?? 5,
      },
      macro: {
        surpriseIndex: macro?.lastData?.surpriseIndex ?? 0,
        eventCount: macro?.lastData?.events?.length ?? 0,
        nextEventImpact: macro?.lastData?.nextEventImpact ?? 'MEDIUM',
      },
      tech: {
        ema9: tech?.lastData?.ema9 ?? this.lastGoldPrice?.mid ?? 2650,
        ema21: tech?.lastData?.ema21 ?? this.lastGoldPrice?.mid ?? 2650,
        rsi: tech?.lastData?.rsi ?? 50,
        price: this.lastGoldPrice?.mid ?? 2650,
        fvgDistance: tech?.lastData?.fvgDistance ?? 5,
        orderBookBias: tech?.lastData?.orderBookBias ?? 0,
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

  public destroy(): void {
    this.refreshTimers.forEach(timer => clearInterval(timer));
    this.refreshTimers.clear();
    streamManager.destroy();
    if (this.biasWorker) this.biasWorker.terminate();
    this.panels.forEach(p => p.destroy());
  }
}