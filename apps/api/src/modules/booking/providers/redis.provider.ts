import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';
import IORedis from 'ioredis';

export const UPSTASH_REDIS = Symbol('UPSTASH_REDIS');
export const IOREDIS_CLIENT = Symbol('IOREDIS_CLIENT');

/**
 * In-memory Redis mock for local dev when Upstash is not configured.
 * Implements only the subset of commands used by BookingService.
 */
class InMemoryRedis {
  private store = new Map<string, string>();
  private sets = new Map<string, Set<string>>();
  private ttls = new Map<string, NodeJS.Timeout>();
  private expiries = new Map<string, number>();

  async set(key: string, value: string, opts?: { nx?: boolean; ex?: number }): Promise<string | null> {
    if (opts?.nx && this.store.has(key)) return null;
    this.store.set(key, value);
    if (opts?.ex) {
      const prev = this.ttls.get(key);
      if (prev) clearTimeout(prev);
      this.expiries.set(key, Date.now() + opts.ex * 1000);
      this.ttls.set(key, setTimeout(() => {
        this.store.delete(key);
        this.ttls.delete(key);
        this.expiries.delete(key);
        // Clean up locked-seats and user-seats when a seat lock expires
        const parts = key.split(':');
        if (parts[0] === 'seat' && parts.length === 3) {
          const [, showtimeId, seatId] = parts;
          const lockedSet = this.sets.get(`locked-seats:${showtimeId}`);
          if (lockedSet) lockedSet.delete(seatId);
          const userId = value;
          const userSet = this.sets.get(`user-seats:${showtimeId}:${userId}`);
          if (userSet) userSet.delete(seatId);
        }
      }, opts.ex * 1000));
    }
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const k of keys) { if (this.store.delete(k)) count++; }
    return count;
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.sets.has(key)) this.sets.set(key, new Set());
    const s = this.sets.get(key)!;
    let added = 0;
    for (const m of members) { if (!s.has(m)) { s.add(m); added++; } }
    return added;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const s = this.sets.get(key);
    if (!s) return 0;
    let removed = 0;
    for (const m of members) { if (s.delete(m)) removed++; }
    return removed;
  }

  async smembers(key: string): Promise<string[]> {
    return Array.from(this.sets.get(key) ?? []);
  }

  async scard(key: string): Promise<number> {
    return this.sets.get(key)?.size ?? 0;
  }

  async ttl(key: string): Promise<number> {
    if (!this.store.has(key) && !this.sets.has(key)) return -2;
    const expiry = this.expiries.get(key);
    if (!expiry) return -1;
    const remaining = Math.ceil((expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.store.has(key) && !this.sets.has(key)) return 0;
    const prev = this.ttls.get(key);
    if (prev) clearTimeout(prev);
    this.expiries.set(key, Date.now() + seconds * 1000);
    this.ttls.set(key, setTimeout(() => {
      this.store.delete(key);
      this.sets.delete(key);
      this.ttls.delete(key);
      this.expiries.delete(key);
    }, seconds * 1000));
    return 1;
  }

  /**
   * Implements the LOCK_SEAT_LUA script logic in JavaScript.
   * Only supports the seat locking Lua script used by BookingService.
   */
  async eval(
    _script: string,
    keys: string[],
    args: string[],
  ): Promise<[number, string, string?]> {
    const [userSeatsKey, lockKey, lockedSeatsKey] = keys;
    const [userId, lockTtl, maxSeats, seatId, keyPrefix] = args;

    // Step 1: Clean stale members and count alive
    const members = Array.from(this.sets.get(userSeatsKey) ?? []);
    let alive = 0;
    for (const sid of members) {
      if (this.store.has(`${keyPrefix}${sid}`)) {
        alive++;
      } else {
        const userSet = this.sets.get(userSeatsKey);
        if (userSet) userSet.delete(sid);
        const lockedSet = this.sets.get(lockedSeatsKey);
        if (lockedSet) lockedSet.delete(sid);
      }
    }

    // Step 2: Check max seats
    if (alive >= Number(maxSeats)) {
      return [0, 'MAX_SEATS'];
    }

    // Step 3: SET NX with EX
    const existing = this.store.get(lockKey);
    if (existing !== undefined) {
      return [0, 'CONFLICT'];
    }

    await this.set(lockKey, userId as string, { nx: true, ex: Number(lockTtl) });

    // Step 4: SADD to user-seats and locked-seats, EXPIRE user-seats
    await this.sadd(userSeatsKey, seatId as string);
    await this.expire(userSeatsKey, Number(lockTtl));
    await this.sadd(lockedSeatsKey, seatId as string);

    return [1, lockKey, seatId as string];
  }
}

export const upstashRedisProvider: Provider = {
  provide: UPSTASH_REDIS,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Redis | InMemoryRedis => {
    const url = config.get<string>('redis.upstashUrl', '');
    const token = config.get<string>('redis.upstashToken', '');

    if (!url || !token) {
      console.warn('[upstash] No UPSTASH_REDIS_REST_URL/TOKEN — using in-memory mock. Seat locking works but is not persistent.');
      return new InMemoryRedis() as unknown as Redis;
    }

    return new Redis({ url, token });
  },
};

export const ioredisClientProvider: Provider = {
  provide: IOREDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): IORedis => {
    const url = config.get<string>('redis.ioredisUrl', 'redis://localhost:6379');

    const client = new IORedis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        if (times > 5) return null;
        return Math.min(times * 500, 5000);
      },
    });

    client.on('error', (err: Error) => {
      if (err.message.includes('ECONNREFUSED')) {
        if (!ioredisWarned) {
          ioredisWarned = true;
          console.warn('[ioredis] Redis unavailable — Socket.IO multi-instance broadcast disabled. This is fine for local dev.');
        }
      }
    });

    client.connect().catch(() => {});

    return client;
  },
};

let ioredisWarned = false;
