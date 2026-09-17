import { Panel } from './Panel';

export class ChartCanvas extends Panel {
  private tvWidget: any = null;
  private fallbackChart: any = null;
  private currentInterval = '5';
  private intervals = ['1', '5', '15', '60', '240', 'D'];
  private priceHistory: { time: number; value: number }[] = [];
  private retryCount = 0;
  private maxRetries = 3;

  constructor() {
    super({ id: 'chartCanvas', title: 'XAUUSD CHART', className: 'chart-canvas', showCount: false, trackActivity: false });
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
      </div>
      <div class="chart-container" id="chartContainer" style="width:100%;height:100%;"></div>
    `;
    this.setupIntervalButtons();
    this.initTradingView();
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

  private setInterval(interval: string): void {
    this.currentInterval = interval;
    this.content.querySelectorAll('.interval-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-interval') === interval);
    });
    this.content.querySelector('#currentInterval')!.textContent = interval === 'D' ? '1D' : interval === '240' ? '4H' : interval === '60' ? '1H' : `${interval}m`;
    
    if (this.tvWidget && typeof this.tvWidget.setInterval === 'function') {
      this.tvWidget.setInterval(interval);
    } else if (this.fallbackChart) {
      this.fallbackChart.setInterval(interval);
    }
  }

  private initTradingView(): void {
    const container = this.content.querySelector('#chartContainer');
    if (!container) return;

    if ((window as any).TradingView) {
      this.createWidget();
    } else {
      this.loadTradingViewScript();
    }
  }

  private loadTradingViewScript(): void {
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      this.retryCount = 0;
      this.createWidget();
    };
    script.onerror = () => {
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        setTimeout(() => this.loadTradingViewScript(), 1000 * this.retryCount);
      } else {
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

    try {
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
          this.updateStatus('TradingView Live');
          console.log('[ChartCanvas] TradingView ready');
        },
      });

      // Fallback if widget fails to initialize
      setTimeout(() => {
        if (!this.tvWidget || !container.querySelector('.tv-chart-container')) {
          console.warn('[ChartCanvas] TradingView widget failed to render, using fallback');
          this.initFallbackChart();
        }
      }, 5000);

    } catch (e) {
      console.error('[ChartCanvas] TradingView widget error:', e);
      this.initFallbackChart();
    }
  }

  private initFallbackChart(): void {
    const container = this.content.querySelector('#chartContainer');
    if (!container) return;

    // Clear TradingView if it was partially loaded
    container.innerHTML = '';
    this.tvWidget = null;

    // Create lightweight canvas chart
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
    // Keep last 500 points
    if (this.priceHistory.length > 500) this.priceHistory.shift();

    if (this.fallbackChart) {
      this.fallbackChart.addPoint(now, price);
    }
  }

  public resize(): void {
    if (this.tvWidget && typeof this.tvWidget.resize === 'function') {
      this.tvWidget.resize();
    }
    if (this.fallbackChart) {
      this.fallbackChart.resize();
    }
  }

  public destroy(): void {
    if (this.tvWidget && typeof this.tvWidget.remove === 'function') {
      this.tvWidget.remove();
    }
    if (this.fallbackChart) {
      this.fallbackChart.destroy();
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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.setupCanvas();
    this.render();
  }

  private setupCanvas(): void {
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.lastWidth = rect.width;
    this.lastHeight = rect.height;

    window.addEventListener('resize', () => this.setupCanvas());
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

    // Clear
    ctx.clearRect(0, 0, width, height);

    if (this.data.length < 2) return;

    // Find min/max
    const values = this.data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const padding = range * 0.05;

    // Draw grid
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

    if (this.data.length < 2) return;

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

    // Draw current price label
    ctx.fillStyle = isUp ? '#d4af37' : '#ef4444';
    ctx.font = '12px monospace';
    ctx.fillText(last.value.toFixed(2), width - 80, 20);
  }

  public destroy(): void {
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }
}