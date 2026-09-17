import { Panel } from './Panel';

export class StatusFooter extends Panel {
  private wsStatusEl: HTMLElement | null = null;
  private latencyEl: HTMLElement | null = null;
  private apiStatusEls: Record<string, HTMLElement> = {};
  private lastUpdate = Date.now();

  constructor() {
    super({ id: 'statusFooter', title: 'SYSTEM STATUS', className: 'status-footer', showCount: false, trackActivity: false });
    this.render();
  }

  private render(): void {
    this.header.style.display = 'none';
    (this as any).resizeHandle!.style.display = 'none';
    this.content.style.padding = '4px 8px';
    this.content.innerHTML = `
      <div class="status-grid">
        <div class="status-item">
          <span class="status-label">WS</span>
          <span class="status-value" id="wsStatus">●</span>
        </div>
        <div class="status-item">
          <span class="status-label">LATENCY</span>
          <span class="status-value" id="latency">--ms</span>
        </div>
        <div class="status-item">
          <span class="status-label">GOLD API</span>
          <span class="status-value api-status" id="apiGold" data-api="gold">●</span>
        </div>
        <div class="status-item">
          <span class="status-label">NEWS</span>
          <span class="status-value api-status" id="apiNews" data-api="news">●</span>
        </div>
        <div class="status-item">
          <span class="status-label">MACRO</span>
          <span class="status-value api-status" id="apiMacro" data-api="macro">●</span>
        </div>
        <div class="status-item">
          <span class="status-label">GEO</span>
          <span class="status-value api-status" id="apiGeo" data-api="geo">●</span>
        </div>
        <div class="status-item">
          <span class="status-label">INTERMARKET</span>
          <span class="status-value api-status" id="apiIntermarket" data-api="intermarket">●</span>
        </div>
        <div class="status-item">
          <span class="status-label">ORDERBOOK</span>
          <span class="status-value api-status" id="apiOrderbook" data-api="orderbook">●</span>
        </div>
        <div class="status-item">
          <span class="status-label">UPTIME</span>
          <span class="status-value" id="uptime">--</span>
        </div>
      </div>
    `;

    this.wsStatusEl = this.content.querySelector('#wsStatus');
    this.latencyEl = this.content.querySelector('#latency');
    this.apiStatusEls = {
      gold: this.content.querySelector('#apiGold')!,
      news: this.content.querySelector('#apiNews')!,
      macro: this.content.querySelector('#apiMacro')!,
      geo: this.content.querySelector('#apiGeo')!,
      intermarket: this.content.querySelector('#apiIntermarket')!,
      orderbook: this.content.querySelector('#apiOrderbook')!,
    };
  }

  public updateWebSocket(connected: boolean, latency: number): void {
    if (this.wsStatusEl) {
      this.wsStatusEl.textContent = connected ? '●' : '○';
      this.wsStatusEl.className = `status-value ${connected ? 'connected' : 'disconnected'}`;
    }
    if (this.latencyEl) {
      this.latencyEl.textContent = `${latency}ms`;
      this.latencyEl.className = `status-value ${latency < 100 ? 'good' : latency < 300 ? 'warn' : 'bad'}`;
    }
  }

  public updateApiStatus(api: string, status: 'ok' | 'error' | 'stale'): void {
    const el = this.apiStatusEls[api];
    if (!el) return;
    
    el.textContent = status === 'ok' ? '●' : status === 'stale' ? '◐' : '○';
    el.className = `status-value api-status ${status}`;
  }

  public updateUptime(): void {
    const uptimeEl = this.content.querySelector('#uptime');
    if (uptimeEl) {
      const diff = Date.now() - this.lastUpdate;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      uptimeEl.textContent = `${h}h ${m}m`;
    }
  }
}