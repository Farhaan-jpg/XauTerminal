// In-memory TTL cache with stale-while-revalidate
const cache = new Map();

export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache(key, data, ttlMs, staleTtlMs) {
  const now = Date.now();
  cache.set(key, {
    data,
    expiresAt: now + ttlMs,
    staleAt: now + (staleTtlMs ?? ttlMs * 2),
  });
}

export function getStale(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  const now = Date.now();
  if (now > entry.staleAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function invalidateCache(pattern) {
  const regex = new RegExp(pattern);
  for (const key of cache.keys()) {
    if (regex.test(key)) cache.delete(key);
  }
}

export function clearCache() {
  cache.clear();
}

export function getCacheStats() {
  return { size: cache.size, keys: Array.from(cache.keys()) };
}

// Cleanup interval
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.staleAt) cache.delete(key);
  }
}, 60000);