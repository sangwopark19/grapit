import { Module } from '@nestjs/common';
import { PerformanceModule } from '../performance/performance.module.js';
import { AdminPerformanceController } from './admin-performance.controller.js';
import { AdminBannerController } from './admin-banner.controller.js';
import { AdminService } from './admin.service.js';
import { UploadService } from './upload.service.js';

@Module({
  imports: [PerformanceModule],
  controllers: [AdminPerformanceController, AdminBannerController],
  providers: [AdminService, UploadService],
})
export class AdminModule {}
