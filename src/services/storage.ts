export function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('[Storage] Failed to save:', e);
  }
}

export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored) as T;
  } catch (e) {
    console.warn('[Storage] Failed to load:', e);
  }
  return defaultValue;
}

export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('[Storage] Failed to remove:', e);
  }
}

export function clearStorage(prefix?: string): void {
  try {
    if (prefix) {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
      keys.forEach(k => localStorage.removeItem(k));
    } else {
      localStorage.clear();
    }
  } catch (e) {
    console.warn('[Storage] Failed to clear:', e);
  }
}

export interface PanelLayoutState {
  panels: Record<string, { enabled: boolean; order: number; span: number }>;
  timestamp: number;
}

export function savePanelLayout(state: PanelLayoutState): void {
  saveToStorage('xauusd-panel-layout', state);
}

export function loadPanelLayout(): PanelLayoutState | null {
  return loadFromStorage<PanelLayoutState | null>('xauusd-panel-layout', null);
}

export interface UserSettings {
  soundEnabled: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
  theme: 'dark' | 'light';
  compactMode: boolean;
  chartInterval: string;
  biasThreshold: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  soundEnabled: true,
  autoRefresh: true,
  refreshInterval: 15000,
  theme: 'dark',
  compactMode: false,
  chartInterval: '5m',
  biasThreshold: 20,
};

export function saveSettings(settings: Partial<UserSettings>): void {
  const current = loadSettings();
  saveToStorage('xauusd-settings', { ...current, ...settings });
}

export function loadSettings(): UserSettings {
  return loadFromStorage<UserSettings>('xauusd-settings', DEFAULT_SETTINGS);
}