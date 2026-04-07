import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ReservationService } from './reservation.service.js';
import { TossPaymentsClient } from '../payment/toss-payments.client.js';
import type { BookingService } from '../booking/booking.service.js';
import type { BookingGateway } from '../booking/booking.gateway.js';
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

function createMockBookingService() {
  return {
    unlockAllSeats: vi.fn().mockResolvedValue({ unlockedSeats: [] }),
  };
}

function createMockBookingGateway() {
  return {
    broadcastSeatUpdate: vi.fn(),
  };
}

describe('ReservationService', () => {
  let service: ReservationService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockTossClient: ReturnType<typeof createMockTossClient>;
  let mockBookingService: ReturnType<typeof createMockBookingService>;
  let mockBookingGateway: ReturnType<typeof createMockBookingGateway>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockTossClient = createMockTossClient();
    mockBookingService = createMockBookingService();
    mockBookingGateway = createMockBookingGateway();

    service = new ReservationService(
      mockDb as any,
      mockTossClient as unknown as TossPaymentsClient,
      mockBookingService as unknown as BookingService,
      mockBookingGateway as unknown as BookingGateway,
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
      const reservationId = randomUUID();

      // Helper: creates a deeply chainable mock that supports any method sequence
      function createChainMock(resolvedValue: unknown) {
        const handler: ProxyHandler<object> = {
          get(_target, prop) {
            if (prop === 'then') {
              return (resolve: (v: unknown) => void) => resolve(resolvedValue);
            }
            return (..._args: unknown[]) => new Proxy({}, handler);
          },
        };
        return new Proxy({}, handler);
      }

      let selectCall = 0;
      mockDb.select.mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          // Main query: reservations JOIN showtimes JOIN performances LEFT JOIN venues
          return createChainMock([
            {
              reservation: {
                id: reservationId,
                reservationNumber: 'GRP-20260403-ABCDE',
                status: 'CONFIRMED',
                totalAmount: 150000,
                createdAt: new Date(),
              },
              showtime: { dateTime: new Date() },
              performance: { title: '테스트 공연', posterUrl: null },
              venue: { name: '테스트 극장' },
            },
          ]);
        }
        // Subsequent calls = seats sub-query
        return createChainMock([
          { seatId: 'A-1', tierName: 'VIP', price: 100000, row: 'A', number: '1' },
        ]);
      });

      const result = await service.getMyReservations(userId, 'CONFIRMED');
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0]?.performanceTitle).toBe('테스트 공연');
    });
  });

  describe('cancel', () => {
    it('should succeed when cancelling before deadline', async () => {
      const reservationId = randomUUID();
      const userId = randomUUID();
      const showtimeId = randomUUID();
      const futureDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Mock: get reservation
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            id: reservationId,
            userId,
            showtimeId,
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

      // Mock: transaction for status updates + seat restoration
      mockDb.transaction.mockImplementation(async (cb: (tx: any) => Promise<void>) => {
        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        };
        return cb(mockTx);
      });

      // Mock: post-transaction select for WS broadcast
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
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

  describe('confirmAndCreateReservation - seat sold marking', () => {
    const userId = randomUUID();
    const reservationId = randomUUID();
    const showtimeId = randomUUID();
    const orderId = 'GRP-20260407-ABCDE';

    function setupConfirmMocks() {
      // 1st select: check existing payment (none)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      // 2nd select: get reservation by orderId + userId
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            id: reservationId,
            userId,
            showtimeId,
            tossOrderId: orderId,
            status: 'PENDING_PAYMENT',
            totalAmount: 150000,
          }]),
        }),
      });

      // Track all tx operations
      const txOps: { operation: string; args: unknown[] }[] = [];
      const mockTx = {
        update: vi.fn().mockImplementation((...args: unknown[]) => {
          txOps.push({ operation: 'update', args });
          return {
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          };
        }),
        insert: vi.fn().mockImplementation((...args: unknown[]) => {
          txOps.push({ operation: 'insert', args });
          return {
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: randomUUID() }]),
            }),
          };
        }),
        select: vi.fn().mockImplementation(() => {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { seatId: 'A-1' },
                { seatId: 'A-2' },
              ]),
            }),
          };
        }),
      };

      mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
        return cb(mockTx);
      });

      // After-transaction select for seats (for WS broadcast)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { seatId: 'A-1' },
            { seatId: 'A-2' },
          ]),
        }),
      });

      // getReservationDetail mocks (called at the end of confirm)
      // select reservation join
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{
                  reservation: {
                    id: reservationId,
                    userId,
                    reservationNumber: 'GRP-20260407-ABCDE',
                    status: 'CONFIRMED',
                    totalAmount: 150000,
                    cancelDeadline: new Date(),
                    cancelledAt: null,
                    cancelReason: null,
                    createdAt: new Date(),
                  },
                  showtime: { dateTime: new Date() },
                  performance: { title: '테스트 공연', posterUrl: null },
                  venue: { name: '테스트 극장' },
                }]),
              }),
            }),
          }),
        }),
      });

      // select reservation seats
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { seatId: 'A-1', tierName: 'VIP', price: 100000, row: 'A', number: '1' },
            { seatId: 'A-2', tierName: 'VIP', price: 50000, row: 'A', number: '2' },
          ]),
        }),
      });

      // select payment
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            paymentKey: 'pk_test_123',
            method: '카드',
            paidAt: new Date(),
          }]),
        }),
      });

      return { mockTx, txOps };
    }

    it('should update seat_inventories to sold within the transaction', async () => {
      const { mockTx } = setupConfirmMocks();

      await service.confirmAndCreateReservation(
        { paymentKey: 'pk_test_123', orderId, amount: 150000 },
        userId,
      );

      // tx.select should have been called for reservation seats
      expect(mockTx.select).toHaveBeenCalled();
      // tx.update should be called for reservation status AND seat_inventories (at least 3 calls: 1 for reservation + 2 for seats)
      expect(mockTx.update.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('should call BookingService.unlockAllSeats after transaction', async () => {
      setupConfirmMocks();

      await service.confirmAndCreateReservation(
        { paymentKey: 'pk_test_123', orderId, amount: 150000 },
        userId,
      );

      expect(mockBookingService.unlockAllSeats).toHaveBeenCalledWith(userId, showtimeId);
    });

    it('should call BookingGateway.broadcastSeatUpdate with sold for each seat', async () => {
      setupConfirmMocks();

      await service.confirmAndCreateReservation(
        { paymentKey: 'pk_test_123', orderId, amount: 150000 },
        userId,
      );

      expect(mockBookingGateway.broadcastSeatUpdate).toHaveBeenCalledWith(showtimeId, 'A-1', 'sold', userId);
      expect(mockBookingGateway.broadcastSeatUpdate).toHaveBeenCalledWith(showtimeId, 'A-2', 'sold', userId);
    });
  });

  describe('cancelReservation - seat available restoration', () => {
    it('should update seat_inventories to available within cancel transaction', async () => {
      const reservationId = randomUUID();
      const userId = randomUUID();
      const showtimeId = randomUUID();
      const futureDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // 1st select: get reservation
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            id: reservationId,
            userId,
            showtimeId,
            status: 'CONFIRMED',
            cancelDeadline: futureDeadline,
          }]),
        }),
      });

      // 2nd select: get payment
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            id: randomUUID(),
            paymentKey: 'pk_test_123',
          }]),
        }),
      });

      // Track tx operations
      const mockTx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { seatId: 'A-1' },
              { seatId: 'A-2' },
            ]),
          }),
        }),
      };

      mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
        return cb(mockTx);
      });

      // After-transaction select for WS broadcast
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { seatId: 'A-1' },
            { seatId: 'A-2' },
          ]),
        }),
      });

      await service.cancelReservation(reservationId, userId, '단순 변심');

      // tx.select should have been called to get cancelled seats
      expect(mockTx.select).toHaveBeenCalled();
      // tx.update should be called for reservation, payment, AND seat_inventories (at least 4: reservation + payment + 2 seats)
      expect(mockTx.update.mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    it('should call BookingGateway.broadcastSeatUpdate with available for each cancelled seat', async () => {
      const reservationId = randomUUID();
      const userId = randomUUID();
      const showtimeId = randomUUID();
      const futureDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            id: reservationId,
            userId,
            showtimeId,
            status: 'CONFIRMED',
            cancelDeadline: futureDeadline,
          }]),
        }),
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            id: randomUUID(),
            paymentKey: 'pk_test_123',
          }]),
        }),
      });

      const mockTx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { seatId: 'B-1' },
              { seatId: 'B-2' },
            ]),
          }),
        }),
      };

      mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
        return cb(mockTx);
      });

      // After-transaction select for WS broadcast
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { seatId: 'B-1' },
            { seatId: 'B-2' },
          ]),
        }),
      });

      await service.cancelReservation(reservationId, userId, '단순 변심');

      expect(mockBookingGateway.broadcastSeatUpdate).toHaveBeenCalledWith(showtimeId, 'B-1', 'available');
      expect(mockBookingGateway.broadcastSeatUpdate).toHaveBeenCalledWith(showtimeId, 'B-2', 'available');
    });
  });
});
