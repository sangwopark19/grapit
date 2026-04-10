import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { INestApplicationContext } from '@nestjs/common';
import type IORedis from 'ioredis';
import { RedisIoAdapter } from '../providers/redis-io.adapter.js';

/**
 * RedisIoAdapter wires Socket.IO to the shared ioredis REDIS_CLIENT so that
 * seat-update events broadcast across Cloud Run instances via Valkey pub/sub.
 * These tests cover the branching logic of `connectToRedis()` without booting
 * a real NestJS app or Socket.IO server.
 */
describe('RedisIoAdapter', () => {
  const mockApp = {
    get: vi.fn(),
  } as unknown as INestApplicationContext;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wires the Redis adapter when the injected client exposes duplicate()', () => {
    const subClient = { on: vi.fn(), subscribe: vi.fn() };
    const duplicate = vi.fn().mockReturnValue(subClient);
    const pubClient = { duplicate } as unknown as IORedis;

    const adapter = new RedisIoAdapter(mockApp, pubClient);
    const wired = adapter.connectToRedis();

    expect(wired).toBe(true);
    expect(duplicate).toHaveBeenCalledTimes(1);
    // @socket.io/redis-adapter requires maxRetriesPerRequest: null + enableReadyCheck: false
    // on the sub client (Phase 07-04 review fix, 07-REVIEWS.md Claude #8, T-07-13).
    expect(duplicate).toHaveBeenCalledWith({
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  });

  it('falls back gracefully when the client has no duplicate() method', () => {
    // Simulates InMemoryRedis: no .duplicate() -> adapter cannot wire pub/sub
    const inMemoryMock = { set: vi.fn(), get: vi.fn() } as unknown as IORedis;

    const adapter = new RedisIoAdapter(mockApp, inMemoryMock);
    const wired = adapter.connectToRedis();

    expect(wired).toBe(false);
  });

  it('does not throw when duplicate is present but returns a minimal sub client', () => {
    const duplicate = vi.fn().mockReturnValue({});
    const pubClient = { duplicate } as unknown as IORedis;
    const adapter = new RedisIoAdapter(mockApp, pubClient);

    expect(() => adapter.connectToRedis()).not.toThrow();
  });
});
