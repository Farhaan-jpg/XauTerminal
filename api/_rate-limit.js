// IP token-bucket rate limiter
const buckets = new Map();
const REFILL_RATE = 10; // tokens per second
const BUCKET_CAPACITY = 30;

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.ip ||
         'unknown';
}

export function rateLimit(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  let bucket = buckets.get(ip);

  if (!bucket) {
    bucket = { tokens: BUCKET_CAPACITY, lastRefill: now };
    buckets.set(ip, bucket);
  }

  // Refill tokens
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(BUCKET_CAPACITY, bucket.tokens + elapsed * REFILL_RATE);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true };
  }

  const retryAfter = Math.ceil((1 - bucket.tokens) / REFILL_RATE);
  return { allowed: false, retryAfter };
}

export function rateLimitMiddleware(req, res) {
  const { allowed, retryAfter } = rateLimit(req);
  res.setHeader('X-RateLimit-Limit', BUCKET_CAPACITY.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, Math.floor(buckets.get(getClientIp(req))?.tokens ?? 0)).toString());

  if (!allowed) {
    res.setHeader('Retry-After', retryAfter.toString());
    res.statusCode = 429;
    res.end(JSON.stringify({ error: 'Rate limited', retryAfter }));
    return true;
  }
  return false;
}

// Cleanup old buckets
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of buckets.entries()) {
    if (now - bucket.lastRefill > 300000) buckets.delete(ip); // 5 min idle
  }
}, 60000);