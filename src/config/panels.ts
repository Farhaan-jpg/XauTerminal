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
  defaultHeight: 320,
  minHeight: 200,
};

export const PANEL_META: Record<string, { name: string }> = {
  biasEngine: { name: 'Bias Engine' },
  geopolitics: { name: 'Geopolitics' },
  newsTerminal: { name: 'News Wire' },
  economicCalendar: { name: 'Economic Cal' },
  intermarket: { name: 'Intermarket' },
  liquidity: { name: 'Liquidity' },
};

export const ALL_PANEL_IDS: string[] = [
  'biasEngine',
  'geopolitics',
  'newsTerminal',
  'economicCalendar',
  'intermarket',
  'liquidity',
];

export interface LayoutPreset {
  id: string;
  name: string;
  desc: string;
  visible: string[];
  spans: Record<string, number>;
  chartOnly?: boolean;
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'default',
    name: 'DEFAULT',
    desc: 'All panels, balanced watchtower',
    visible: [...ALL_PANEL_IDS],
    spans: { biasEngine: 2, geopolitics: 2, newsTerminal: 3, economicCalendar: 2, intermarket: 2, liquidity: 2 },
    chartOnly: false,
  },
  {
    id: 'scalping',
    name: 'SCALPING',
    desc: 'Fast feeds: Bias + News + Liquidity',
    visible: ['biasEngine', 'newsTerminal', 'liquidity'],
    spans: { biasEngine: 2, newsTerminal: 3, liquidity: 2 },
    chartOnly: false,
  },
  {
    id: 'swing',
    name: 'SWING',
    desc: 'Thesis: Bias + Geopolitics + Macro + Intermarket',
    visible: ['biasEngine', 'geopolitics', 'economicCalendar', 'intermarket'],
    spans: { biasEngine: 2, geopolitics: 2, economicCalendar: 2, intermarket: 2 },
    chartOnly: false,
  },
  {
    id: 'macro',
    name: 'MACRO WATCH',
    desc: 'News + Calendar + Intermarket focus',
    visible: ['newsTerminal', 'economicCalendar', 'intermarket'],
    spans: { newsTerminal: 3, economicCalendar: 2, intermarket: 2 },
    chartOnly: false,
  },
  {
    id: 'chart',
    name: 'CHART ROOM',
    desc: 'Full-screen chart',
    visible: [],
    spans: {},
    chartOnly: true,
  },
];

export interface PanelViewState {
  collapsed: Record<string, boolean>;
  hidden: Record<string, boolean>;
  presetId: string;
  chartOnly: boolean;
  chartCollapsed: boolean;
}

export const DEFAULT_VIEW_STATE: PanelViewState = {
  collapsed: {},
  hidden: {},
  presetId: 'default',
  chartOnly: false,
  chartCollapsed: false,
};

export const STORAGE_KEYS = {
  panels: 'xauusd-panels',
  panelOrder: 'xauusd-panel-order',
  panelSpans: 'xauusd-panel-spans',
  panelHeights: 'xauusd-panel-heights',
  settings: 'xauusd-settings',
  layout: 'xauusd-layout',
};