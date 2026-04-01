import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';
import IORedis from 'ioredis';

export const UPSTASH_REDIS = Symbol('UPSTASH_REDIS');
export const IOREDIS_CLIENT = Symbol('IOREDIS_CLIENT');

export const upstashRedisProvider: Provider = {
  provide: UPSTASH_REDIS,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Redis => {
    const url = config.get<string>('redis.upstashUrl', '');
    const token = config.get<string>('redis.upstashToken', '');

    return new Redis({ url, token });
  },
};

export const ioredisClientProvider: Provider = {
  provide: IOREDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): IORedis => {
    const url = config.get<string>('redis.ioredisUrl', 'redis://localhost:6379');

    return new IORedis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
    });
  },
};
