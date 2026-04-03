import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { AdminBookingService } from './admin-booking.service.js';
import { TossPaymentsClient } from '../payment/toss-payments.client.js';

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
    confirmPayment: vi.fn(),
    cancelPayment: vi.fn().mockResolvedValue({
      paymentKey: 'pk_test_123',
      orderId: 'GRP-20260403-ABCDE',
      method: '카드',
      totalAmount: 150000,
      status: 'CANCELED',
      approvedAt: '2026-04-03T10:00:00+09:00',
      cancels: [{ cancelAmount: 150000, cancelReason: '관리자 환불', canceledAt: '2026-04-03T11:00:00+09:00' }],
    }),
  };
}

describe('AdminBookingService', () => {
  let service: AdminBookingService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockTossClient: ReturnType<typeof createMockTossClient>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockTossClient = createMockTossClient();

    service = new AdminBookingService(
      mockDb as any,
      mockTossClient as unknown as TossPaymentsClient,
    );
  });

  describe('list', () => {
    it('should return bookings with stats (totalBookings, totalRevenue, cancelRate)', async () => {
      // Mock: stats query (3 separate count/sum queries)
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 10 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ sum: 1500000 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 2 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        offset: vi.fn().mockResolvedValue([]),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        });

      const result = await service.getBookings({});
      expect(result).toHaveProperty('stats');
      expect(result.stats).toHaveProperty('totalBookings');
      expect(result.stats).toHaveProperty('totalRevenue');
      expect(result.stats).toHaveProperty('cancelRate');
      expect(result.stats.totalBookings).toBe(10);
      expect(result.stats.totalRevenue).toBe(1500000);
      expect(result.stats.cancelRate).toBe(20); // 2/10 * 100
    });
  });
});
