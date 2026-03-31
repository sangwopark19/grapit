import { Module } from '@nestjs/common';
import { PerformanceModule } from '../performance/performance.module.js';
import { AdminPerformanceController } from './admin-performance.controller.js';
import { AdminBannerController } from './admin-banner.controller.js';
import { LocalUploadController } from './local-upload.controller.js';
import { AdminService } from './admin.service.js';
import { UploadService } from './upload.service.js';

@Module({
  imports: [PerformanceModule],
  controllers: [AdminPerformanceController, AdminBannerController, LocalUploadController],
  providers: [AdminService, UploadService],
})
export class AdminModule {}
