import { Module } from '@nestjs/common';
import { BookingModule } from '../booking/booking.module.js';
import { PerformanceController } from './performance.controller.js';
import { PerformanceService } from './performance.service.js';
import { CacheService } from './cache.service.js';

@Module({
  imports: [BookingModule],
  controllers: [PerformanceController],
  providers: [PerformanceService, CacheService],
  exports: [PerformanceService, CacheService],
})
export class PerformanceModule {}
