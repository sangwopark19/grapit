import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';
import { RedisHealthIndicator } from './redis.health.indicator.js';
import { BookingModule } from '../modules/booking/booking.module.js';

@Module({
  imports: [TerminusModule, BookingModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
