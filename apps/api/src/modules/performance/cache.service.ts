import { Inject, Injectable } from '@nestjs/common';
import type IORedis from 'ioredis';

import { REDIS_CLIENT } from '../booking/providers/redis.provider.js';

/**
 * Default cache TTL (seconds). 5 minutes per phase 07 decision D-08.
 */
const DEFAULT_TTL = 300;

/**
 * CacheService — thin read-through / invalidation helper over ioredis.
 *
 * Usage:
 *  - get<T>(key): parsed JSON value or null (null on miss or on any error)
 *  - set(key, value, ttl?): JSON.stringify + EX ttl. Errors are swallowed
 *    so cache outages never break the request path (graceful degradation).
 *  - invalidate(...keys): DEL a set of explicit keys
 *  - invalidatePattern(pattern): KEYS(pattern) + DEL matches. Used for
 *    list-style caches where the exact key set isn't tracked.
 *
 * Notes:
 *  - Cache keys are server-generated — user input must never be concatenated
 *    into a key without prior validation (see threat model T-07-04).
 *  - KEYS is O(N) but acceptable at current scale (<100 cache entries per
 *    phase 07 research). Revisit with SCAN if traffic grows.
 */
@Injectable()
export class CacheService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: IORedis,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, data: unknown, ttlSeconds: number = DEFAULT_TTL): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
    } catch {
      // Graceful degradation: a failed cache write must never break the request
    }
  }

  async invalidate(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.redis.del(...keys);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
