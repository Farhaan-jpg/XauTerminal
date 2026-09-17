import { Panel } from './Panel';
import { LAYOUT_PRESETS, ALL_PANEL_IDS, PANEL_META } from '@/config';

interface GoldPrice {
  symbol: string;
  bid: number;
  ask: number;
  mid: number;
  spread: string;
  high24h: number;
  low24h: number;
  change24h: number;
  changePct24h: string;
  timestamp: number;
}

interface BiasData {
  score: number;
  label: string;
}

export class HeaderBar extends Panel {
  private priceEl!: HTMLElement;
  private changeEl!: HTMLElement;
  private spreadEl!: HTMLElement;
  private highLowEl!: HTMLElement;
  private sessionClocks: Record<string, HTMLElement> = {};
  private biasBadge!: HTMLElement;
  private soundToggle!: HTMLButtonElement;
  private lastPrice = 0;
  private soundEnabled = true;

  constructor() {
    super({ id: 'headerBar', title: '', className: 'header-bar', showCount: false, trackActivity: false });
    this.element.classList.remove('panel');
    this.element.classList.add('header-bar');
    (this as any).header.style.display = 'none';
    (this as any).resizeHandle!.style.display = 'none';
    this.render();
  }

  private render(): void {
    (this as any).header.style.display = 'none';
    (this as any).resizeHandle!.style.display = 'none';
    this.content.style.padding = '0';
    this.content.innerHTML = `
      <div class="header-left">
        <div class="price-section">
          <span class="price-label">XAUUSD</span>
          <span class="price-value" id="headerPrice">--</span>
          <span class="price-change" id="headerChange">--</span>
          <span class="price-spread" id="headerSpread">Spread: --</span>
        </div>
        <div class="high-low" id="headerHighLow">High: -- | Low: --</div>
      </div>
      <div class="header-center">
        <div class="sessions">
          <div class="session" id="sessionTokyo">
            <span class="session-name">TYO</span>
            <span class="session-time">--:--</span>
            <span class="session-status closed">CLOSED</span>
          </div>
          <div class="session" id="sessionLondon">
            <span class="session-name">LDN</span>
            <span class="session-time">--:--</span>
            <span class="session-status closed">CLOSED</span>
          </div>
          <div class="session" id="sessionNewYork">
            <span class="session-name">NYC</span>
            <span class="session-time">--:--</span>
            <span class="session-status closed">CLOSED</span>
          </div>
        </div>
      </div>
      <div class="header-right">
        <div class="bias-badge-container">
          <span class="bias-badge" id="biasBadge">NEUTRAL</span>
        </div>
        <div class="controls">
          <button class="icon-btn" id="soundToggle" title="Toggle Alerts">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
          </button>
          <div class="layout-menu-wrap" id="layoutMenuWrap">
            <button class="icon-btn" id="layoutToggle" title="Layout Presets">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </button>
            <div class="layout-menu" id="layoutMenu">
              <div class="menu-title">LAYOUT PRESETS</div>
              <div class="menu-presets" id="menuPresets"></div>
              <div class="menu-title">PANELS</div>
              <div class="menu-panels" id="menuPanels"></div>
              <button class="menu-reset" id="menuReset">RESET LAYOUT</button>
            </div>
          </div>
          <button class="icon-btn" id="refreshBtn" title="Emergency Refresh">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
      </div>
    `;

    this.priceEl = this.content.querySelector('#headerPrice')!;
    this.changeEl = this.content.querySelector('#headerChange')!;
    this.spreadEl = this.content.querySelector('#headerSpread')!;
    this.highLowEl = this.content.querySelector('#headerHighLow')!;
    this.sessionClocks.tokyo = this.content.querySelector('#sessionTokyo')!;
    this.sessionClocks.london = this.content.querySelector('#sessionLondon')!;
    this.sessionClocks.newyork = this.content.querySelector('#sessionNewYork')!;
    this.biasBadge = this.content.querySelector('#biasBadge')!;
    this.soundToggle = this.content.querySelector('#soundToggle')!;

    this.setupEventListeners();
    this.updateSessions();
    setInterval(() => this.updateSessions(), 1000);
  }

