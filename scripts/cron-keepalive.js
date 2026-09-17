#!/usr/bin/env node

const TARGET_URL = process.env.KEEPALIVE_URL || 'https://xauusd-watcher.onrender.com/api/health';
const TIMEOUT_MS = 10000;

async function ping() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const start = Date.now();
    const response = await fetch(TARGET_URL, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'XAUUSD-Watcher-Keepalive/1.0',
      },
    });
    clearTimeout(timeout);

    const latency = Date.now() - start;
    const data = await response.json().catch(() => ({}));

    console.log(`[${new Date().toISOString()}] Keepalive ping: ${response.status} ${response.statusText} (${latency}ms)`);
    console.log(`  Response:`, JSON.stringify(data));

    if (!response.ok) {
      console.error(`[${new Date().toISOString()}] WARNING: Non-OK status ${response.status}`);
      process.exit(1);
    }
  } catch (error) {
    clearTimeout(timeout);
    console.error(`[${new Date().toISOString()}] Keepalive failed:`, error);
    process.exit(1);
  }
}

ping();