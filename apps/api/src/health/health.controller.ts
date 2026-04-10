import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { Public } from '../common/decorators/public.decorator.js';
import { RedisHealthIndicator } from './redis.health.indicator.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly redisIndicator: RedisHealthIndicator,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.redisIndicator.isHealthy('redis'),
    ]);
  }
}
