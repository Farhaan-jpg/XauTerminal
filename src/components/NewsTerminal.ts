import { Panel } from './Panel';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  link: string;
  pubDate: number;
  source: string;
  category: string;
  tier: number;
  impact: number;
  label: string;
}

export class NewsTerminal extends Panel {
  private items: NewsItem[] = [];
  private filterCategory = 'all';
  private filterImpact = -2;
  private autoScroll = true;

  constructor() {
    super({ id: 'newsTerminal', title: 'NEWS WIRE', className: 'news-terminal', showCount: true, trackActivity: true });
    this.render();
  }

  private render(): void {
    this.content.innerHTML = `
      <div class="news-toolbar">
        <div class="news-filters">
          <select class="filter-select" id="categoryFilter">
            <option value="all">ALL</option>
            <option value="WAR_CRISIS">WAR/CRISIS</option>
            <option value="INFLATION">INFLATION</option>
            <option value="FED_POLICY">FED POLICY</option>
            <option value="COMMODITY_DEMAND">COMMODITY</option>
          </select>
          <select class="filter-select" id="impactFilter">
            <option value="-2">ALL IMPACTS</option>
            <option value="3">CRITICAL BULLISH (+3)</option>
            <option value="1">BULLISH (+1)</option>
            <option value="0">NEUTRAL (0)</option>
            <option value="-1">BEARISH (-1)</option>
          </select>
        </div>
        <div class="news-controls">
          <button class="icon-btn" id="autoScrollBtn" title="Auto Scroll">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button class="icon-btn" id="clearBtn" title="Clear Read">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
      <div class="news-list" id="newsList"></div>
    `;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.content.querySelector('#categoryFilter')?.addEventListener('change', (e) => {
      this.filterCategory = (e.target as HTMLSelectElement).value;
      this.renderItems();
    });

    this.content.querySelector('#impactFilter')?.addEventListener('change', (e) => {
      this.filterImpact = parseInt((e.target as HTMLSelectElement).value, 10);
      this.renderItems();
    });

    this.content.querySelector('#autoScrollBtn')?.addEventListener('click', (e) => {
      this.autoScroll = !this.autoScroll;
      (e.currentTarget as HTMLElement).classList.toggle('active', this.autoScroll);
    });

    this.content.querySelector('#clearBtn')?.addEventListener('click', () => {
      this.items = this.items.filter(i => i.impact >= 1);
      this.renderItems();
      this.setCount(this.items.length);
    });
  }

  public update(data: { items: NewsItem[]; errors: string[] }): void {
    const newItems = data.items.filter(newItem => 
      !this.items.some(existing => existing.id === newItem.id)
    );

    if (newItems.length > 0) {
      this.items = [...newItems, ...this.items].slice(0, 200);
      this.setNewBadge(newItems.length, true);
      
      if (newItems.some(i => i.impact >= 3)) {
        window.dispatchEvent(new CustomEvent('xauusd:critical-news', { detail: newItems }));
      }
    }

    if (data.errors.length > 0) {
      this.setErrorState(true, data.errors.join('; '));
    } else {
      this.setErrorState(false);
    }

    this.renderItems();
    this.setCount(this.items.length);
  }

  private renderItems(): void {
    const container = this.content.querySelector('#newsList');
    if (!container) return;

    const filtered = this.items.filter(item => {
      const catMatch = this.filterCategory === 'all' || item.category === this.filterCategory;
      const impactMatch = item.impact >= this.filterImpact;
      return catMatch && impactMatch;
    });

    container.innerHTML = filtered.map(item => `
      <div class="news-item ${item.impact >= 3 ? 'critical' : ''} ${item.impact === 1 ? 'bullish' : ''} ${item.impact === -1 ? 'bearish' : ''}" data-id="${item.id}">
        <div class="news-meta">
          <span class="news-source tier-${item.tier}">${item.source}</span>
          <span class="news-category">${item.category}</span>
          <span class="news-impact ${this.getImpactClass(item.impact)}">${item.label}</span>
          <span class="news-time">${this.formatTime(item.pubDate)}</span>
        </div>
        <a class="news-title" href="${item.link}" target="_blank" rel="noopener">${this.escapeHtml(item.title)}</a>
        ${item.summary ? `<div class="news-summary">${this.escapeHtml(item.summary.slice(0, 200))}</div>` : ''}
      </div>
    `).join('') || '<div class="news-empty">No news items match current filters</div>';
  }

  private getImpactClass(impact: number): string {
    if (impact >= 3) return 'impact-critical';
    if (impact === 1) return 'impact-bullish';
    if (impact === -1) return 'impact-bearish';
    return 'impact-neutral';
  }

  private formatTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}