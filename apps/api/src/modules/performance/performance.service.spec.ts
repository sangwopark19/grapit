import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  PerformanceCardData,
  PerformanceListResponse,
  PerformanceWithDetails,
} from '@grapit/shared';

import { PerformanceService } from './performance.service.js';
import { CacheService } from './cache.service.js';

function createMockCacheService(): CacheService {
  // Miss-by-default cache so the service falls through to the DB path
  // just like it did before Plan 07-02 wired CacheService in.
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
    invalidatePattern: vi.fn().mockResolvedValue(undefined),
  } as unknown as CacheService;
}

/**
 * Phase 2 Plan 00: RED-state test stubs for PerformanceService
 *
 * These tests describe the expected contract for PerformanceService:
 * - findByGenre: paginated genre-filtered catalog queries
 * - findById: detail view with relations + view count increment
 * - getHomeBanners / getHotPerformances / getNewPerformances: home page data
 *
 * Services will be implemented in Plan 02. Tests should turn GREEN then.
 */

// --- Drizzle mock helpers ---
function createChainableMock() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'from', 'where', 'leftJoin', 'limit', 'offset', 'orderBy', 'groupBy', 'innerJoin'];
  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  // Terminal: resolve to empty array by default
  (chain as { then?: unknown }).then = vi.fn((resolve: (v: unknown[]) => void) => resolve([]));
  return chain;
}

function createMockDb() {
  const chainable = createChainableMock();
  return {
    select: vi.fn().mockReturnValue(chainable),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
    query: {
      performances: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      banners: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
    execute: vi.fn().mockResolvedValue([]),
    _chainable: chainable,
  };
}

describe('PerformanceService', () => {
  let service: PerformanceService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockCache: CacheService;

  beforeEach(() => {
    mockDb = createMockDb();
    mockCache = createMockCacheService();
    service = new PerformanceService(
      mockDb as unknown as ConstructorParameters<typeof PerformanceService>[0],
      mockCache,
    );
  });

  describe('findByGenre', () => {
    it('should return paginated performances filtered by genre', async () => {
      const result: PerformanceListResponse = await service.findByGenre('musical', {
        page: 1,
        limit: 20,
        sort: 'latest',
        ended: false,
      });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('totalPages');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should filter by subcategory when sub param provided', async () => {
      await service.findByGenre('musical', {
        page: 1,
        limit: 20,
        sort: 'latest',
        ended: false,
        sub: 'hot',
      });

      // Verify the query includes subcategory filter
      // When GREEN, the mock's WHERE clause should have been called with subcategory condition
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should exclude ended performances when ended=false', async () => {
      await service.findByGenre('concert', {
        page: 1,
        limit: 20,
        sort: 'latest',
        ended: false,
      });

      // When GREEN, should verify WHERE excludes status='ended'
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should sort by viewCount DESC when sort=popular', async () => {
      await service.findByGenre('play', {
        page: 1,
        limit: 20,
        sort: 'popular',
        ended: false,
      });

      // When GREEN, should verify ORDER BY uses viewCount DESC
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return performance with venue, priceTiers, showtimes, castings, seatMap', async () => {
      const testId = '550e8400-e29b-41d4-a716-446655440000';
      const result: PerformanceWithDetails | null = await service.findById(testId);

      // When GREEN, result should have the full PerformanceWithDetails shape
      if (result !== null) {
        expect(result).toHaveProperty('venue');
        expect(result).toHaveProperty('priceTiers');
        expect(result).toHaveProperty('showtimes');
        expect(result).toHaveProperty('castings');
        expect(result).toHaveProperty('seatMap');
      }
    });

    it('should increment viewCount by 1', async () => {
      const testId = '550e8400-e29b-41d4-a716-446655440000';
      await service.findById(testId);

      // When GREEN, should verify UPDATE performances SET view_count = view_count + 1
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should return null for non-existent id', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const result = await service.findById(nonExistentId);

      expect(result).toBeNull();
    });
  });

  describe('getHomeBanners', () => {
    it('should return active banners ordered by sortOrder', async () => {
      const result = await service.getHomeBanners();

      // When GREEN, should verify:
      // - WHERE isActive=true
      // - ORDER BY sortOrder ASC
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getHotPerformances', () => {
    it('should return top 4 performances by viewCount', async () => {
      const result: PerformanceCardData[] = await service.getHotPerformances();

      // When GREEN, should verify:
      // - LIMIT 4
      // - ORDER BY viewCount DESC
      // - Only non-ended performances
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(4);
    });
  });

  describe('getNewPerformances', () => {
    it('should return top 4 performances by createdAt', async () => {
      const result: PerformanceCardData[] = await service.getNewPerformances();

      // When GREEN, should verify:
      // - LIMIT 4
      // - ORDER BY createdAt DESC
      // - Only non-ended performances
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(4);
    });
  });
});
