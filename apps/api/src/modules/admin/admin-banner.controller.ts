import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { createBannerSchema, type CreateBannerInput } from '@grapit/shared';
import { AdminService } from './admin.service.js';

@Controller('api/v1/admin')
@UseGuards(RolesGuard)
@Roles('admin')
export class AdminBannerController {
  constructor(private readonly adminService: AdminService) {}

  @Get('banners')
  async listBanners() {
    return this.adminService.listBanners();
  }

  @Post('banners')
  async createBanner(
    @Body(new ZodValidationPipe(createBannerSchema)) body: CreateBannerInput,
  ) {
    return this.adminService.createBanner(body);
  }

  // CRITICAL: Static route 'banners/reorder' MUST appear before dynamic 'banners/:id'
  @Put('banners/reorder')
  async reorderBanners(@Body() body: { orderedIds: string[] }) {
    await this.adminService.reorderBanners(body.orderedIds);
    return { message: '배너 순서가 변경되었습니다' };
  }

  @Put('banners/:id')
  async updateBanner(
    @Param('id') id: string,
    @Body() body: Partial<CreateBannerInput>,
  ) {
    return this.adminService.updateBanner(id, body);
  }

  @Delete('banners/:id')
  async deleteBanner(@Param('id') id: string) {
    await this.adminService.deleteBanner(id);
    return { message: '배너가 삭제되었습니다' };
  }
}
