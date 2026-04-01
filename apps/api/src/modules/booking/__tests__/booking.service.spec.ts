import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { BookingService } from '../booking.service.js';
import type { BookingGateway } from '../booking.gateway.js';

// Mock Redis client
function createMockRedis() {
  return {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    smembers: vi.fn(),
    sadd: vi.fn(),
    srem: vi.fn(),
    scard: vi.fn(),
    expire: vi.fn(),
  };
}

// Mock Gateway
function createMockGateway(): { broadcastSeatUpdate: ReturnType<typeof vi.fn> } {
  return {
    broadcastSeatUpdate: vi.fn(),
  };
}

// Mock Drizzle DB
function createMockDb() {
  return {
    select: vi.fn(),
    insert: vi.fn(),
  };
}

describe('BookingService', () => {
  let service: BookingService;
  let mockRedis: ReturnType<typeof createMockRedis>;
  let mockGateway: ReturnType<typeof createMockGateway>;
  let mockDb: ReturnType<typeof createMockDb>;

  const userId = 'user-123';
  const showtimeId = '550e8400-e29b-41d4-a716-446655440000';
  const seatId = 'A-1';

  beforeEach(() => {
    mockRedis = createMockRedis();
    mockGateway = createMockGateway();
    mockDb = createMockDb();

    service = new BookingService(
      mockRedis as any,
      mockDb as any,
      mockGateway as unknown as BookingGateway,
    );
  });

  describe('lockSeat', () => {
    it('calls redis.set with {nx: true, ex: 600} and returns LockSeatResponse on success', async () => {
      mockRedis.scard.mockResolvedValue(3); // under limit
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const before = Date.now();
      const result = await service.lockSeat(userId, showtimeId, seatId);
      const after = Date.now();

      // Verify redis.set called with correct args
      expect(mockRedis.set).toHaveBeenCalledWith(
        `seat:${showtimeId}:${seatId}`,
        userId,
        { nx: true, ex: 600 },
      );

      // Verify response shape
      expect(result.success).toBe(true);
      expect(result.seatId).toBe(seatId);
      expect(result.expiresAt).toBeGreaterThanOrEqual(before + 600_000);
      expect(result.expiresAt).toBeLessThanOrEqual(after + 600_000);
    });

    it('returns 409 when redis.set returns null (seat already locked)', async () => {
      mockRedis.scard.mockResolvedValue(0);
      mockRedis.set.mockResolvedValue(null);

      await expect(service.lockSeat(userId, showtimeId, seatId))
        .rejects
        .toThrow(ConflictException);

      // Verify sadd NOT called for locked-seats (lock failed)
      const lockedSeatsCalls = mockRedis.sadd.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).startsWith('locked-seats:'),
      );
      expect(lockedSeatsCalls).toHaveLength(0);
    });

    it('rejects when user already has 4 locked seats (max seat limit D-03)', async () => {
      mockRedis.scard.mockResolvedValue(4);

      await expect(service.lockSeat(userId, showtimeId, seatId))
        .rejects
        .toThrow(/4/);
    });

    it('adds seatId to BOTH user-seats AND locked-seats Redis sets', async () => {
      mockRedis.scard.mockResolvedValue(0);
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await service.lockSeat(userId, showtimeId, seatId);

      // Verify user-seats set
      const userSeatsCalls = mockRedis.sadd.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).startsWith('user-seats:'),
      );
      expect(userSeatsCalls).toHaveLength(1);
      expect(userSeatsCalls[0]).toEqual([`user-seats:${showtimeId}:${userId}`, seatId]);

      // Verify locked-seats set (CRITICAL)
      const lockedSeatsCalls = mockRedis.sadd.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).startsWith('locked-seats:'),
      );
      expect(lockedSeatsCalls).toHaveLength(1);
      expect(lockedSeatsCalls[0]).toEqual([`locked-seats:${showtimeId}`, seatId]);
    });

    it('calls gateway.broadcastSeatUpdate after successful lock', async () => {
      mockRedis.scard.mockResolvedValue(0);
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await service.lockSeat(userId, showtimeId, seatId);

      expect(mockGateway.broadcastSeatUpdate).toHaveBeenCalledOnce();
      expect(mockGateway.broadcastSeatUpdate).toHaveBeenCalledWith(
        showtimeId,
        seatId,
        'locked',
      );
    });
  });

  describe('unlockSeat', () => {
    it('deletes redis key only when current user is the lock owner', async () => {
      mockRedis.get.mockResolvedValue(userId);
      mockRedis.del.mockResolvedValue(1);
      mockRedis.srem.mockResolvedValue(1);

      const result = await service.unlockSeat(userId, showtimeId, seatId);

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith(`seat:${showtimeId}:${seatId}`);
    });

    it('does NOT delete when a different user tries to unlock', async () => {
      mockRedis.get.mockResolvedValue('other-user-id');

      const result = await service.unlockSeat(userId, showtimeId, seatId);

      expect(result).toBe(false);
      expect(mockRedis.del).not.toHaveBeenCalled();

      // Verify srem NOT called for locked-seats
      const lockedSeatsCalls = mockRedis.srem.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).startsWith('locked-seats:'),
      );
      expect(lockedSeatsCalls).toHaveLength(0);
    });

    it('removes seatId from BOTH user-seats AND locked-seats Redis sets', async () => {
      mockRedis.get.mockResolvedValue(userId);
      mockRedis.del.mockResolvedValue(1);
      mockRedis.srem.mockResolvedValue(1);

      await service.unlockSeat(userId, showtimeId, seatId);

      // Verify user-seats removal
      const userSeatsCalls = mockRedis.srem.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).startsWith('user-seats:'),
      );
      expect(userSeatsCalls).toHaveLength(1);
      expect(userSeatsCalls[0]).toEqual([`user-seats:${showtimeId}:${userId}`, seatId]);

      // Verify locked-seats removal (CRITICAL)
      const lockedSeatsCalls = mockRedis.srem.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).startsWith('locked-seats:'),
      );
      expect(lockedSeatsCalls).toHaveLength(1);
      expect(lockedSeatsCalls[0]).toEqual([`locked-seats:${showtimeId}`, seatId]);
    });

    it('calls gateway.broadcastSeatUpdate after successful unlock', async () => {
      mockRedis.get.mockResolvedValue(userId);
      mockRedis.del.mockResolvedValue(1);
      mockRedis.srem.mockResolvedValue(1);

      await service.unlockSeat(userId, showtimeId, seatId);

      expect(mockGateway.broadcastSeatUpdate).toHaveBeenCalledOnce();
      expect(mockGateway.broadcastSeatUpdate).toHaveBeenCalledWith(
        showtimeId,
        seatId,
        'available',
      );
    });
  });

  describe('getSeatStatus', () => {
    it('returns Record of seatId to SeatState combining Redis locks + DB sold records', async () => {
      // Mock Redis locked seats
      mockRedis.smembers.mockResolvedValue(['A-1', 'A-2']);

      // Mock DB sold seats
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { seatId: 'B-1', status: 'sold' },
        ]),
      });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const result = await service.getSeatStatus(showtimeId);

      expect(result.showtimeId).toBe(showtimeId);
      expect(result.seats['A-1']).toBe('locked');
      expect(result.seats['A-2']).toBe('locked');
      expect(result.seats['B-1']).toBe('sold');

      // Verify smembers called with locked-seats key
      expect(mockRedis.smembers).toHaveBeenCalledWith(`locked-seats:${showtimeId}`);
    });
  });
});
