import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CacheService } from '../cache.service.js';

/**
 * CacheService unit tests (Phase 07-02).
 *
 * Covers:
 * - get() returns null on miss
 * - set() + get() round-trip with JSON serialization
 * - set() uses TTL 300 seconds ('EX', 300) as default (per D-08)
 * - invalidate() calls redis.del with provided keys
 * - invalidatePattern() calls redis.keys then redis.del
 * - invalidatePattern() no-op when keys array is empty
 * - Graceful degradation: get()/set() swallow redis errors
 */

function createMockRedis() {
  return {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
  };
}

describe('CacheService', () => {
  let service: CacheService;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    service = new CacheService(mockRedis as never);
  });

  describe('get()', () => {
    it('returns null when key does not exist', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await service.get<{ id: string }>('cache:test:missing');

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith('cache:test:missing');
    });

    it('returns parsed object when value exists', async () => {
      const stored = { id: 'abc', title: 'test' };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(stored));

      const result = await service.get<typeof stored>('cache:test:hit');

      expect(result).toEqual(stored);
    });

    it('returns null on redis error (graceful degradation)', async () => {
      mockRedis.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await service.get<unknown>('cache:test:error');

      expect(result).toBeNull();
    });

    it('returns null when stored value is invalid JSON (graceful degradation)', async () => {
      mockRedis.get.mockResolvedValueOnce('not-json{{');

      const result = await service.get<unknown>('cache:test:bad-json');

      expect(result).toBeNull();
    });
  });

  describe('set()', () => {
    it('stores value with EX 300 TTL by default', async () => {
      const data = { foo: 'bar' };

      await service.set('cache:test:key', data);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'cache:test:key',
        JSON.stringify(data),
        'EX',
        300,
      );
    });

    it('supports custom TTL', async () => {
      await service.set('cache:test:key', { a: 1 }, 60);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'cache:test:key',
        JSON.stringify({ a: 1 }),
        'EX',
        60,
      );
    });

    it('swallows redis errors during set (graceful degradation)', async () => {
      mockRedis.set.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(service.set('cache:test:key', { a: 1 })).resolves.toBeUndefined();
    });
  });

  describe('invalidate()', () => {
    it('calls redis.del with provided keys when at least one key is passed', async () => {
      mockRedis.del.mockResolvedValueOnce(2);

      await service.invalidate('cache:a', 'cache:b');

      expect(mockRedis.del).toHaveBeenCalledWith('cache:a', 'cache:b');
    });

    it('does not call redis.del when no keys are passed', async () => {
      await service.invalidate();

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('invalidatePattern()', () => {
    it('calls redis.keys with the pattern and then redis.del for matches', async () => {
      mockRedis.keys.mockResolvedValueOnce([
        'cache:performances:list:musical:1:20:latest:false:none',
        'cache:performances:list:musical:2:20:latest:false:none',
      ]);
      mockRedis.del.mockResolvedValueOnce(2);

      await service.invalidatePattern('cache:performances:list:*');

      expect(mockRedis.keys).toHaveBeenCalledWith('cache:performances:list:*');
      expect(mockRedis.del).toHaveBeenCalledWith(
        'cache:performances:list:musical:1:20:latest:false:none',
        'cache:performances:list:musical:2:20:latest:false:none',
      );
    });

    it('does not call redis.del when keys() returns empty array', async () => {
      mockRedis.keys.mockResolvedValueOnce([]);

      await service.invalidatePattern('cache:home:*');

      expect(mockRedis.keys).toHaveBeenCalledWith('cache:home:*');
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('round-trip', () => {
    it('set() followed by get() returns the same object', async () => {
      const data = { id: 'perf-1', title: '레미제라블', viewCount: 42 };

      await service.set('cache:performances:detail:perf-1', data);

      // Simulate what redis would return: the JSON string that was set
      const setCall = mockRedis.set.mock.calls[0];
      const storedValue = setCall?.[1] as string;
      mockRedis.get.mockResolvedValueOnce(storedValue);

      const result = await service.get<typeof data>('cache:performances:detail:perf-1');

      expect(result).toEqual(data);
    });
  });
});
