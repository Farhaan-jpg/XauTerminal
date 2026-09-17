import { PANEL_LAYOUT } from '@/config';

export interface PanelOptions {
  id: string;
  title: string;
  showCount?: boolean;
  className?: string;
  trackActivity?: boolean;
  infoTooltip?: string;
  controls?: boolean;
}

export const PANEL_ACTION_EVENT = 'xauusd:panel-action';

const PANEL_HEIGHTS_KEY = 'xauusd-panel-heights';

function loadPanelHeights(): Record<string, number> {
  try {
    const stored = localStorage.getItem(PANEL_HEIGHTS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export interface PanelActionDetail {
  id: string;
  action: 'maximize' | 'restore' | 'collapse' | 'expand' | 'close' | 'open';
}

export function dispatchPanelAction(id: string, action: PanelActionDetail['action']): void {
  window.dispatchEvent(new CustomEvent<PanelActionDetail>(PANEL_ACTION_EVENT, { detail: { id, action } }));
}

export class Panel {
  protected element: HTMLElement;
  protected content: HTMLElement;
  protected header: HTMLElement;
  protected countEl: HTMLElement | null = null;
  protected newBadgeEl: HTMLElement | null = null;
  protected panelId: string;
  public lastData: any = null;

  private tooltipCloseHandler: (() => void) | null = null;
  private resizeHandle: HTMLElement | null = null;
  private isResizing = false;
  private startY = 0;
  private startHeight = 0;
  private onTouchMove: ((e: TouchEvent) => void) | null = null;
  private onTouchEnd: (() => void) | null = null;
  private maximizeBtn: HTMLElement | null = null;
  private minimizeBtn: HTMLElement | null = null;
  private closeBtn: HTMLElement | null = null;

  constructor(options: PanelOptions) {
    this.panelId = options.id;
    this.element = document.createElement('div');
    this.element.className = `panel ${options.className || ''}`;
    this.element.dataset.panel = options.id;

    this.header = document.createElement('div');
    this.header.className = 'panel-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'panel-header-left';

    const title = document.createElement('span');
    title.className = 'panel-title';
    title.textContent = options.title;
    headerLeft.appendChild(title);

    if (options.infoTooltip) {
      const infoBtn = document.createElement('button');
      infoBtn.className = 'panel-info-btn';
      infoBtn.innerHTML = '?';
      infoBtn.setAttribute('aria-label', 'Show methodology info');

      const tooltip = document.createElement('div');
      tooltip.className = 'panel-info-tooltip';
      tooltip.innerHTML = options.infoTooltip;

      infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        tooltip.classList.toggle('visible');
      });

      this.tooltipCloseHandler = () => tooltip.classList.remove('visible');
      document.addEventListener('click', this.tooltipCloseHandler);

      const infoWrapper = document.createElement('div');
      infoWrapper.className = 'panel-info-wrapper';
      infoWrapper.appendChild(infoBtn);
      infoWrapper.appendChild(tooltip);
      headerLeft.appendChild(infoWrapper);
    }

    if (options.trackActivity !== false) {
      this.newBadgeEl = document.createElement('span');
      this.newBadgeEl.className = 'panel-new-badge';
      this.newBadgeEl.style.display = 'none';
      headerLeft.appendChild(this.newBadgeEl);
    }

    this.header.appendChild(headerLeft);

    const headerRight = document.createElement('div');
    headerRight.className = 'panel-header-right';

    if (options.showCount) {
      this.countEl = document.createElement('span');
      this.countEl.className = 'panel-count';
      this.countEl.textContent = '0';
      headerRight.appendChild(this.countEl);
    }

    if (options.controls !== false) {
      const controls = document.createElement('div');
      controls.className = 'panel-controls';

      this.minimizeBtn = document.createElement('button');
      this.minimizeBtn.className = 'panel-control-btn minimize';
      this.minimizeBtn.title = 'Minimize (collapse)';
      this.minimizeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
      this.minimizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dispatchPanelAction(this.panelId, this.isCollapsed() ? 'expand' : 'collapse');
      });

      this.maximizeBtn = document.createElement('button');
      this.maximizeBtn.className = 'panel-control-btn maximize';
      this.maximizeBtn.title = 'Maximize / Restore';
      this.maximizeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/></svg>';
      this.maximizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dispatchPanelAction(this.panelId, this.isMaximized() ? 'restore' : 'maximize');
      });

      this.closeBtn = document.createElement('button');
      this.closeBtn.className = 'panel-control-btn close';
      this.closeBtn.title = 'Close (hide)';
      this.closeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      this.closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dispatchPanelAction(this.panelId, 'close');
      });

      controls.appendChild(this.minimizeBtn);
      controls.appendChild(this.maximizeBtn);
      controls.appendChild(this.closeBtn);
      headerRight.appendChild(controls);
    }

    this.header.appendChild(headerRight);

    this.content = document.createElement('div');
    this.content.className = 'panel-content';
    this.content.id = `${options.id}Content`;

    this.element.appendChild(this.header);
    this.element.appendChild(this.content);

    this.resizeHandle = document.createElement('div');
    this.resizeHandle.className = 'panel-resize-handle';
    this.resizeHandle.title = 'Drag to resize (double-click to reset)';
    this.resizeHandle.draggable = false;
    this.element.appendChild(this.resizeHandle);
    this.setupResizeHandlers();

    const savedHeights = loadPanelHeights();
    const savedHeight = savedHeights[this.panelId];
    if (savedHeight && savedHeight >= PANEL_LAYOUT.minHeight) {
      this.element.style.height = `${savedHeight}px`;
    }

    this.showLoading();
  }

  private setupResizeHandlers(): void {
    if (!this.resizeHandle) return;

    const applyHeight = (height: number) => {
      const clamped = Math.max(PANEL_LAYOUT.minHeight, height);
      this.element.style.height = `${clamped}px`;
    };

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.isResizing = true;
      this.startY = e.clientY;
      this.startHeight = this.element.getBoundingClientRect().height;
      this.element.classList.add('resizing');
      this.element.draggable = false;
      this.resizeHandle?.classList.add('active');
      this.element.dataset.resizing = 'true';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isResizing) return;
      applyHeight(this.startHeight + (e.clientY - this.startY));
    };

    const onMouseUp = () => {
      if (!this.isResizing) return;
      this.finishResize();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    this.resizeHandle.addEventListener('mousedown', onMouseDown);

    this.element.addEventListener('dragstart', (e) => {
      const target = e.target as HTMLElement;
      if (this.isResizing || target === this.resizeHandle || target.closest('.panel-resize-handle')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return false;
      }
    }, true);

    this.resizeHandle.addEventListener('dblclick', () => {
      this.resetHeight();
    });

    this.resizeHandle.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const touch = e.touches[0];
      if (!touch) return;
      this.isResizing = true;
      this.startY = touch.clientY;
      this.startHeight = this.element.getBoundingClientRect().height;
      this.element.classList.add('resizing');
      this.element.draggable = false;
      this.element.dataset.resizing = 'true';
      this.resizeHandle?.classList.add('active');
    }, { passive: false });

    this.onTouchMove = (e: TouchEvent) => {
      if (!this.isResizing) return;
      const touch = e.touches[0];
      if (!touch) return;
      applyHeight(this.startHeight + (touch.clientY - this.startY));
    };

    this.onTouchEnd = () => {
      if (!this.isResizing) return;
      this.finishResize();
    };

    document.addEventListener('touchmove', this.onTouchMove, { passive: false });
    document.addEventListener('touchend', this.onTouchEnd);
    document.addEventListener('mouseup', this.onDocMouseUp);
  }

  private finishResize(): void {
    this.isResizing = false;
    this.element.classList.remove('resizing');
    this.element.draggable = true;
    this.resizeHandle?.classList.remove('active');
    delete this.element.dataset.resizing;
    const heights = loadPanelHeights();
    heights[this.panelId] = parseFloat(this.element.style.height) || PANEL_LAYOUT.defaultHeight;
    try {
      localStorage.setItem(PANEL_HEIGHTS_KEY, JSON.stringify(heights));
    } catch { /* ignore */ }
    window.dispatchEvent(new Event('xauusd:panel-resized'));
  }

  private onDocMouseUp = (): void => {
    if (this.isResizing) this.finishResize();
  };

  public getElement(): HTMLElement {
    return this.element;
  }

  public isCollapsed(): boolean {
    return this.element.classList.contains('collapsed');
  }

  public isMaximized(): boolean {
    return this.element.classList.contains('maximized');
  }

  public collapse(): void {
    this.element.classList.add('collapsed');
    this.minimizeBtn?.classList.add('active');
    if (this.resizeHandle) this.resizeHandle.style.display = 'none';
  }

  public expand(): void {
    this.element.classList.remove('collapsed');
    this.minimizeBtn?.classList.remove('active');
    if (this.resizeHandle) this.resizeHandle.style.display = '';
  }

  public toggleCollapse(): void {
    if (this.isCollapsed()) this.expand();
    else this.collapse();
  }

  public maximize(): void {
    this.element.classList.remove('collapsed');
    this.minimizeBtn?.classList.remove('active');
    this.element.classList.add('maximized');
    this.maximizeBtn?.classList.add('active');
    this.maximizeBtn?.setAttribute('data-restore', 'true');
  }

  public restore(): void {
    this.element.classList.remove('maximized');
    this.maximizeBtn?.classList.remove('active');
    this.maximizeBtn?.removeAttribute('data-restore');
  }

  public close(): void {
    this.element.classList.add('hidden');
    this.closeBtn?.classList.add('active');
  }

  public open(): void {
    this.element.classList.remove('hidden');
    this.closeBtn?.classList.remove('active');
  }

  public showLoading(message = 'Loading'): void {
    this.content.innerHTML = `
      <div class="panel-loading">
        <div class="panel-loading-radar">
          <div class="panel-radar-sweep"></div>
          <div class="panel-radar-dot"></div>
        </div>
        <div class="panel-loading-text">${message}</div>
      </div>
    `;
  }

  public showError(message = 'Failed to load data'): void {
    this.content.innerHTML = `<div class="error-message">${message}</div>`;
  }

  public setCount(count: number): void {
    if (this.countEl) {
      this.countEl.textContent = count.toString();
    }
  }

  public setErrorState(hasError: boolean, tooltip?: string): void {
    this.header.classList.toggle('panel-header-error', hasError);
    if (tooltip) {
      this.header.title = tooltip;
    } else {
      this.header.removeAttribute('title');
    }
  }

  public setContent(html: string): void {
    this.content.innerHTML = html;
  }

  public show(): void {
    this.element.classList.remove('hidden');
  }

  public hide(): void {
    this.element.classList.add('hidden');
  }

  public toggle(visible: boolean): void {
    if (visible) this.show();
    else this.hide();
  }

  public setNewBadge(count: number, pulse = false): void {
    if (!this.newBadgeEl) return;

    if (count <= 0) {
      this.newBadgeEl.style.display = 'none';
      this.newBadgeEl.classList.remove('pulse');
      this.element.classList.remove('has-new');
      return;
    }

    this.newBadgeEl.textContent = count > 99 ? '99+' : `${count} new`;
    this.newBadgeEl.style.display = 'inline-flex';
    this.element.classList.add('has-new');

    if (pulse) {
      this.newBadgeEl.classList.add('pulse');
    } else {
      this.newBadgeEl.classList.remove('pulse');
    }
  }

  public clearNewBadge(): void {
    this.setNewBadge(0);
  }

  public getId(): string {
    return this.panelId;
  }

  public resetHeight(): void {
    this.element.style.removeProperty('height');
    this.element.classList.remove('resized');
    const heights = loadPanelHeights();
    delete heights[this.panelId];
    try {
      localStorage.setItem(PANEL_HEIGHTS_KEY, JSON.stringify(heights));
    } catch { /* ignore */ }
    const spans = this.loadSpans();
    delete spans[this.panelId];
    try {
      localStorage.setItem('xauusd-panel-spans', JSON.stringify(spans));
    } catch { /* ignore */ }
  }

  private loadSpans(): Record<string, number> {
    try {
      const stored = localStorage.getItem('xauusd-panel-spans');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  public destroy(): void {
    if (this.tooltipCloseHandler) {
      document.removeEventListener('click', this.tooltipCloseHandler);
      this.tooltipCloseHandler = null;
    }
    if (this.onTouchMove) {
      document.removeEventListener('touchmove', this.onTouchMove);
      this.onTouchMove = null;
    }
    if (this.onTouchEnd) {
      document.removeEventListener('touchend', this.onTouchEnd);
      this.onTouchEnd = null;
    }
  }
}