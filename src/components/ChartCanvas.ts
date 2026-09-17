import { Panel, dispatchPanelAction } from './Panel';

const TV_SCRIPT_SRC = 'https://s3.tradingview.com/tv.js';
const WATCHDOG_MS = 15000;
const SOFT_RECONNECT_MS = 60000;

export class ChartCanvas extends Panel {
  private tvWidget: any = null;
  private fallbackChart: any = null;
  private currentInterval = '5';
  private intervals = ['1', '5', '15', '60', '240', 'D'];
  private priceHistory: { time: number; value: number }[] = [];
  private retryCount = 0;
  private maxRetries = 3;
  private scriptLoaded = false;
  private scriptLoading = false;
  private scriptFailed = false;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private lastSoftReconnect = 0;
  private resizeObserver: ResizeObserver | null = null;
  private resizeDebounce: ReturnType<typeof setTimeout> | null = null;
  private fallbackArmed = false;

  constructor() {
    super({ id: 'chartCanvas', title: 'XAUUSD CHART', className: 'chart-canvas', showCount: false, trackActivity: false, controls: false });
    this.render();
  }

  private render(): void {
    this.header.style.display = 'none';
    (this as any).resizeHandle!.style.display = 'none';
    this.content.style.padding = '0';
    this.content.innerHTML = `
      <div class="chart-toolbar">
        <div class="interval-buttons" id="intervalButtons"></div>
        <div class="chart-info">
          <span class="chart-symbol">XAUUSD</span>
          <span class="chart-interval" id="currentInterval">5m</span>
          <span class="chart-status" id="chartStatus">Loading...</span>
        </div>
        <div class="chart-controls">
          <button class="icon-btn" id="chartExpandBtn" title="Expand chart to full height">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          </button>
          <button class="icon-btn" id="chartMaximizeBtn" title="Maximize / Restore chart">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
          </button>
          <button class="icon-btn" id="chartReconnectBtn" title="Reconnect TradingView chart">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
      </div>
      <div class="chart-container" id="chartContainer" style="width:100%;height:100%;"></div>
    `;
    this.setupIntervalButtons();
    this.setupToolbar();
    this.initTradingView();
    this.startWatchdog();
    this.trackContainer();
  }

  private setupIntervalButtons(): void {
    const container = this.content.querySelector('#intervalButtons') as HTMLElement;
    if (!container) return;

    this.intervals.forEach(interval => {
      const btn = document.createElement('button');
      btn.className = `interval-btn ${interval === this.currentInterval ? 'active' : ''}`;
      btn.setAttribute('data-interval', interval);
      btn.textContent = interval === 'D' ? '1D' : interval === '240' ? '4H' : interval === '60' ? '1H' : `${interval}m`;
      btn.addEventListener('click', () => this.setInterval(interval));
      container.appendChild(btn);
    });
  }

