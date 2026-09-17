const API_BASE = '/api';

async function fetchJson<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) {
    throw new Error(`API ${endpoint} failed: ${response.status}`);
  }
  return response.json();
}

export async function fetchGoldPrice(): Promise<any> {
  return fetchJson('/gold');
}

export async function fetchNews(): Promise<any> {
  return fetchJson('/news');
}

export async function fetchMacroCalendar(): Promise<any> {
  return fetchJson('/calendar');
}

export async function fetchGeopolitics(): Promise<any> {
  return fetchJson('/geopolitics');
}

export async function fetchIntermarket(): Promise<any> {
  return fetchJson('/intermarket');
}

export async function fetchOrderBook(): Promise<any> {
  return fetchJson('/orderbook');
}