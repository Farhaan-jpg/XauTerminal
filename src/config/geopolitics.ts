export interface GeopoliticalHotspot {
  id: string;
  name: string;
  lat: number;
  lon: number;
  weight: number;
  keywords: string[];
}

export interface ChokePoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  critical: boolean;
}

export const HOTSPOTS: GeopoliticalHotspot[] = [
  { id: 'israel-gaza', name: 'Israel-Gaza', lat: 31.5, lon: 34.5, weight: 1.0, keywords: ['gaza', 'hamas', 'israel', 'idf', 'ceasefire', 'hostage', 'rafah'] },
  { id: 'ukraine-russia', name: 'Ukraine-Russia', lat: 49.0, lon: 32.0, weight: 1.0, keywords: ['ukraine', 'russia', 'putin', 'zelensky', 'donbas', 'crimea', 'kharkiv'] },
  { id: 'taiwan-strait', name: 'Taiwan Strait', lat: 23.5, lon: 121.0, weight: 0.9, keywords: ['taiwan', 'china', 'pla', 'taiwan strait', 'tsmc', 'invasion'] },
  { id: 'korea', name: 'Korean Peninsula', lat: 38.5, lon: 127.0, weight: 0.8, keywords: ['north korea', 'kim jong', 'missile', 'south korea', 'dmz', 'icbm'] },
  { id: 'syria', name: 'Syria', lat: 34.8, lon: 38.9, weight: 0.7, keywords: ['syria', 'assad', 'idlib', 'aleppo', 'homs', 'golani'] },
  { id: 'yemen', name: 'Yemen-Red Sea', lat: 15.5, lon: 48.5, weight: 0.8, keywords: ['yemen', 'houthi', 'red sea', 'shipping', 'bab el mandeb', 'suez'] },
  { id: 'iran', name: 'Iran', lat: 32.4, lon: 53.7, weight: 0.9, keywords: ['iran', 'nuclear', 'sanctions', 'tehran', 'revolutionary guard', 'natanz'] },
  { id: 'venezuela', name: 'Venezuela-Guyana', lat: 5.4, lon: -62.0, weight: 0.5, keywords: ['venezuela', 'guyana', 'essequibo', 'maduro', 'border'] },
];

export const CHOKE_POINTS: ChokePoint[] = [
  { id: 'hormuz', name: 'Strait of Hormuz', lat: 26.6, lon: 56.3, critical: true },
  { id: 'malacca', name: 'Strait of Malacca', lat: 2.8, lon: 101.3, critical: true },
  { id: 'suez', name: 'Suez Canal', lat: 30.3, lon: 32.3, critical: true },
  { id: 'bab-mandeb', name: 'Bab el-Mandeb', lat: 12.6, lon: 43.5, critical: true },
  { id: 'panama', name: 'Panama Canal', lat: 9.1, lon: -79.7, critical: false },
];

export const THREAT_WEIGHTS = {
  war: 3.0,
  conflict: 2.0,
  crisis: 2.0,
  protest: 1.0,
  unrest: 1.0,
  missile: 2.5,
  nuclear: 3.0,
  sanctions: 1.5,
  escalation: 2.0,
  invasion: 3.0,
};

export const DEFCON_THRESHOLDS = [
  { level: 5, min: 0, max: 25, label: 'FADE OUT', color: '#44ff88' },
  { level: 4, min: 26, max: 50, label: 'DOUBLE TAKE', color: '#ffaa00' },
  { level: 3, min: 51, max: 75, label: 'ROUND HOUSE', color: '#ff8800' },
  { level: 2, min: 76, max: 90, label: 'FAST PACE', color: '#ff4444' },
  { level: 1, min: 91, max: 100, label: 'COCKED PISTOL', color: '#ff0000' },
];