  private setupToolbar(): void {
    this.content.querySelector('#chartExpandBtn')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('xauusd:chart-expand'));
    });

    this.content.querySelector('#chartMaximizeBtn')?.addEventListener('click', () => {
      dispatchPanelAction('chartCanvas', this.isMaximized() ? 'restore' : 'maximize');
    });

    this.content.querySelector('#chartReconnectBtn')?.addEventListener('click', () => {
      this.reconnect();
    });
  }

  private setInterval(interval: string): void {
    this.currentInterval = interval;
    this.content.querySelectorAll('.interval-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-interval') === interval);
    });
    this.content.querySelector('#currentInterval')!.textContent = interval === 'D' ? '1D' : interval === '240' ? '4H' : interval === '60' ? '1H' : `${interval}m`;
    this.updateStatus('Switching interval...');

    if (this.tvWidget && typeof this.tvWidget.setInterval === 'function') {
      this.tvWidget.setInterval(interval);
      this.updateStatus('TradingView Live');
    } else if (this.fallbackChart) {
      this.fallbackChart.setInterval(interval);
      this.updateStatus('Fallback Chart');
    }
  }

  private initTradingView(): void {
    const container = this.content.querySelector('#chartContainer');
    if (!container) return;

    if (!this.isVisible()) {
      this.updateStatus('Waiting for visibility...');
      return;
    }

    if ((window as any).TradingView) {
      this.scriptLoaded = true;
      this.createWidget();
    } else {
      this.loadTradingViewScript();
    }
  }

  private isVisible(): boolean {
    const container = this.content.querySelector('#chartContainer') as HTMLElement | null;
    if (!container) return false;
    const rect = container.getBoundingClientRect();
    return rect.width > 50 && rect.height > 50;
  }

  private loadTradingViewScript(): void {
    if (this.scriptLoading || this.scriptLoaded || this.scriptFailed) return;
    this.scriptLoading = true;

    const script = document.createElement('script');
    script.src = TV_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      this.scriptLoaded = true;
      this.scriptLoading = false;
      this.retryCount = 0;
      this.updateStatus('TradingView Live');
      this.createWidget();
    };
    script.onerror = () => {
      this.scriptLoading = false;
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        this.updateStatus(`Retrying TV script (${this.retryCount})...`);
        setTimeout(() => this.loadTradingViewScript(), 1000 * this.retryCount);
      } else {
        this.scriptFailed = true;
        console.warn('[ChartCanvas] TradingView failed to load, using fallback chart');
        this.initFallbackChart();
      }
    };
    document.head.appendChild(script);
  }

  private createWidget(): void {
    const container = this.content.querySelector('#chartContainer');
    if (!container || (window as any).TradingView === undefined) {
      this.initFallbackChart();
      return;
    }

    if (!this.isVisible()) {
      this.updateStatus('Waiting for visibility...');
      return;
    }

    try {
      // Remove any stale iframe before creating a fresh widget
      container.innerHTML = '';
      this.fallbackChart = null;

      this.tvWidget = new (window as any).TradingView.widget({
        container_id: 'chartContainer',
        autosize: true,
        symbol: 'OANDA:XAUUSD',
        interval: this.currentInterval,
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        hide_side_toolbar: false,
        allow_symbol_change: false,
        enable_publishing: false,
        withdateranges: true,
        studies: ['Volume@tv-basicstudies'],
        backgroundColor: '#07080a',
        gridColor: '#141721',
        overrides: {
          'paneProperties.background': '#07080a',
          'paneProperties.vertGridProperties.color': '#141721',
          'paneProperties.horzGridProperties.color': '#141721',
          'mainSeriesProperties.candleStyle.upColor': '#d4af37',
          'mainSeriesProperties.candleStyle.downColor': '#ef4444',
          'mainSeriesProperties.candleStyle.drawWick': true,
          'mainSeriesProperties.candleStyle.drawBorder': true,
          'mainSeriesProperties.candleStyle.borderUpColor': '#d4af37',
          'mainSeriesProperties.candleStyle.borderDownColor': '#ef4444',
          'mainSeriesProperties.candleStyle.wickUpColor': '#d4af37',
          'mainSeriesProperties.candleStyle.wickDownColor': '#ef4444',
          'volumePaneProperties.background': '#07080a',
          'volumePaneProperties.volume.upColor': 'rgba(212, 175, 55, 0.7)',
          'volumePaneProperties.volume.downColor': 'rgba(239, 68, 68, 0.7)',
        },
        studies_overrides: {
          'volume.volume.color.0': 'rgba(212, 175, 55, 0.7)',
          'volume.volume.color.1': 'rgba(239, 68, 68, 0.7)',
        },
        onChartReady: () => {
          this.fallbackArmed = false;
          this.updateStatus('TradingView Live');
          console.log('[ChartCanvas] TradingView ready');
          this.resize();
        },
      });

      this.fallbackArmed = true;
      // If the widget fails to initialize within 5s, fall back to the canvas chart
      setTimeout(() => {
        if (!this.tvWidget || !container.querySelector('iframe')) {
          console.warn('[ChartCanvas] TradingView widget failed to render, using fallback');
          this.initFallbackChart();
        }
      }, 5000);

    } catch (e) {
      console.error('[ChartCanvas] TradingView widget error:', e);
      this.initFallbackChart();
    }
  }

  private startWatchdog(): void {
    if (this.watchdogTimer) return;

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.resize();
        this.softReconnect();
      }
    });

    window.addEventListener('focus', () => {
      this.softReconnect();
    });

    this.watchdogTimer = setInterval(() => {
      const container = this.content.querySelector('#chartContainer') as HTMLElement | null;
      if (!container) return;

      if (this.tvWidget && this.fallbackArmed && !container.querySelector('iframe')) {
        console.warn('[ChartCanvas] TradingView widget iframe lost — re-creating');
        this.createWidget();
      } else if (!this.tvWidget && !this.fallbackChart && this.scriptLoaded && this.isVisible()) {
        console.log('[ChartCanvas] No widget present — re-initializing');
        this.createWidget();
      }
    }, WATCHDOG_MS);
  }

  private softReconnect(): void {
    const now = Date.now();
    if (now - this.lastSoftReconnect < SOFT_RECONNECT_MS) return;
    if (!this.tvWidget || !this.isVisible()) return;

    const container = this.content.querySelector('#chartContainer') as HTMLElement | null;
    if (!container || (this.fallbackArmed && !container.querySelector('iframe'))) {
      this.lastSoftReconnect = now;
      this.createWidget();
    }
  }

  private trackContainer(): void {
    const container = this.content.querySelector('#chartContainer');
    if (!container || typeof ResizeObserver === 'undefined') return;

    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeDebounce) clearTimeout(this.resizeDebounce);
      this.resizeDebounce = setTimeout(() => this.resize(), 100);
    });
    this.resizeObserver.observe(container);
  }

  public reconnect(): void {
    if (this.fallbackChart) {
      this.fallbackChart.destroy();
      this.fallbackChart = null;
      const container = this.content.querySelector('#chartContainer');
      if (container) container.innerHTML = '';
    }
    this.tvWidget = null;
    this.scriptFailed = false;
    this.updateStatus('Reconnecting...');
    if ((window as any).TradingView) {
      this.createWidget();
    } else {
      this.loadTradingViewScript();
    }
  }

  private initFallbackChart(): void {
    const container = this.content.querySelector('#chartContainer');
    if (!container) return;

    // Clear TradingView if it was partially loaded
    container.innerHTML = '';
    this.tvWidget = null;
    this.fallbackArmed = false;

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    this.fallbackChart = new FallbackChart(canvas);
    this.updateStatus('Fallback Chart');
    this.fallbackChart.setPriceHistory(this.priceHistory);
    this.fallbackChart.setInterval(this.currentInterval);
  }

  private updateStatus(status: string): void {
    const statusEl = this.content.querySelector('#chartStatus');
    if (statusEl) statusEl.textContent = status;
  }

  public updatePrice(price: number): void {
    const now = Date.now();
    this.priceHistory.push({ time: now, value: price });
    if (this.priceHistory.length > 500) this.priceHistory.shift();

    if (this.fallbackChart) {
      this.fallbackChart.addPoint(now, price);
    }
  }

  public resize(): void {
    if (this.resizeDebounce) clearTimeout(this.resizeDebounce);
    if (this.tvWidget && typeof this.tvWidget.resize === 'function') {
      try {
        this.tvWidget.resize();
      } catch { /* ignore */ }
    }
    if (this.fallbackChart) {
      this.fallbackChart.resize();
    }
  }

  public destroy(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.resizeDebounce) clearTimeout(this.resizeDebounce);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.tvWidget && typeof this.tvWidget.remove === 'function') {
      try {
        this.tvWidget.remove();
      } catch { /* ignore */ }
      this.tvWidget = null;
    }
    if (this.fallbackChart) {
      this.fallbackChart.destroy();
      this.fallbackChart = null;
    }
    super.destroy();
  }
}

