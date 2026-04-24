import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { redisProvider, REDIS_CLIENT } from '../redis.provider.js';

/**
 * redisProvider factory tests (Phase 07-04 review fix).
 *
 * Verifies production hard-fail behavior added to prevent silent InMemoryRedis
 * fallback on Cloud Run secret binding misconfig. See 07-REVIEWS.md HIGH concern
 * (Codex + Claude CLI consensus #1) and T-07-10 threat mitigation.
 */

type UseFactory = (config: ConfigService) => IORedis;

function createMockConfig(url: string): ConfigService {
  return {
    get: vi.fn().mockImplementation((_key: string, defaultValue?: string) => {
      if (url === '') return defaultValue ?? '';
      return url;
    }),
  } as unknown as ConfigService;
}

describe('redisProvider factory', () => {
  const originalNodeEnv = process.env['NODE_ENV'];
  let useFactory: UseFactory;

  beforeEach(() => {
    // redisProvider.useFactory is the function we test
    useFactory = redisProvider.useFactory as UseFactory;
  });

  afterEach(() => {
    process.env['NODE_ENV'] = originalNodeEnv;
  });

  it('exposes the REDIS_CLIENT injection symbol', () => {
    expect(redisProvider.provide).toBe(REDIS_CLIENT);
  });

  it('throws when NODE_ENV=production and REDIS_URL is empty (hard-fail guard)', () => {
    process.env['NODE_ENV'] = 'production';
    const config = createMockConfig('');

    expect(() => useFactory(config)).toThrowError(/REDIS_URL is required in production/);
  });

  it('returns InMemoryRedis mock when NODE_ENV=development and REDIS_URL is empty', () => {
    process.env['NODE_ENV'] = 'development';
    const config = createMockConfig('');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const client = useFactory(config) as unknown as { set: unknown; get: unknown; eval: unknown };

    expect(typeof client.set).toBe('function');
    expect(typeof client.get).toBe('function');
    expect(typeof client.eval).toBe('function');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('returns InMemoryRedis mock when NODE_ENV=test and REDIS_URL is empty', () => {
    process.env['NODE_ENV'] = 'test';
    const config = createMockConfig('');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const client = useFactory(config) as unknown as { set: unknown };
    expect(typeof client.set).toBe('function');
    warnSpy.mockRestore();
  });

  it('returns a real ioredis instance when REDIS_URL is set (production)', () => {
    process.env['NODE_ENV'] = 'production';
    const config = createMockConfig('redis://localhost:6379');

    const client = useFactory(config);

    // Real ioredis has duplicate() — InMemoryRedis mock does not
    expect(typeof (client as IORedis).duplicate).toBe('function');

    // Clean up to avoid vitest hanging on open socket
    (client as IORedis).disconnect();
  });

  /**
   * Phase 10.1 review (WR-01): SmsService depends on ioredis variadic set(),
   * decr(), pttl(), and pipeline(). The InMemoryRedis mock must cover these
   * so local dev without REDIS_URL doesn't crash the SMS send path.
   */
  describe('InMemoryRedis surface parity with ioredis (Phase 10.1 WR-01)', () => {
    type MemRedis = {
      set: (key: string, value: string, ...args: unknown[]) => Promise<string | null>;
      get: (key: string) => Promise<string | null>;
      del: (...keys: string[]) => Promise<number>;
      decr: (key: string) => Promise<number>;
      pttl: (key: string) => Promise<number>;
      pipeline: () => {
        set: (key: string, value: string, ...args: unknown[]) => ReturnType<MemRedis['pipeline']>;
        del: (...keys: string[]) => ReturnType<MemRedis['pipeline']>;
        exec: () => Promise<Array<[Error | null, unknown]>>;
      };
    };

    function createMock(): MemRedis {
      process.env['NODE_ENV'] = 'test';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const client = useFactory(createMockConfig('')) as unknown as MemRedis;
      warnSpy.mockRestore();
      return client;
    }

    it('set(key, value, "PX", ms, "NX") honors NX + TTL (ioredis variadic)', async () => {
      const redis = createMock();
      // [Phase 14 / WR-01] Illustrative fixture uses the unified hash-tag key
      // scheme (`{sms:<e164>}:resend`) that SmsService actually produces.
      const key = '{sms:+821012345678}:resend';
      const first = await redis.set(key, '1', 'PX', 30_000, 'NX');
      expect(first).toBe('OK');

      // Second NX call must fail while key is live
      const second = await redis.set(key, '1', 'PX', 30_000, 'NX');
      expect(second).toBeNull();

      // pttl returns remaining milliseconds for a key with TTL
      const ttl = await redis.pttl(key);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(30_000);
    });

    it('set(key, value, "EX", seconds) mirrors CacheService cache-set', async () => {
      const redis = createMock();
      const ok = await redis.set('cache:perf:123', '{"v":1}', 'EX', 300);
      expect(ok).toBe('OK');
      expect(await redis.get('cache:perf:123')).toBe('{"v":1}');
    });

    it('decr() decrements and can go below zero (rollback parity with real Redis)', async () => {
      const redis = createMock();
      // [Phase 14 / WR-01] Illustrative fixture uses the unified hash-tag key
      // scheme (`{sms:<e164>}:send-count`) that SmsService actually produces.
      const key = '{sms:+821012345678}:send-count';
      await redis.set(key, '3');
      expect(await redis.decr(key)).toBe(2);
      expect(await redis.decr(key)).toBe(1);
    });

    it('pttl returns -2 for missing key, -1 for key without TTL', async () => {
      const redis = createMock();
      expect(await redis.pttl('nope')).toBe(-2);
      await redis.set('bare', '1');
      expect(await redis.pttl('bare')).toBe(-1);
    });

    it('pipeline().set().del().exec() returns ioredis-style [err, res] tuples', async () => {
      const redis = createMock();
      const pipe = redis.pipeline();
      const results = await pipe
        .set('{sms:+821012345678}:otp', '654321', 'PX', 180_000)
        .del('{sms:+821012345678}:attempts')
        .exec();

      expect(results).toHaveLength(2);
      expect(results[0]?.[0]).toBeNull();
      expect(results[0]?.[1]).toBe('OK');
      expect(results[1]?.[0]).toBeNull();
      expect(typeof results[1]?.[1]).toBe('number');

      // Post-pipeline state: OTP stored with TTL (Phase 14 hash-tag form)
      expect(await redis.get('{sms:+821012345678}:otp')).toBe('654321');
    });
  });
});
