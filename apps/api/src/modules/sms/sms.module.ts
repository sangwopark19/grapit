import { Module } from '@nestjs/common';
import { SmsService } from './sms.service.js';
import { SmsController } from './sms.controller.js';

@Module({
  controllers: [SmsController],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
