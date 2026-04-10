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
});
