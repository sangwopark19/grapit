import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import type IORedis from 'ioredis';

import { REDIS_CLIENT } from '../modules/booking/providers/redis.provider.js';

/**
 * Custom Terminus health indicator for Valkey/Redis.
 *
 * Calls `redis.ping()` and reports up/down via HealthIndicatorService.check(key).
 *
 * Why this exists: Cloud Run's liveness probe hits /api/v1/health. Without a
 * Redis check, a degraded connection (e.g. VPC PSC endpoint lost, Memorystore
 * instance paused, network flap) leaves the API reporting healthy while seat
 * locking silently fails. Per 07-REVIEWS.md MEDIUM consensus #7 and Cloud Run
 * startup probe best practice.
 *
 * Terminus 11.1 API: we inject HealthIndicatorService and call
 * `service.check(key).up()` / `.down(data)`. The old `HealthIndicator` base
 * class pattern is deprecated in Terminus 11.
 */
@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(REDIS_CLIENT) private readonly redis: IORedis,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    const maybeRedis = this.redis as { ping?: () => Promise<string> | string };

    if (typeof maybeRedis.ping !== 'function') {
      return indicator.up({
        message: 'ping unavailable; assuming local in-memory Redis mock',
      });
    }

    try {
      const pong = await maybeRedis.ping();
      if (pong !== 'PONG') {
        return indicator.down({ message: `unexpected ping response: ${String(pong)}` });
      }
      return indicator.up();
    } catch (err) {
      return indicator.down({ message: (err as Error).message });
    }
  }
}
