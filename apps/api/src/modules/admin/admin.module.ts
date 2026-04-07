import { Module } from '@nestjs/common';
import { PerformanceModule } from '../performance/performance.module.js';
import { PaymentModule } from '../payment/payment.module.js';
import { BookingModule } from '../booking/booking.module.js';
import { AdminPerformanceController } from './admin-performance.controller.js';
import { AdminBannerController } from './admin-banner.controller.js';
import { AdminBookingController } from './admin-booking.controller.js';
import { LocalUploadController } from './local-upload.controller.js';
import { AdminService } from './admin.service.js';
import { AdminBookingService } from './admin-booking.service.js';
import { UploadService } from './upload.service.js';

@Module({
  imports: [PerformanceModule, PaymentModule, BookingModule],
  controllers: [AdminPerformanceController, AdminBannerController, AdminBookingController, LocalUploadController],
  providers: [AdminService, AdminBookingService, UploadService],
})
export class AdminModule {}
