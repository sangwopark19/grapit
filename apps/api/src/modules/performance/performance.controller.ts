import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { performanceQuerySchema, type PerformanceQuery } from './dto/performance.dto.js';
import { PerformanceService } from './performance.service.js';

@Public()
@Controller('api/v1')
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get('performances')
  async listPerformances(
    @Query(new ZodValidationPipe(performanceQuerySchema)) query: PerformanceQuery,
  ) {
    const genre = query.genre ?? 'musical';
    return this.performanceService.findByGenre(genre, query);
  }

  @Get('performances/:id')
  async getPerformance(@Param('id') id: string) {
    const result = await this.performanceService.findById(id);
    if (!result) {
      throw new NotFoundException('공연을 찾을 수 없습니다');
    }
    return result;
  }

  @Get('home/banners')
  async getHomeBanners() {
    return this.performanceService.getHomeBanners();
  }

  @Get('home/hot')
  async getHotPerformances() {
    return this.performanceService.getHotPerformances();
  }

  @Get('home/new')
  async getNewPerformances() {
    return this.performanceService.getNewPerformances();
  }
}
