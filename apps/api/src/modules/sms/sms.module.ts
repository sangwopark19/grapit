import { Module } from '@nestjs/common';
import { BookingModule } from '../booking/booking.module.js';
import { SmsService } from './sms.service.js';
import { SmsController } from './sms.controller.js';

@Module({
  imports: [BookingModule],          // REDIS_CLIENT re-export를 통해 SmsService에 주입 가능
  controllers: [SmsController],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