// Lightweight fallback chart using Canvas
class FallbackChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private data: { time: number; value: number }[] = [];
  private interval = '5';
  private animationId: number | null = null;
  private lastWidth = 0;
  private lastHeight = 0;
  private resizeHandler: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resizeHandler = () => this.setupCanvas();
    this.setupCanvas();
    this.render();
    window.addEventListener('resize', this.resizeHandler);
  }

  private setupCanvas(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(rect.width * window.devicePixelRatio));
    this.canvas.height = Math.max(1, Math.round(rect.height * window.devicePixelRatio));
    this.ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    this.lastWidth = Math.max(1, rect.width);
    this.lastHeight = Math.max(1, rect.height);
    this.render();
  }

  public setPriceHistory(data: { time: number; value: number }[]): void {
    this.data = data;
    this.render();
  }

  public addPoint(time: number, value: number): void {
    this.data.push({ time, value });
    if (this.data.length > 500) this.data.shift();
    this.render();
  }

  public setInterval(interval: string): void {
    this.interval = interval;
  }

  public resize(): void {
    this.setupCanvas();
  }

  private render(): void {
    const ctx = this.ctx;
    const width = this.lastWidth;
    const height = this.lastHeight;

    ctx.clearRect(0, 0, width, height);

    if (this.data.length < 2) return;

    const values = this.data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const padding = range * 0.05;

    ctx.strokeStyle = '#1e222d';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 6; i++) {
      const x = (i / 6) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    const first = this.data[0];
    const last = this.data[this.data.length - 1];
    if (!first || !last) return;

    const isUp = last.value >= first.value;
    ctx.strokeStyle = isUp ? '#d4af37' : '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    this.data.forEach((point, i) => {
      const x = (i / (this.data.length - 1)) * width;
      const y = height - ((point.value - min + padding) / (range + padding * 2)) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = isUp ? '#d4af37' : '#ef4444';
    ctx.font = '12px monospace';
    ctx.fillText(`${last.value.toFixed(2)} | ${this.interval}`, 8, 18);
  }

  public destroy(): void {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.resizeHandler);
  }
}