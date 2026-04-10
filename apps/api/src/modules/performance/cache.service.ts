import { Inject, Injectable, Logger } from '@nestjs/common';
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
 *  - invalidate(...keys): DEL a set of explicit keys. Errors are swallowed
 *    + logged (per 07-REVIEWS.md MEDIUM consensus #6): admin DB commit must
 *    not roll back on transient cache outage, but the failure must be
 *    observable via logs.
 *  - invalidatePattern(pattern): KEYS(pattern) + DEL matches. Same swallow-
 *    and-log semantics as invalidate().
 *
 * Notes:
 *  - Cache keys are server-generated — user input must never be concatenated
 *    into a key without prior validation (see threat model T-07-04).
 *  - KEYS is O(N) but acceptable at current scale (<100 cache entries per
 *    phase 07 research). Revisit with SCAN if traffic grows (backlog).
 *  - Log only `err.message` and the cache key structure (no values) to avoid
 *    leaking cached payloads in logs — T-07-11 Information Disclosure.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: IORedis,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (err) {
      this.logger.warn(
        { err: (err as Error).message, key, op: 'get' },
        'cache get failed — falling back to DB',
      );
      return null;
    }
  }

  async set(key: string, data: unknown, ttlSeconds: number = DEFAULT_TTL): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
    } catch (err) {
      // Graceful degradation: a failed cache write must never break the request.
      this.logger.warn(
        { err: (err as Error).message, key, op: 'set' },
        'cache set failed — request continues without caching',
      );
    }
  }

  async invalidate(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await this.redis.del(...keys);
    } catch (err) {
      // DB-cache divergence risk accepted: admin DB commit has already happened;
      // cache will self-heal on next TTL or next invalidation call.
      this.logger.warn(
        { err: (err as Error).message, keys, op: 'invalidate' },
        'cache invalidate failed — DB committed but cache may be stale until TTL',
      );
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (err) {
      this.logger.warn(
        { err: (err as Error).message, pattern, op: 'invalidatePattern' },
        'cache invalidatePattern failed — DB committed but cache may be stale until TTL',
      );
    }
  }
}
