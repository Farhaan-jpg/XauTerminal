export interface PanelConfig {
  id: string;
  title: string;
  enabled: boolean;
  order: number;
  span?: number;
  width?: number;
  height?: number;
}

export const DEFAULT_PANELS: Record<string, PanelConfig> = {
  biasEngine: { id: 'biasEngine', title: 'BIAS ENGINE', enabled: true, order: 1, span: 2 },
  geopolitics: { id: 'geopolitics', title: 'GEOPOLITICS', enabled: true, order: 2, span: 2 },
  newsTerminal: { id: 'newsTerminal', title: 'NEWS WIRE', enabled: true, order: 3, span: 3 },
  economicCalendar: { id: 'economicCalendar', title: 'ECONOMIC CAL', enabled: true, order: 4, span: 2 },
  intermarket: { id: 'intermarket', title: 'INTERMARKET', enabled: true, order: 5, span: 2 },
  liquidity: { id: 'liquidity', title: 'LIQUIDITY', enabled: true, order: 6, span: 2 },
};

export const PANEL_LAYOUT = {
  gridColumns: 4,
  rowHeight: 180,
  minPanelWidth: 280,
  maxPanelWidth: 800,
  gap: 4,
};

export const DOCK_PRESETS = {
  default: ['biasEngine', 'geopolitics', 'newsTerminal', 'economicCalendar', 'intermarket', 'liquidity'],
  compact: ['biasEngine', 'geopolitics', 'newsTerminal', 'economicCalendar'],
  full: ['biasEngine', 'geopolitics', 'newsTerminal', 'economicCalendar', 'intermarket', 'liquidity'],
};

export const STORAGE_KEYS = {
  panels: 'xauusd-panels',
  panelOrder: 'xauusd-panel-order',
  panelSpans: 'xauusd-panel-spans',
  settings: 'xauusd-settings',
  layout: 'xauusd-layout',
};