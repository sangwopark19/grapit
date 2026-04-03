import { Module } from '@nestjs/common';
import { TossPaymentsClient } from './toss-payments.client.js';
import { PaymentService } from './payment.service.js';

@Module({
  providers: [TossPaymentsClient, PaymentService],
  exports: [TossPaymentsClient, PaymentService],
})
export class PaymentModule {}
