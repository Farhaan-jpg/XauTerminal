import { Panel } from './Panel';

interface MacroEvent {
  id: string;
  name: string;
  country: string;
  impact: string;
  date: string;
  actual: string | null;
  forecast: string;
  previous: string;
  deviation: string;
}

export class EconomicPanel extends Panel {
  private nextEventEl: HTMLElement | null = null;
  private countdownEl: HTMLElement | null = null;
  private eventsContainer: HTMLElement | null = null;

  constructor() {
    super({ id: 'economicCalendar', title: 'ECONOMIC CAL', className: 'economic-panel', showCount: false, trackActivity: false });
    this.render();
  }

  private render(): void {
    this.content.innerHTML = `
      <div class="eco-next-event" id="nextEvent">
        <div class="next-event-header">NEXT HIGH-IMPACT EVENT</div>
        <div class="next-event-name" id="nextEventName">--</div>
        <div class="next-event-countdown" id="countdown">--:--:--</div>
        <div class="next-event-detail" id="nextEventDetail"></div>
      </div>
      <div class="eco-events-list" id="eventsList"></div>
    `;

    this.nextEventEl = this.content.querySelector('#nextEventName');
    this.countdownEl = this.content.querySelector('#countdown');
    this.eventsContainer = this.content.querySelector('#eventsList');
  }

  public update(data: { events: MacroEvent[]; nextEvent: any; timestamp: number }): void {
    this.renderNextEvent(data.nextEvent);
    this.renderEvents(data.events);
    this.startCountdown(data.nextEvent);
  }

  private renderNextEvent(event: any): void {
    if (!event || !this.nextEventEl) return;

    this.nextEventEl.textContent = event.name;
    
    const detailEl = this.content.querySelector('#nextEventDetail');
    if (detailEl) {
      detailEl.innerHTML = `
        <span class="event-impact ${event.impact?.toLowerCase()}">${event.impact || 'HIGH'}</span>
        <span class="event-country">${event.country || 'US'}</span>
        <span class="event-forecast">Forecast: ${event.forecast || 'N/A'}</span>
        <span class="event-previous">Previous: ${event.previous || 'N/A'}</span>
      `;
    }
  }

  private startCountdown(event: any): void {
    if (!event?.date || !this.countdownEl) return;

    const targetTime = new Date(event.date).getTime();
    const update = () => {
      const diff = targetTime - Date.now();
      if (diff <= 0) {
        this.countdownEl!.textContent = 'RELEASED';
        this.countdownEl!.classList.add('released');
        return;
      }

      const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      this.countdownEl!.textContent = `${h}:${m}:${s}`;
    };

    update();
    const interval = setInterval(update, 1000);
    this.countdownEl.dataset.interval = interval.toString();
  }

  private renderEvents(events: MacroEvent[]): void {
    if (!this.eventsContainer) return;

    this.eventsContainer.innerHTML = events.map(e => `
      <div class="eco-event ${e.impact?.toLowerCase()}">
        <div class="event-header">
          <span class="event-name">${e.name}</span>
          <span class="event-date">${this.formatDate(e.date)}</span>
        </div>
        <div class="event-values">
          <div class="value-item">
            <span class="value-label">Actual</span>
            <span class="value-actual ${this.getDeviationClass(e.deviation)}">${e.actual || '—'}</span>
          </div>
          <div class="value-item">
            <span class="value-label">Forecast</span>
            <span class="value-forecast">${e.forecast || '—'}</span>
          </div>
          <div class="value-item">
            <span class="value-label">Previous</span>
            <span class="value-previous">${e.previous || '—'}</span>
          </div>
        </div>
        ${e.actual && e.deviation !== 'N/A' ? `
          <div class="event-deviation ${this.getDeviationClass(e.deviation)}">
            Deviation: ${e.deviation}% ${this.getInterpretation(e)}
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  private getDeviationClass(deviation: string): string {
    const val = parseFloat(deviation);
    if (isNaN(val)) return '';
    return val > 0 ? 'positive' : val < 0 ? 'negative' : 'neutral';
  }

  private getInterpretation(event: MacroEvent): string {
    const name = event.name.toLowerCase();
    const dev = parseFloat(event.deviation);
    
    if (name.includes('cpi') || name.includes('pce') || name.includes('inflation')) {
      return dev > 0 ? '→ Inflation higher → Bearish Gold' : '→ Inflation lower → Bullish Gold';
    }
    if (name.includes('nfp') || name.includes('payroll') || name.includes('unemployment')) {
      return dev > 0 ? '→ Jobs stronger → Bearish Gold' : '→ Jobs weaker → Bullish Gold';
    }
    if (name.includes('fomc') || name.includes('rate')) {
      return dev > 0 ? '→ Hawkish → Bearish Gold' : '→ Dovish → Bullish Gold';
    }
    if (name.includes('gdp')) {
      return dev > 0 ? '→ Growth stronger → Bearish Gold' : '→ Growth weaker → Bullish Gold';
    }
    return '→ Mixed implications';
  }
}