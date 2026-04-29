import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RedisHealthIndicator } from '../redis.health.indicator.js';

/**
 * RedisHealthIndicator unit tests (Phase 07-05 review fix).
 *
 * Verifies ping-based up/down reporting using Terminus 11's
 * HealthIndicatorService.check(key) API. We mock both the Terminus
 * session and the injected ioredis client so these tests stay fast
 * and deterministic; the real Valkey roundtrip is covered by the
 * sibling integration spec under booking/__tests__.
 */

type IndicatorResult = {
  [key: string]: { status: 'up' | 'down'; message?: string };
};

function createMockHealthService() {
  return {
    check: vi.fn((key: string) => ({
      up: vi.fn((data?: unknown) => ({
        [key]: { status: 'up' as const, ...(data as Record<string, unknown> | undefined) },
      })),
      down: vi.fn((data?: unknown) => ({
        [key]: { status: 'down' as const, ...(data as Record<string, unknown> | undefined) },
      })),
    })),
  };
}

function createMockRedis() {
  return { ping: vi.fn() };
}

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;
  let mockHealth: ReturnType<typeof createMockHealthService>;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockHealth = createMockHealthService();
    mockRedis = createMockRedis();
    indicator = new RedisHealthIndicator(mockHealth as never, mockRedis as never);
  });

  it('reports up when redis.ping() returns PONG', async () => {
    mockRedis.ping.mockResolvedValueOnce('PONG');

    const result = (await indicator.isHealthy('redis')) as IndicatorResult;

    expect(mockRedis.ping).toHaveBeenCalledOnce();
    expect(result['redis']?.status).toBe('up');
  });

  it('reports up when redis client has no ping method (local in-memory fallback)', async () => {
    const redisWithoutPing = { get: vi.fn() };
    indicator = new RedisHealthIndicator(mockHealth as never, redisWithoutPing as never);

    const result = (await indicator.isHealthy('redis')) as IndicatorResult;

    expect(result['redis']?.status).toBe('up');
    expect(result['redis']?.message).toContain('ping unavailable');
  });

  it('reports down when redis.ping() rejects with error', async () => {
    mockRedis.ping.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = (await indicator.isHealthy('redis')) as IndicatorResult;

    expect(result['redis']?.status).toBe('down');
    expect(result['redis']?.message).toContain('ECONNREFUSED');
  });

  it('reports down when redis.ping() returns unexpected value', async () => {
    mockRedis.ping.mockResolvedValueOnce('NOT_PONG');

    const result = (await indicator.isHealthy('redis')) as IndicatorResult;

    expect(result['redis']?.status).toBe('down');
    expect(result['redis']?.message).toContain('NOT_PONG');
  });
});
