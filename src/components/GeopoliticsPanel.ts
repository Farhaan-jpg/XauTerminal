import { Panel } from './Panel';

export class GeopoliticsPanel extends Panel {
  private threatGauge!: HTMLElement;
  private defconEl!: HTMLElement;
  private hotspotsContainer!: HTMLElement;

  constructor() {
    super({ id: 'geopolitics', title: 'GEOPOLITICS', className: 'geopolitics', showCount: false, trackActivity: false });
    this.render();
  }

  private render(): void {
    this.content.innerHTML = `
      <div class="geo-header">
        <div class="threat-gauge-container">
          <svg class="threat-gauge" id="threatGauge" viewBox="0 0 200 100" width="200" height="100">
            <defs>
              <linearGradient id="threatGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#44ff88"/>
                <stop offset="25%" stop-color="#ffaa00"/>
                <stop offset="50%" stop-color="#ff8800"/>
                <stop offset="75%" stop-color="#ff4444"/>
                <stop offset="100%" stop-color="#ff0000"/>
              </linearGradient>
            </defs>
            <path class="gauge-track" d="M 20 80 A 60 60 0 0 1 180 80" stroke="#1e222d" stroke-width="12" fill="none"/>
            <path class="gauge-fill" id="gaugeFill" d="M 20 80 A 60 60 0 0 1 180 80" stroke="url(#threatGradient)" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="377" stroke-dashoffset="377"/>
            <text class="gauge-value" id="gaugeValue" x="100" y="55" text-anchor="middle" font-size="24" font-weight="bold" fill="#e8e8e8">0</text>
            <text class="gauge-label" x="100" y="75" text-anchor="middle" font-size="10" fill="#888">THREAT LEVEL</text>
          </svg>
        </div>
        <div class="defcon-display">
          <span class="defcon-label">DEFCON</span>
          <span class="defcon-level" id="defconLevel">5</span>
          <span class="defcon-name" id="defconName">FADE OUT</span>
        </div>
      </div>
      <div class="hotspots-list" id="hotspotsList"></div>
      <div class="choke-points" id="chokePoints"></div>
    `;

    this.threatGauge = this.content.querySelector('#gaugeFill')!;
    this.defconEl = this.content.querySelector('#defconLevel')!;
    this.hotspotsContainer = this.content.querySelector('#hotspotsList')!;
  }

  public update(data: any): void {
    this.lastData = data;
    const threatLevel = data.threatLevel || 0;
    const defcon = data.defcon || 5;
    const hotspots = data.hotspots || [];
    const chokePoints = data.chokePoints || [];

    this.updateGauge(threatLevel);
    this.updateDefcon(defcon);
    this.renderHotspots(hotspots);
    this.renderChokePoints(chokePoints);
  }

  private updateGauge(level: number): void {
    if (!this.threatGauge) return;
    const circumference = 377;
    const offset = circumference - (level / 100) * circumference;
    this.threatGauge.style.strokeDashoffset = offset.toString();
    
    const valueEl = this.content.querySelector('#gaugeValue');
    if (valueEl) valueEl.textContent = level.toString();
  }

  private updateDefcon(level: number): void {
    const defconNames = ['', 'COCKED PISTOL', 'FAST PACE', 'ROUND HOUSE', 'DOUBLE TAKE', 'FADE OUT'];
    const defconColors = ['', '#ff0000', '#ff4444', '#ff8800', '#ffaa00', '#44ff88'];
    const color = defconColors[level] ?? '#888';
    const name = defconNames[level] ?? 'UNKNOWN';
    
    if (this.defconEl) {
      this.defconEl.textContent = level.toString();
      (this.defconEl as HTMLElement).style.color = color;
    }
    const nameEl = this.content.querySelector('#defconName') as HTMLElement;
    if (nameEl) {
      nameEl.textContent = name;
      nameEl.style.color = color;
    }
  }

  private renderHotspots(hotspots: any[]): void {
    if (!this.hotspotsContainer) return;

    this.hotspotsContainer.innerHTML = hotspots.map(h => `
      <div class="hotspot-item ${h.status?.toLowerCase() || 'watch'}">
        <div class="hotspot-info">
          <span class="hotspot-name">${h.name}</span>
          <span class="hotspot-status">${h.status || 'WATCH'}</span>
        </div>
        <div class="hotspot-metrics">
          <span class="hotspot-intensity">Intensity: ${h.intensity || 0}</span>
          <span class="hotspot-events">${h.eventCount || 0} events</span>
        </div>
        <div class="hotspot-bar">
          <div class="hotspot-fill" style="width: ${h.intensity || 0}%"></div>
        </div>
      </div>
    `).join('');
  }

  private renderChokePoints(chokePoints: any[]): void {
    const container = this.content.querySelector('#chokePoints');
    if (!container) return;

    container.innerHTML = `
      <div class="choke-header">STRATEGIC CHOKE POINTS</div>
      <div class="choke-grid">
        ${chokePoints.map(cp => `
          <div class="choke-item ${cp.critical ? 'critical' : ''}">
            <span class="choke-name">${cp.name}</span>
            <span class="choke-status">${cp.critical ? 'CRITICAL' : 'MONITORED'}</span>
          </div>
        `).join('')}
      </div>
    `;
  }
}