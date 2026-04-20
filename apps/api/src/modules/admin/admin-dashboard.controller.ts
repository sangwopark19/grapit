import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { periodQuerySchema } from '@grapit/shared';
import type { DashboardPeriod } from '@grapit/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AdminDashboardService } from './admin-dashboard.service.js';

/**
 * RED skeleton — Plan 02(Task 02-02)가 handler body를 실제 구현으로 교체한다.
 * RolesGuard + @Roles('admin') 데코레이터는 skeleton에서도 반드시 존재해야 한다.
 * (controller spec의 access-control 테스트가 401/403/200을 assertion failure로 검증)
 */
@Controller('admin/dashboard')
@UseGuards(RolesGuard)
@Roles('admin')
export class AdminDashboardController {
  constructor(private readonly service: AdminDashboardService) {
    void this.service;
  }

  @Get('summary')
  async getSummary(): Promise<never> {
    throw new Error('Not implemented');
  }

  @Get('revenue')
  async getRevenue(
    @Query(new ZodValidationPipe(periodQuerySchema)) _query: { period: DashboardPeriod },
  ): Promise<never> {
    throw new Error('Not implemented');
  }

  @Get('genre')
  async getGenre(
    @Query(new ZodValidationPipe(periodQuerySchema)) _query: { period: DashboardPeriod },
  ): Promise<never> {
    throw new Error('Not implemented');
  }

  @Get('payment')
  async getPayment(
    @Query(new ZodValidationPipe(periodQuerySchema)) _query: { period: DashboardPeriod },
  ): Promise<never> {
    throw new Error('Not implemented');
  }

  @Get('top-performances')
  async getTopPerformances(): Promise<never> {
    throw new Error('Not implemented');
  }
}
