/**
 * In-memory sliding-window limiter for dev/single-instance deploys. For multi-instance
 * production, swap the Map for REDIS_URL-backed counters (interface stays identical) —
 * that's the only change needed, callers never touch storage directly.
 */
const buckets = new Map<string, number[]>();

export class RateLimitError extends Error {}

export function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const timestamps = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) {
    throw new RateLimitError(`تجاوزت الحد المسموح (${limit} كل ${Math.round(windowMs / 1000)} ثانية).`);
  }
  timestamps.push(now);
  buckets.set(key, timestamps);
}
