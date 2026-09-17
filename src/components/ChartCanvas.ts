import { Panel } from './Panel';

export class ChartCanvas extends Panel {
  private tvWidget: any = null;
  private currentInterval = '5';
  private intervals = ['1', '5', '15', '60', '240', 'D'];

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
          <span class="chart-symbol">OANDA:XAUUSD</span>
          <span class="chart-interval" id="currentInterval">5m</span>
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
    
    if (this.tvWidget) {
      this.tvWidget.setInterval(interval);
    }
  }

  private initTradingView(): void {
    const container = this.content.querySelector('#chartContainer');
    if (!container) return;

    if ((window as any).TradingView) {
      this.createWidget();
    } else {
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.onload = () => this.createWidget();
      document.head.appendChild(script);
    }
  }

  private createWidget(): void {
    const container = this.content.querySelector('#chartContainer');
    if (!container || (window as any).TradingView === undefined) return;

    this.tvWidget = new (window as any).TradingView.widget({
      symbol: 'OANDA:XAUUSD',
      interval: this.currentInterval,
      container_id: 'chartContainer',
      datafeed: undefined,
      library_path: 'https://s3.tradingview.com/charting_library/',
      locale: 'en',
      theme: 'dark',
      style: '1',
      timezone: 'Etc/UTC',
      enabled_features: [
        'study_templates',
        'hide_left_toolbar_by_default',
        'hide_right_toolbar_by_default',
        'header_chart_type',
        'header_indicators',
        'header_screenshot',
      ],
      disabled_features: [
        'header_symbol_search',
        'header_compare',
        'header_undo_redo',
        'header_saveload',
        'volume_force_overlay',
      ],
      overrides: {
        'backgroundColor': '#07080a',
        'gridLinesColor': '#141721',
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
        'volumePaneProperties.volume.upColor': '#d4af3780',
        'volumePaneProperties.volume.downColor': '#ef444480',
      },
      studies_overrides: {
        'volume.volume.color.0': '#d4af3780',
        'volume.volume.color.1': '#ef444480',
      },
    });

    this.tvWidget.onChartReady(() => {
      console.log('[ChartCanvas] TradingView ready');
    });
  }

  public resize(): void {
    if (this.tvWidget && typeof this.tvWidget.resize === 'function') {
      this.tvWidget.resize();
    }
  }

  public destroy(): void {
    if (this.tvWidget && typeof this.tvWidget.remove === 'function') {
      this.tvWidget.remove();
    }
    super.destroy();
  }
}