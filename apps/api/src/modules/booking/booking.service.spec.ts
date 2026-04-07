import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BookingService } from './booking.service.js';
import type { BookingGateway } from './booking.gateway.js';

function createMockRedis() {
  return {
    eval: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    srem: vi.fn(),
    smembers: vi.fn(),
  };
}

function createMockDb() {
  return {
    select: vi.fn(),
  };
}

function createMockGateway() {
  return {
    broadcastSeatUpdate: vi.fn(),
  };
}

describe('BookingService - lockSeat sold defense', () => {
  let service: BookingService;
  let mockRedis: ReturnType<typeof createMockRedis>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockGateway: ReturnType<typeof createMockGateway>;

  const userId = randomUUID();
  const showtimeId = randomUUID();
  const seatId = 'A-1';

  beforeEach(() => {
    mockRedis = createMockRedis();
    mockDb = createMockDb();
    mockGateway = createMockGateway();

    service = new BookingService(
      mockRedis as any,
      mockDb as any,
      mockGateway as unknown as BookingGateway,
    );
  });

  it('should throw ConflictException when seat_inventories has status=sold', async () => {
    // DB returns a sold record (persistent mock for multiple assertions)
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: randomUUID() }]),
      }),
    });

    await expect(service.lockSeat(userId, showtimeId, seatId))
      .rejects.toThrow(ConflictException);

    await expect(service.lockSeat(userId, showtimeId, seatId))
      .rejects.toThrow('이미 판매된 좌석입니다');

    // Redis should never be called
    expect(mockRedis.eval).not.toHaveBeenCalled();
  });

  it('should proceed to Redis lock when no sold record exists in seat_inventories', async () => {
    // DB returns no sold record
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    // Redis eval returns success
    mockRedis.eval.mockResolvedValue([1, `seat:${showtimeId}:${seatId}`, seatId]);

    const result = await service.lockSeat(userId, showtimeId, seatId);

    expect(result.success).toBe(true);
    expect(result.seatId).toBe(seatId);
    expect(mockRedis.eval).toHaveBeenCalled();
  });

  it('should proceed normally when seat_inventories record exists with status=available', async () => {
    // DB returns empty (no sold record found - the query filters by status='sold')
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    // Redis eval returns success
    mockRedis.eval.mockResolvedValue([1, `seat:${showtimeId}:${seatId}`, seatId]);

    const result = await service.lockSeat(userId, showtimeId, seatId);

    expect(result.success).toBe(true);
    expect(mockRedis.eval).toHaveBeenCalled();
    expect(mockGateway.broadcastSeatUpdate).toHaveBeenCalledWith(showtimeId, seatId, 'locked', userId);
  });
});
