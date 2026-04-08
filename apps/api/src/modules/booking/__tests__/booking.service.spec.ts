import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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
    eval: vi.fn(),
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

  // Helper: mock DB select to return no sold record (used by lockSeat DB defense)
  function mockNoSoldRecord() {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
  }

  describe('lockSeat', () => {
    it('cleans stale user-seats entries before count check via Lua eval', async () => {
      mockNoSoldRecord();
      // Lua returns [1, lockKey, seatId] = success
      const lockKey = `seat:${showtimeId}:${seatId}`;
      mockRedis.eval.mockResolvedValue([1, lockKey, seatId]);

      const before = Date.now();
      const result = await service.lockSeat(userId, showtimeId, seatId);
      const after = Date.now();

      // Verify redis.eval called with script containing SMEMBERS + EXISTS loop
      expect(mockRedis.eval).toHaveBeenCalledOnce();
      const [script, keys, args] = mockRedis.eval.mock.calls[0] as [string, string[], unknown[]];
      expect(script).toContain('SMEMBERS');
      expect(script).toContain('EXISTS');
      expect(keys).toContain(`user-seats:${showtimeId}:${userId}`);
      expect(keys).toContain(`seat:${showtimeId}:${seatId}`);
      expect(keys).toContain(`locked-seats:${showtimeId}`);

      // Verify response shape
      expect(result.success).toBe(true);
      expect(result.seatId).toBe(seatId);
      expect(result.expiresAt).toBeGreaterThanOrEqual(before + 600_000);
      expect(result.expiresAt).toBeLessThanOrEqual(after + 600_000);
    });

    it('rejects when live seat count >= MAX_SEATS after stale cleanup', async () => {
      mockNoSoldRecord();
      // Lua returns [0, "MAX_SEATS"] = max seats exceeded
      mockRedis.eval.mockResolvedValue([0, 'MAX_SEATS']);

      await expect(service.lockSeat(userId, showtimeId, seatId))
        .rejects
        .toThrow(ConflictException);
    });

    it('rejects when SET NX fails (seat taken)', async () => {
      mockNoSoldRecord();
      // Lua returns [0, "CONFLICT"] = seat already locked
      mockRedis.eval.mockResolvedValue([0, 'CONFLICT']);

      await expect(service.lockSeat(userId, showtimeId, seatId))
        .rejects
        .toThrow(ConflictException);
    });

    it('calls gateway.broadcastSeatUpdate after successful lock', async () => {
      mockNoSoldRecord();
      const lockKey = `seat:${showtimeId}:${seatId}`;
      mockRedis.eval.mockResolvedValue([1, lockKey, seatId]);

      await service.lockSeat(userId, showtimeId, seatId);

      expect(mockGateway.broadcastSeatUpdate).toHaveBeenCalledOnce();
      expect(mockGateway.broadcastSeatUpdate).toHaveBeenCalledWith(
        showtimeId,
        seatId,
        'locked',
        userId,
      );
    });

    it('does NOT broadcast when lock fails', async () => {
      mockNoSoldRecord();
      mockRedis.eval.mockResolvedValue([0, 'CONFLICT']);

      await expect(service.lockSeat(userId, showtimeId, seatId))
        .rejects
        .toThrow(ConflictException);

      expect(mockGateway.broadcastSeatUpdate).not.toHaveBeenCalled();
    });

    describe('sold defense', () => {
      it('should throw ConflictException when seat_inventories has status=sold', async () => {
        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: randomUUID() }]),
          }),
        });

        await expect(service.lockSeat(userId, showtimeId, seatId))
          .rejects.toThrow(ConflictException);

        await expect(service.lockSeat(userId, showtimeId, seatId))
          .rejects.toThrow('이미 판매된 좌석입니다');

        expect(mockRedis.eval).not.toHaveBeenCalled();
      });

      it('should proceed to Redis lock when no sold record exists in seat_inventories', async () => {
        mockNoSoldRecord();
        mockRedis.eval.mockResolvedValue([1, `seat:${showtimeId}:${seatId}`, seatId]);

        const result = await service.lockSeat(userId, showtimeId, seatId);

        expect(result.success).toBe(true);
        expect(result.seatId).toBe(seatId);
        expect(mockRedis.eval).toHaveBeenCalled();
      });

      it('should proceed normally when seat_inventories record exists with status=available', async () => {
        mockNoSoldRecord();
        mockRedis.eval.mockResolvedValue([1, `seat:${showtimeId}:${seatId}`, seatId]);

        const result = await service.lockSeat(userId, showtimeId, seatId);

        expect(result.success).toBe(true);
        expect(mockRedis.eval).toHaveBeenCalled();
        expect(mockGateway.broadcastSeatUpdate).toHaveBeenCalledWith(showtimeId, seatId, 'locked', userId);
      });
    });
  });

  describe('unlockSeat', () => {
    it('returns true when Lua script confirms ownership and deletes lock', async () => {
      mockRedis.eval.mockResolvedValue(1);

      const result = await service.unlockSeat(userId, showtimeId, seatId);

      expect(result).toBe(true);
      expect(mockRedis.eval).toHaveBeenCalledOnce();
      const [script, keys, args] = mockRedis.eval.mock.calls[0] as [string, string[], string[]];
      expect(script).toContain('GET');
      expect(script).toContain('DEL');
      expect(script).toContain('SREM');
      expect(keys).toEqual([
        `seat:${showtimeId}:${seatId}`,
        `user-seats:${showtimeId}:${userId}`,
        `locked-seats:${showtimeId}`,
      ]);
      expect(args).toEqual([userId, seatId]);
    });

    it('returns false when Lua script detects different owner', async () => {
      mockRedis.eval.mockResolvedValue(0);

      const result = await service.unlockSeat(userId, showtimeId, seatId);

      expect(result).toBe(false);
    });

    it('atomically removes from lock key, user-seats, and locked-seats via Lua', async () => {
      mockRedis.eval.mockResolvedValue(1);

      await service.unlockSeat(userId, showtimeId, seatId);

      // Lua script handles all cleanup atomically — no separate redis calls
      expect(mockRedis.del).not.toHaveBeenCalled();
      expect(mockRedis.srem).not.toHaveBeenCalled();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('calls gateway.broadcastSeatUpdate after successful unlock', async () => {
      mockRedis.eval.mockResolvedValue(1);

      await service.unlockSeat(userId, showtimeId, seatId);

      expect(mockGateway.broadcastSeatUpdate).toHaveBeenCalledOnce();
      expect(mockGateway.broadcastSeatUpdate).toHaveBeenCalledWith(
        showtimeId,
        seatId,
        'available',
        userId,
      );
    });
  });

  describe('unlockAllSeats', () => {
    it('unlocks all owned seats and returns seatIds', async () => {
      mockRedis.smembers.mockResolvedValue(['A-1', 'A-2']);
      mockRedis.get
        .mockResolvedValueOnce(userId)   // A-1 owned
        .mockResolvedValueOnce(userId);  // A-2 owned
      mockRedis.del.mockResolvedValue(1);
      mockRedis.srem.mockResolvedValue(1);

      const result = await service.unlockAllSeats(userId, showtimeId);

      expect(result.unlockedSeats).toEqual(['A-1', 'A-2']);

      // Verify del called for each seat lock key
      expect(mockRedis.del).toHaveBeenCalledWith(`seat:${showtimeId}:A-1`);
      expect(mockRedis.del).toHaveBeenCalledWith(`seat:${showtimeId}:A-2`);

      // Verify srem called for locked-seats for each seat
      const lockedSeatsCalls = mockRedis.srem.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).startsWith('locked-seats:'),
      );
      expect(lockedSeatsCalls).toHaveLength(2);

      // Verify broadcast called for each unlocked seat
      expect(mockGateway.broadcastSeatUpdate).toHaveBeenCalledTimes(2);
      expect(mockGateway.broadcastSeatUpdate).toHaveBeenCalledWith(showtimeId, 'A-1', 'available', userId);
      expect(mockGateway.broadcastSeatUpdate).toHaveBeenCalledWith(showtimeId, 'A-2', 'available', userId);

      // Verify user-seats key deleted entirely at the end
      expect(mockRedis.del).toHaveBeenCalledWith(`user-seats:${showtimeId}:${userId}`);
    });

    it('skips seats not owned by user', async () => {
      mockRedis.smembers.mockResolvedValue(['A-1', 'A-2']);
      mockRedis.get
        .mockResolvedValueOnce(userId)        // A-1 owned
        .mockResolvedValueOnce('other-user');  // A-2 NOT owned
      mockRedis.del.mockResolvedValue(1);
      mockRedis.srem.mockResolvedValue(1);

      const result = await service.unlockAllSeats(userId, showtimeId);

      // Only A-1 unlocked
      expect(result.unlockedSeats).toEqual(['A-1']);

      // Verify del called only for A-1
      expect(mockRedis.del).toHaveBeenCalledWith(`seat:${showtimeId}:A-1`);

      // Verify broadcast only for A-1
      expect(mockGateway.broadcastSeatUpdate).toHaveBeenCalledTimes(1);
      expect(mockGateway.broadcastSeatUpdate).toHaveBeenCalledWith(showtimeId, 'A-1', 'available', userId);
    });

    it('returns empty array when no seats locked', async () => {
      mockRedis.smembers.mockResolvedValue([]);

      const result = await service.unlockAllSeats(userId, showtimeId);

      expect(result.unlockedSeats).toEqual([]);
      expect(mockGateway.broadcastSeatUpdate).not.toHaveBeenCalled();
    });
  });

  describe('getSeatStatus', () => {
    it('returns Record of seatId to SeatState combining Redis locks + DB sold records', async () => {
      // Mock Lua eval returning valid locked seats (stale entries cleaned by script)
      mockRedis.eval.mockResolvedValue(['A-1', 'A-2']);

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

      // Verify eval called with GET_VALID_LOCKED_SEATS_LUA pattern
      expect(mockRedis.eval).toHaveBeenCalledOnce();
      const [script, keys, args] = mockRedis.eval.mock.calls[0] as [string, string[], string[]];
      expect(script).toContain('SMEMBERS');
      expect(script).toContain('EXISTS');
      expect(keys).toEqual([`locked-seats:${showtimeId}`]);
      expect(args).toEqual([`seat:${showtimeId}:`]);
    });
  });
});
