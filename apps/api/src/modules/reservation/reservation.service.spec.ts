import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ReservationService } from './reservation.service.js';
import { TossPaymentsClient } from '../payment/toss-payments.client.js';
import type { SeatSelection } from '@grapit/shared';

function createMockDb() {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  };
}

function createMockTossClient() {
  return {
    confirmPayment: vi.fn().mockResolvedValue({
      paymentKey: 'pk_test_123',
      orderId: 'GRP-20260403-ABCDE',
      method: '카드',
      totalAmount: 150000,
      status: 'DONE',
      approvedAt: '2026-04-03T10:00:00+09:00',
    }),
    cancelPayment: vi.fn().mockResolvedValue({
      paymentKey: 'pk_test_123',
      orderId: 'GRP-20260403-ABCDE',
      method: '카드',
      totalAmount: 150000,
      status: 'CANCELED',
      approvedAt: '2026-04-03T10:00:00+09:00',
      cancels: [{ cancelAmount: 150000, cancelReason: '단순 변심', canceledAt: '2026-04-03T11:00:00+09:00' }],
    }),
  };
}

describe('ReservationService', () => {
  let service: ReservationService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockTossClient: ReturnType<typeof createMockTossClient>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockTossClient = createMockTossClient();

    service = new ReservationService(
      mockDb as any,
      mockTossClient as unknown as TossPaymentsClient,
    );
  });

  describe('reservation number', () => {
    it('should generate reservation number matching GRP-YYYYMMDD-XXXXX format', () => {
      const result = service.generateReservationNumber();
      expect(result).toMatch(/^GRP-\d{8}-[A-Z0-9]{5}$/);
    });
  });

  describe('amount calculation', () => {
    it('should sum prices from price_tiers for given seat selections', async () => {
      const performanceId = randomUUID();
      const seats: SeatSelection[] = [
        { seatId: 'A-1', tierName: 'VIP', price: 100000, row: 'A', number: '1' },
        { seatId: 'A-2', tierName: 'VIP', price: 100000, row: 'A', number: '2' },
        { seatId: 'B-1', tierName: 'R', price: 80000, row: 'B', number: '1' },
      ];

      // Mock: priceTiers query returns VIP=100000, R=80000
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: randomUUID(), performanceId, tierName: 'VIP', price: 100000, sortOrder: 0 },
            { id: randomUUID(), performanceId, tierName: 'R', price: 80000, sortOrder: 1 },
          ]),
        }),
      });

      const result = await service.calculateTotalAmount(seats, performanceId);
      expect(result).toBe(280000); // 100000 + 100000 + 80000
    });

    it('should throw BadRequestException for invalid tier ID', async () => {
      const performanceId = randomUUID();
      const seats: SeatSelection[] = [
        { seatId: 'A-1', tierName: 'NONEXISTENT', price: 100000, row: 'A', number: '1' },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: randomUUID(), performanceId, tierName: 'VIP', price: 100000, sortOrder: 0 },
          ]),
        }),
      });

      await expect(service.calculateTotalAmount(seats, performanceId))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('list', () => {
    it('should return filtered reservations by status for given userId', async () => {
      const userId = randomUUID();

      // Mock transaction for getMyReservations
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue([
                    {
                      reservation: {
                        id: randomUUID(),
                        reservationNumber: 'GRP-20260403-ABCDE',
                        status: 'CONFIRMED',
                        totalAmount: 150000,
                        createdAt: new Date(),
                      },
                      showtime: { dateTime: new Date() },
                      performance: { title: '테스트 공연', posterUrl: null },
                      venue: { name: '테스트 극장' },
                    },
                  ]),
                }),
              }),
            }),
          }),
        }),
      });

      // Mock for seats sub-query
      const originalSelect = mockDb.select;
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return originalSelect.getMockImplementation()?.() ?? originalSelect();
        }
        // Second call = seats query
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { seatId: 'A-1', tierName: 'VIP', price: 100000, row: 'A', number: '1' },
            ]),
          }),
        };
      });

      const result = await service.getMyReservations(userId, 'CONFIRMED');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('cancel', () => {
    it('should succeed when cancelling before deadline', async () => {
      const reservationId = randomUUID();
      const userId = randomUUID();
      const futureDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Mock: get reservation
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            id: reservationId,
            userId,
            status: 'CONFIRMED',
            cancelDeadline: futureDeadline,
          }]),
        }),
      });

      // Mock: get payment
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            id: randomUUID(),
            paymentKey: 'pk_test_123',
          }]),
        }),
      });

      // Mock: transaction for status updates
      mockDb.transaction.mockImplementation(async (cb: (tx: any) => Promise<void>) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        };
        return cb(mockTx);
      });

      await expect(service.cancelReservation(reservationId, userId, '단순 변심'))
        .resolves.not.toThrow();
    });
  });

  describe('deadline', () => {
    it('should reject cancellation after deadline', async () => {
      const reservationId = randomUUID();
      const userId = randomUUID();
      const pastDeadline = new Date(Date.now() - 24 * 60 * 60 * 1000);

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            id: reservationId,
            userId,
            status: 'CONFIRMED',
            cancelDeadline: pastDeadline,
          }]),
        }),
      });

      await expect(service.cancelReservation(reservationId, userId, '단순 변심'))
        .rejects.toThrow(ForbiddenException);
    });
  });
});
