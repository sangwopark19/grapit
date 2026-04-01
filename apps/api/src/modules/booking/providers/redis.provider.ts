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

    const client = new IORedis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        if (times > 5) return null;
        return Math.min(times * 500, 5000);
      },
    });

    client.on('error', (err: Error) => {
      if (err.message.includes('ECONNREFUSED')) {
        if (!ioredisWarned) {
          ioredisWarned = true;
          console.warn('[ioredis] Redis unavailable — Socket.IO multi-instance broadcast disabled. This is fine for local dev.');
        }
      }
    });

    client.connect().catch(() => {});

    return client;
  },
};

let ioredisWarned = false;
