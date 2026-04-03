import { Module } from '@nestjs/common';
import { PaymentModule } from '../payment/payment.module.js';
import { ReservationController } from './reservation.controller.js';
import { ReservationService } from './reservation.service.js';

@Module({
  imports: [PaymentModule],
  controllers: [ReservationController],
  providers: [ReservationService],
  exports: [ReservationService],
})
export class ReservationModule {}
