type ConnectionState = 'connecting' | 'open' | 'closed' | 'error';

interface StreamConfig {
  url: string;
  protocols?: string[];
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
}

interface MessageHandler {
  (data: any, ws: WebSocket): void;
}

export class StreamManager {
  private ws: WebSocket | null = null;
  private config: StreamConfig;
  private state: ConnectionState = 'closed';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private stateChangeHandlers: ((state: ConnectionState) => void)[] = [];
  private latencyHistory: number[] = [];
  private lastPingTime = 0;
  private visibilityBound = false;

  constructor(config: Partial<StreamConfig> = {}) {
    this.config = {
      url: config.url || '/ws',
      protocols: config.protocols,
      reconnectInterval: config.reconnectInterval || 2000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeatInterval: config.heartbeatInterval || 30000,
    };
  }

  connect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        resolve();
        return;
      }

      this.setState('connecting');
      this.bindVisibilityReconnect();

      try {
        this.ws = new WebSocket(this.config.url, this.config.protocols);
        this.setupEventHandlers(resolve);
      } catch (error) {
        this.setState('error');
        this.scheduleReconnect();
      }
    });
  }

  private bindVisibilityReconnect(): void {
    if (this.visibilityBound) return;
    this.visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      if (this.state !== 'open' && !this.ws || (this.ws && this.ws.readyState !== WebSocket.OPEN)) {
        console.log('[StreamManager] Tab visible — reconnecting WebSocket');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.connect().catch(() => this.scheduleReconnect());
      }
    });
  }

  private setupEventHandlers(resolve: () => void): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('[StreamManager] Connected');
      this.reconnectAttempts = 0;
      this.setState('open');
      this.startHeartbeat();
      resolve();
    };

    this.ws.onclose = (event) => {
      console.log('[StreamManager] Disconnected:', event.code, event.reason);
      this.stopHeartbeat();
      this.setState('closed');
      if (event.code !== 1000) this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('[StreamManager] Error:', error);
      this.setState('error');
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  private handleMessage(data: string | ArrayBuffer | Blob): void {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'pong') {
        const latency = Date.now() - this.lastPingTime;
        this.latencyHistory.push(latency);
        if (this.latencyHistory.length > 100) this.latencyHistory.shift();
        return;
      }

      const handlers = this.messageHandlers.get(message.channel) || [];
      handlers.forEach(handler => handler(message.data, this.ws!));
    } catch (e) {
      console.warn('[StreamManager] Failed to parse message:', e);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.lastPingTime = Date.now();
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('[StreamManager] Max reconnect attempts reached, will retry on tab focus');
      return;
    }

    const maxDelay = 30000;
    const rawDelay = this.config.reconnectInterval * Math.pow(1.5, this.reconnectAttempts);
    const delay = Math.min(rawDelay, maxDelay);
    this.reconnectAttempts++;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    console.log(`[StreamManager] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {});
    }, delay);
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.stateChangeHandlers.forEach(h => h(state));
  }

  onStateChange(handler: (state: ConnectionState) => void): () => void {
    this.stateChangeHandlers.push(handler);
    return () => {
      const idx = this.stateChangeHandlers.indexOf(handler);
      if (idx >= 0) this.stateChangeHandlers.splice(idx, 1);
    };
  }

  onMessage(channel: string, handler: MessageHandler): () => void {
    const handlers = this.messageHandlers.get(channel) || [];
    handlers.push(handler);
    this.messageHandlers.set(channel, handlers);
    return () => {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    };
  }

  send(message: any): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  subscribe(channels: string[]): void {
    this.send({ type: 'subscribe', channels });
  }

  getState(): ConnectionState {
    return this.state;
  }

  getLatency(): { current: number; avg: number; min: number; max: number } {
    if (this.latencyHistory.length === 0) return { current: 0, avg: 0, min: 0, max: 0 };
    const current = this.latencyHistory[this.latencyHistory.length - 1] ?? 0;
    const avg = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
    const min = Math.min(...this.latencyHistory);
    const max = Math.max(...this.latencyHistory);
    return { current, avg, min, max };
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.setState('closed');
  }

  destroy(): void {
    this.disconnect();
    this.messageHandlers.clear();
    this.stateChangeHandlers.length = 0;
  }
}

export const streamManager = new StreamManager();