  private setupEventListeners(): void {
    this.soundToggle?.addEventListener('click', () => {
      this.soundEnabled = !this.soundEnabled;
      this.soundToggle!.classList.toggle('muted', !this.soundEnabled);
      this.soundToggle!.innerHTML = this.soundEnabled
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4"/></svg>';
    });

    this.content.querySelector('#refreshBtn')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('xauusd:refresh'));
    });

    this.setupLayoutMenu();
  }

  private setupLayoutMenu(): void {
    const wrap = this.content.querySelector('#layoutMenuWrap') as HTMLElement;
    const toggle = this.content.querySelector('#layoutToggle') as HTMLElement;
    const menu = this.content.querySelector('#layoutMenu') as HTMLElement;
    if (!wrap || !toggle || !menu) return;

    const presetsEl = menu.querySelector('#menuPresets') as HTMLElement;
    const panelsEl = menu.querySelector('#menuPanels') as HTMLElement;

    LAYOUT_PRESETS.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'menu-preset';
      btn.dataset.preset = p.id;
      btn.innerHTML = `<span class="menu-preset-name">${p.name}</span><span class="menu-preset-desc">${p.desc}</span>`;
      btn.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('xauusd:layout-preset', { detail: { id: p.id } }));
        this.closeMenu(menu);
      });
      presetsEl.appendChild(btn);
    });

    ALL_PANEL_IDS.forEach(id => {
      const meta = PANEL_META[id];
      const label = document.createElement('label');
      label.className = 'menu-panel';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.panel = id;
      cb.checked = true;
      const span = document.createElement('span');
      span.textContent = meta ? meta.name : id;
      label.appendChild(cb);
      label.appendChild(span);
      cb.addEventListener('change', () => {
        window.dispatchEvent(new CustomEvent('xauusd:toggle-panel', { detail: { id, visible: cb.checked } }));
      });
      panelsEl.appendChild(label);
    });

    this.content.querySelector('#menuReset')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('xauusd:reset-layout'));
      this.closeMenu(menu);
    });

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.classList.contains('open');
      this.closeMenu(menu);
      if (!open) {
        window.dispatchEvent(new CustomEvent('xauusd:menu-open'));
        menu.classList.add('open');
      }
    });

    menu.addEventListener('click', (e) => e.stopPropagation());

    document.addEventListener('click', () => {
      this.closeMenu(menu);
    });

    window.addEventListener('xauusd:panel-state', (e) => {
      const state = (e as CustomEvent<{ presetId: string; hidden: Record<string, boolean>; chartOnly?: boolean }>).detail;
      menu.querySelectorAll('.menu-preset').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-preset') === state.presetId);
      });
      menu.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(cb => {
        const id = cb.dataset.panel || '';
        cb.checked = !state.hidden[id];
      });
    });
  }

  private closeMenu(menu: HTMLElement): void {
    menu.classList.remove('open');
  }

  public updatePrice(data: GoldPrice): void {
    if (!this.priceEl) return;

    const price = data.mid.toFixed(2);
    this.priceEl.textContent = price;

    if (this.lastPrice > 0) {
      this.priceEl.classList.add(data.mid > this.lastPrice ? 'flash-up' : 'flash-down');
      setTimeout(() => this.priceEl!.classList.remove('flash-up', 'flash-down'), 300);
    }
    this.lastPrice = data.mid;

    if (this.changeEl) {
      const change = data.change24h >= 0 ? `+${data.change24h.toFixed(2)}` : data.change24h.toFixed(2);
      this.changeEl.textContent = `${change} (${data.changePct24h}%)`;
      this.changeEl.className = `price-change ${data.change24h >= 0 ? 'positive' : 'negative'}`;
    }

    if (this.spreadEl) {
      this.spreadEl.textContent = `Spread: ${data.spread}`;
    }

    if (this.highLowEl) {
      this.highLowEl.textContent = `High: ${data.high24h.toFixed(2)} | Low: ${data.low24h.toFixed(2)}`;
    }
  }

  public updateBias(bias: BiasData): void {
    if (!this.biasBadge) return;
    this.biasBadge.textContent = bias.label;
    this.badgeStyle(bias.score);
  }

  private badgeStyle(score: number): void {
    if (!this.biasBadge) return;
    this.biasBadge.className = 'bias-badge';
    if (score >= 60) this.biasBadge.classList.add('strong-bullish');
    else if (score >= 20) this.biasBadge.classList.add('moderate-bullish');
    else if (score > -20) this.biasBadge.classList.add('neutral');
    else if (score >= -60) this.biasBadge.classList.add('moderate-bearish');
    else this.biasBadge.classList.add('strong-bearish');
  }

  private updateSessions(): void {
    const now = new Date();
    const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60;

    const sessions = [
      { id: 'tokyo', open: 0, close: 9, name: 'TYO', tz: 'Asia/Tokyo' },
      { id: 'london', open: 8, close: 17, name: 'LDN', tz: 'Europe/London' },
      { id: 'newyork', open: 13, close: 22, name: 'NYC', tz: 'America/New_York' },
    ];

    sessions.forEach(s => {
      const el = this.sessionClocks[s.id];
      if (!el) return;

      const isOpen = s.open <= s.close
        ? utcHour >= s.open && utcHour < s.close
        : utcHour >= s.open || utcHour < s.close;

      const timeEl = el.querySelector('.session-time');
      const statusEl = el.querySelector('.session-status');

      if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: s.tz,
        });
      }
      if (statusEl) {
        statusEl.textContent = isOpen ? 'OPEN' : 'CLOSED';
        statusEl.className = `session-status ${isOpen ? 'open' : 'closed'}`;
      }
      el.classList.toggle('active', isOpen);
    });
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public playAlert(): void {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => this.playTone(ctx)).catch(() => {});
      } else {
        this.playTone(ctx);
      }
    } catch (e) {
      console.warn('Audio play failed:', e);
    }
  }

  private audioCtx: AudioContext | null = null;
  private audioUnlockBound = false;

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.unlockAudio();
    }
    return this.audioCtx;
  }

  private unlockAudio(): void {
    if (this.audioUnlockBound || !this.audioCtx) return;
    this.audioUnlockBound = true;
    const unlock = () => {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
    };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
  }

  private playTone(ctx: AudioContext): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }
}