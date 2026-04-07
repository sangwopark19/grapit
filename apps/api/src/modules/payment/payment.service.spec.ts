import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PaymentService } from './payment.service.js';

function createMockDb() {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };
}

describe('PaymentService', () => {
  let service: PaymentService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new PaymentService(mockDb as any);
  });

  describe('amount validation', () => {
    it('should reject when server-calculated amount differs from client amount', async () => {
      const reservationId = randomUUID();

      // Mock: payment lookup returns existing payment with amount 150000
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            id: randomUUID(),
            reservationId,
            paymentKey: 'pk_test_123',
            tossOrderId: 'GRP-20260403-ABCDE',
            method: '카드',
            amount: 150000,
            status: 'DONE',
            paidAt: new Date(),
            createdAt: new Date(),
          }]),
        }),
      });

      const result = await service.getPaymentByReservationId(reservationId);
      expect(result).not.toBeNull();
      expect(result!.amount).toBe(150000);
    });
  });

  describe('failure', () => {
    it('should return null for non-existent reservation payment', async () => {
      const reservationId = randomUUID();

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.getPaymentByReservationId(reservationId);
      expect(result).toBeNull();
    });
  });
});
