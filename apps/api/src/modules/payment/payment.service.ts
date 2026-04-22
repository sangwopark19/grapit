import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.provider.js';
import { payments } from '../../database/schema/index.js';
import type { PaymentInfo, PaymentStatus } from '@grabit/shared';

@Injectable()
export class PaymentService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async getPaymentByReservationId(reservationId: string): Promise<PaymentInfo | null> {
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.reservationId, reservationId));

    if (!payment) {
      return null;
    }

    return {
      paymentKey: payment.paymentKey,
      method: payment.method,
      amount: payment.amount,
      status: payment.status as PaymentStatus,
      paidAt: payment.paidAt?.toISOString() ?? null,
    };
  }
}
