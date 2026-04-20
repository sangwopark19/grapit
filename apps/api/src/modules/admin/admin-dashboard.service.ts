import { Injectable, Inject } from '@nestjs/common';
import type {
  DashboardSummaryDto,
  DashboardRevenueDto,
  DashboardGenreDto,
  DashboardPaymentDto,
  DashboardTopDto,
  DashboardPeriod,
} from '@grapit/shared';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.provider.js';
import { CacheService } from '../performance/cache.service.js';

/**
 * RED skeleton — Plan 02(Task 02-01)이 이 메서드들을 실제 구현으로 교체한다.
 * 이 상태에서 spec 파일들은 module-not-found가 아닌 assertion failure로 RED가 된다.
 */
@Injectable()
export class AdminDashboardService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly cache: CacheService,
  ) {
    // db/cache는 Plan 02에서 사용. skeleton 단계에서는 reference만 보관.
    void this.db;
    void this.cache;
  }

  async getSummary(): Promise<DashboardSummaryDto> {
    throw new Error('Not implemented');
  }

  async getRevenueTrend(_period: DashboardPeriod): Promise<DashboardRevenueDto> {
    throw new Error('Not implemented');
  }

  async getGenreDistribution(_period: DashboardPeriod): Promise<DashboardGenreDto> {
    throw new Error('Not implemented');
  }

  async getPaymentDistribution(_period: DashboardPeriod): Promise<DashboardPaymentDto> {
    throw new Error('Not implemented');
  }

  async getTopPerformances(): Promise<DashboardTopDto> {
    throw new Error('Not implemented');
  }
}
