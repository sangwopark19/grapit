import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ReservationService } from './reservation.service.js';
import { TossPaymentsClient } from '../payment/toss-payments.client.js';
import type { BookingService } from '../booking/booking.service.js';
import type { BookingGateway } from '../booking/booking.gateway.js';
import type { SeatSelection } from '@grabit/shared';

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
    assertOwnedSeatLocks: vi.fn().mockResolvedValue(undefined),
    consumeOwnedSeatLocks: vi.fn().mockResolvedValue({ consumedSeatIds: [] }),
    acquirePaymentConfirmLock: vi.fn().mockResolvedValue(true),
    releasePaymentConfirmLock: vi.fn().mockResolvedValue(undefined),
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

  const LOCK_EXPIRED_MESSAGE = '좌석 점유 시간이 만료되었습니다. 좌석을 다시 선택해주세요.';
  const LOCK_OTHER_OWNER_MESSAGE = '이미 다른 사용자가 선택한 좌석입니다.';

  function seatSelection(seatId: string): SeatSelection {
    const [, number = '1'] = seatId.split('-');
    return { seatId, tierName: 'VIP', price: 50000, row: 'A', number };
  }

  function chainResult<T>(rows: T[]) {
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
      }),
    };
  }

  function setupPrepareBase(dto: {
    showtimeId: string;
    orderId: string;
    seats: SeatSelection[];
    amount: number;
  }) {
    mockDb.select
      .mockReturnValueOnce(chainResult([]))
      .mockReturnValueOnce(chainResult([{ id: dto.showtimeId, performanceId: 'performance-1', dateTime: new Date() }]))
      .mockReturnValueOnce(chainResult([{ tierName: 'VIP', price: 50000 }]));

    mockDb.transaction.mockResolvedValue({
      id: 'reservation-created',
      tossOrderId: dto.orderId,
    });
  }

  function setupExistingPendingOrder(dto: {
    showtimeId: string;
    orderId: string;
    userId: string;
  }) {
    mockDb.select
      .mockReturnValueOnce(chainResult([{
        id: 'reservation-existing',
        userId: dto.userId,
        tossOrderId: dto.orderId,
        showtimeId: dto.showtimeId,
        status: 'PENDING_PAYMENT',
      }]))
      .mockReturnValueOnce(chainResult([
        { seatId: 'A-1', tierName: 'VIP', price: 50000, row: 'A', number: '1' },
        { seatId: 'A-2', tierName: 'VIP', price: 50000, row: 'A', number: '2' },
      ]));
  }

  function setupConfirmReservationBase(args: {
    reservationId: string;
    showtimeId: string;
    orderId: string;
    userId: string;
    amount: number;
    seats?: string[];
  }) {
    const seats = args.seats ?? ['A-1', 'A-2'];
    mockDb.select
      .mockReturnValueOnce(chainResult([]))
      .mockReturnValueOnce(chainResult([{
        id: args.reservationId,
        userId: args.userId,
        showtimeId: args.showtimeId,
        tossOrderId: args.orderId,
        status: 'PENDING_PAYMENT',
        totalAmount: args.amount,
      }]))
      .mockReturnValueOnce(chainResult(seats.map((seatId) => ({ seatId }))));
  }

  function setupReservationDetailMocks(args: {
    reservationId: string;
    userId: string;
    amount: number;
    seats?: string[];
  }) {
    const seats = args.seats ?? ['A-1', 'A-2'];
    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{
                  reservation: {
                    id: args.reservationId,
                    userId: args.userId,
                    reservationNumber: 'GRP-20260429-LOCKS',
                    status: 'CONFIRMED',
                    totalAmount: args.amount,
                    cancelDeadline: new Date(),
                    cancelledAt: null,
                    cancelReason: null,
                    createdAt: new Date(),
                  },
                  showtime: { dateTime: new Date() },
                  performance: { title: '락 테스트 공연', posterUrl: null },
                  venue: { name: '락 테스트 극장' },
                }]),
              }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce(chainResult(seats.map((seatId) => ({
        seatId,
        tierName: 'VIP',
        price: 50000,
        row: 'A',
        number: seatId.split('-')[1] ?? '1',
      }))))
      .mockReturnValueOnce(chainResult([{
        paymentKey: 'pk_test_123',
        method: '카드',
        paidAt: new Date(),
      }]));
  }

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

  describe('prepareReservation - lock ownership', () => {
    it('prepareReservation checks active locks before creating a new pending reservation', async () => {
      const userId = randomUUID();
      const dto = {
        showtimeId: randomUUID(),
        orderId: 'GRP-LOCK-PREPARE-SUCCESS',
        seats: [seatSelection('A-1'), seatSelection('A-2')],
        amount: 100000,
      };
      setupPrepareBase(dto);

      await expect(service.prepareReservation(dto, userId))
        .resolves
        .toEqual({ reservationId: 'reservation-created', orderId: dto.orderId });

      expect(mockBookingService.assertOwnedSeatLocks).toHaveBeenCalledWith(userId, dto.showtimeId, ['A-1', 'A-2']);
      expect(mockDb.transaction).toHaveBeenCalledOnce();
      expect(mockBookingService.assertOwnedSeatLocks.mock.invocationCallOrder[0])
        .toBeLessThan(mockDb.transaction.mock.invocationCallOrder[0]!);
    });

    it('prepareReservation rejects missing active lock before creating pending reservation', async () => {
      const userId = randomUUID();
      const dto = {
        showtimeId: randomUUID(),
        orderId: 'GRP-LOCK-PREPARE-MISSING',
        seats: [seatSelection('A-1')],
        amount: 50000,
      };
      setupPrepareBase(dto);
      mockBookingService.assertOwnedSeatLocks.mockRejectedValueOnce(
        new ConflictException(LOCK_EXPIRED_MESSAGE),
      );

      await expect(service.prepareReservation(dto, userId))
        .rejects
        .toThrow(LOCK_EXPIRED_MESSAGE);

      expect(mockBookingService.assertOwnedSeatLocks).toHaveBeenCalledWith(userId, dto.showtimeId, ['A-1']);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('prepareReservation rejects other-user lock before creating pending reservation', async () => {
      const userId = randomUUID();
      const dto = {
        showtimeId: randomUUID(),
        orderId: 'GRP-LOCK-PREPARE-OTHER',
        seats: [seatSelection('A-2')],
        amount: 50000,
      };
      setupPrepareBase(dto);
      mockBookingService.assertOwnedSeatLocks.mockRejectedValueOnce(
        new ConflictException(LOCK_OTHER_OWNER_MESSAGE),
      );

      await expect(service.prepareReservation(dto, userId))
        .rejects
        .toThrow(LOCK_OTHER_OWNER_MESSAGE);

      expect(mockBookingService.assertOwnedSeatLocks).toHaveBeenCalledWith(userId, dto.showtimeId, ['A-2']);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('Existing pending order cannot bypass active lock ownership', async () => {
      const userId = randomUUID();
      const dto = {
        showtimeId: randomUUID(),
        orderId: 'GRP-LOCK-IDEMPOTENT-PENDING',
        seats: [seatSelection('A-1')],
        amount: 50000,
      };
      setupExistingPendingOrder({ ...dto, userId });
      mockBookingService.assertOwnedSeatLocks.mockRejectedValueOnce(
        new ConflictException(LOCK_EXPIRED_MESSAGE),
      );

      await expect(service.prepareReservation(dto, userId))
        .rejects
        .toThrow(LOCK_EXPIRED_MESSAGE);

      expect(mockBookingService.assertOwnedSeatLocks).toHaveBeenCalledWith(userId, dto.showtimeId, ['A-1', 'A-2']);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('prepareReservation rejects another user existing pending orderId', async () => {
      const userId = randomUUID();
      const otherUserId = randomUUID();
      const dto = {
        showtimeId: randomUUID(),
        orderId: 'GRP-LOCK-IDEMPOTENT-OTHER-USER',
        seats: [seatSelection('A-1')],
        amount: 50000,
      };
      setupExistingPendingOrder({ ...dto, userId: otherUserId });

      await expect(service.prepareReservation(dto, userId))
        .rejects
        .toThrow('예매 정보를 찾을 수 없습니다. 다시 시도해주세요.');

      expect(mockBookingService.assertOwnedSeatLocks).not.toHaveBeenCalled();
      expect(mockDb.transaction).not.toHaveBeenCalled();
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
    it('should succeed when cancelling before deadline with SELECT FOR UPDATE', async () => {
      const reservationId = randomUUID();
      const userId = randomUUID();
      const showtimeId = randomUUID();
      const futureDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Mock: transaction with SELECT FOR UPDATE + payment query + updates
      mockDb.transaction.mockImplementation(async (cb: (tx: Record<string, unknown>) => Promise<void>) => {
        const mockTx = {
          execute: vi.fn().mockResolvedValue({
            rows: [{
              id: reservationId,
              user_id: userId,
              showtime_id: showtimeId,
              status: 'CONFIRMED',
              cancel_deadline: futureDeadline,
            }],
          }),
          select: vi.fn().mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{
                id: randomUUID(),
                paymentKey: 'pk_test_123',
              }]),
            }),
          }).mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
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

      expect(mockTossClient.cancelPayment).toHaveBeenCalledWith('pk_test_123', '단순 변심');
    });
  });

  describe('deadline', () => {
    it('should reject cancellation after deadline', async () => {
      const reservationId = randomUUID();
      const userId = randomUUID();
      const pastDeadline = new Date(Date.now() - 24 * 60 * 60 * 1000);

      mockDb.transaction.mockImplementation(async (cb: (tx: Record<string, unknown>) => Promise<void>) => {
        const mockTx = {
          execute: vi.fn().mockResolvedValue({
            rows: [{
              id: reservationId,
              user_id: userId,
              showtime_id: randomUUID(),
              status: 'CONFIRMED',
              cancel_deadline: pastDeadline,
            }],
          }),
        };
        return cb(mockTx);
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

      // 3rd select: pending reservation seats for ownership assertion/consume
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { seatId: 'A-1' },
            { seatId: 'A-2' },
          ]),
        }),
      });

      // Track all tx operations
      const txOps: { operation: string; args: unknown[] }[] = [];
      const mockTx = {
        update: vi.fn().mockImplementation((...args: unknown[]) => {
          txOps.push({ operation: 'update', args });
          return {
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: randomUUID() }]),
              }),
            }),
          };
        }),
        insert: vi.fn().mockImplementation((...args: unknown[]) => {
          txOps.push({ operation: 'insert', args });
          return {
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: randomUUID() }]),
              onConflictDoNothing: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: randomUUID() }]),
              }),
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

      // tx.update should be called for reservation status AND seat_inventories (at least 3 calls: 1 for reservation + 2 for seats)
      expect(mockTx.update.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(mockBookingService.consumeOwnedSeatLocks.mock.invocationCallOrder[0])
        .toBeGreaterThan(mockDb.transaction.mock.invocationCallOrder[0]!);
    });

    it('should not call BookingService.unlockAllSeats after confirm success', async () => {
      setupConfirmMocks();

      await service.confirmAndCreateReservation(
        { paymentKey: 'pk_test_123', orderId, amount: 150000 },
        userId,
      );

      expect(mockBookingService.unlockAllSeats).not.toHaveBeenCalledWith(userId, showtimeId);
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

  describe('confirmAndCreateReservation - lock ownership', () => {
    const userId = randomUUID();
    const reservationId = randomUUID();
    const showtimeId = randomUUID();
    const orderId = 'GRP-LOCK-CONFIRM-ABCDE';

    it('rejects concurrent confirm for the same orderId before reading payment state', async () => {
      mockBookingService.acquirePaymentConfirmLock.mockResolvedValueOnce(false);

      await expect(service.confirmAndCreateReservation(
        { paymentKey: 'pk_test_123', orderId, amount: 150000 },
        userId,
      )).rejects.toThrow('결제 확인이 이미 진행 중입니다.');

      expect(mockDb.select).not.toHaveBeenCalled();
      expect(mockTossClient.confirmPayment).not.toHaveBeenCalled();
      expect(mockBookingService.releasePaymentConfirmLock).not.toHaveBeenCalled();
    });

    it('confirmAndCreateReservation rejects invalid locks before Toss confirm', async () => {
      setupConfirmReservationBase({
        reservationId,
        showtimeId,
        orderId,
        userId,
        amount: 150000,
      });
      mockBookingService.assertOwnedSeatLocks.mockRejectedValueOnce(
        new ConflictException(LOCK_EXPIRED_MESSAGE),
      );
      mockDb.transaction.mockResolvedValue(undefined);
      setupReservationDetailMocks({ reservationId, userId, amount: 150000 });

      await expect(service.confirmAndCreateReservation(
        { paymentKey: 'pk_test_123', orderId, amount: 150000 },
        userId,
      )).rejects.toThrow(LOCK_EXPIRED_MESSAGE);

      expect(mockBookingService.assertOwnedSeatLocks).toHaveBeenCalledWith(userId, showtimeId, ['A-1', 'A-2']);
      expect(mockTossClient.confirmPayment).not.toHaveBeenCalled();
      expect(mockDb.transaction).not.toHaveBeenCalled();
      const lockToken = mockBookingService.acquirePaymentConfirmLock.mock.calls[0]?.[1];
      expect(mockBookingService.releasePaymentConfirmLock).toHaveBeenCalledWith(orderId, lockToken);
    });

    it('confirmAndCreateReservation keeps confirmed reservation when post-commit lock cleanup fails', async () => {
      setupConfirmReservationBase({
        reservationId,
        showtimeId,
        orderId,
        userId,
        amount: 150000,
      });
      setupReservationDetailMocks({ reservationId, userId, amount: 150000 });
      mockBookingService.consumeOwnedSeatLocks.mockRejectedValueOnce(
        new ConflictException(LOCK_OTHER_OWNER_MESSAGE),
      );
      mockDb.transaction.mockResolvedValue(undefined);

      await expect(service.confirmAndCreateReservation(
        { paymentKey: 'pk_test_123', orderId, amount: 150000 },
        userId,
      )).resolves.toMatchObject({ id: reservationId });

      expect(mockTossClient.confirmPayment).toHaveBeenCalledOnce();
      expect(mockBookingService.consumeOwnedSeatLocks).toHaveBeenCalledWith(userId, showtimeId, ['A-1', 'A-2']);
      expect(mockTossClient.cancelPayment).not.toHaveBeenCalled();
      expect(mockDb.transaction).toHaveBeenCalledOnce();
      const lockToken = mockBookingService.acquirePaymentConfirmLock.mock.calls[0]?.[1];
      expect(mockBookingService.releasePaymentConfirmLock).toHaveBeenCalledWith(orderId, lockToken);
    });

    it('cancels Toss and rejects when conditional sold transition detects an already sold seat', async () => {
      setupConfirmReservationBase({
        reservationId,
        showtimeId,
        orderId,
        userId,
        amount: 150000,
      });

      const mockTx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]),
            }),
            returning: vi.fn().mockResolvedValue([{ id: randomUUID() }]),
          }),
        }),
      };
      mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

      await expect(service.confirmAndCreateReservation(
        { paymentKey: 'pk_test_123', orderId, amount: 150000 },
        userId,
      )).rejects.toThrow('이미 판매된 좌석입니다');

      expect(mockTossClient.confirmPayment).toHaveBeenCalledOnce();
      expect(mockTossClient.cancelPayment).toHaveBeenCalledWith('pk_test_123', '서버 오류로 인한 자동 취소');
      expect(mockBookingService.consumeOwnedSeatLocks).not.toHaveBeenCalled();
      expect(mockBookingGateway.broadcastSeatUpdate).not.toHaveBeenCalled();
      const lockToken = mockBookingService.acquirePaymentConfirmLock.mock.calls[0]?.[1];
      expect(mockBookingService.releasePaymentConfirmLock).toHaveBeenCalledWith(orderId, lockToken);
    });

    it('existing payment idempotency returns detail without active lock ownership check', async () => {
      mockDb.select
        .mockReturnValueOnce(chainResult([{ reservationId, tossOrderId: orderId }]));
      setupReservationDetailMocks({ reservationId, userId, amount: 150000 });

      await expect(service.confirmAndCreateReservation(
        { paymentKey: 'pk_test_123', orderId, amount: 150000 },
        userId,
      )).resolves.toMatchObject({ id: reservationId });

      expect(mockBookingService.assertOwnedSeatLocks).not.toHaveBeenCalled();
      expect(mockBookingService.consumeOwnedSeatLocks).not.toHaveBeenCalled();
      expect(mockTossClient.confirmPayment).not.toHaveBeenCalled();
      const lockToken = mockBookingService.acquirePaymentConfirmLock.mock.calls[0]?.[1];
      expect(mockBookingService.releasePaymentConfirmLock).toHaveBeenCalledWith(orderId, lockToken);
    });
  });

  describe('cancelReservation - seat available restoration', () => {
    it('should update seat_inventories to available within cancel transaction', async () => {
      const reservationId = randomUUID();
      const userId = randomUUID();
      const showtimeId = randomUUID();
      const futureDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Track tx operations
      const mockTx = {
        execute: vi.fn().mockResolvedValue({
          rows: [{
            id: reservationId,
            user_id: userId,
            showtime_id: showtimeId,
            status: 'CONFIRMED',
            cancel_deadline: futureDeadline,
          }],
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        select: vi.fn().mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{
              id: randomUUID(),
              paymentKey: 'pk_test_123',
            }]),
          }),
        }).mockReturnValue({
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

      // tx.execute should have been called for SELECT FOR UPDATE
      expect(mockTx.execute).toHaveBeenCalled();
      // tx.update should be called for reservation, payment, AND seat_inventories (at least 4: reservation + payment + 2 seats)
      expect(mockTx.update.mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    it('should call BookingGateway.broadcastSeatUpdate with available for each cancelled seat', async () => {
      const reservationId = randomUUID();
      const userId = randomUUID();
      const showtimeId = randomUUID();
      const futureDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const mockTx = {
        execute: vi.fn().mockResolvedValue({
          rows: [{
            id: reservationId,
            user_id: userId,
            showtime_id: showtimeId,
            status: 'CONFIRMED',
            cancel_deadline: futureDeadline,
          }],
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        select: vi.fn().mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{
              id: randomUUID(),
              paymentKey: 'pk_test_123',
            }]),
          }),
        }).mockReturnValue({
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
