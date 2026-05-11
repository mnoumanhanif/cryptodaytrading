import { Redis } from '@upstash/redis';
import { TIER_LIMITS } from './config';
import type { SaaSTier } from './config';

type MemoryCounter = {
  count: number;
  expiresAt: number;
};

const memoryCounters = new Map<string, MemoryCounter>();

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

async function incrementWithExpiry(key: string, ttlSeconds: number): Promise<number> {
  if (redis) {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, ttlSeconds);
    }
    return count;
  }

  const now = Date.now();
  const current = memoryCounters.get(key);
  if (!current || current.expiresAt < now) {
    memoryCounters.set(key, { count: 1, expiresAt: now + ttlSeconds * 1000 });
    return 1;
  }

  current.count += 1;
  memoryCounters.set(key, current);
  return current.count;
}

export async function enforceApiRateLimit(workspaceId: string, tier: SaaSTier): Promise<{ allowed: boolean; limit: number; count: number }> {
  const limit = TIER_LIMITS[tier].apiRequestsPerMinute;
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const key = `rl:api:${workspaceId}:${minuteBucket}`;
  const count = await incrementWithExpiry(key, 60);

  return {
    allowed: count <= limit,
    limit,
    count,
  };
}

export async function enforceScannerRateLimit(workspaceId: string, tier: SaaSTier): Promise<{ allowed: boolean; limit: number; count: number }> {
  const limit = TIER_LIMITS[tier].scannerRequestsPerDay;
  const dayBucket = new Date().toISOString().slice(0, 10);
  const key = `rl:scanner:${workspaceId}:${dayBucket}`;
  const count = await incrementWithExpiry(key, 24 * 60 * 60);

  return {
    allowed: count <= limit,
    limit,
    count,
  };
}
