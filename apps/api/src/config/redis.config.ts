import { registerAs } from '@nestjs/config';

export const redisConfig = registerAs('redis', () => ({
  upstashUrl: process.env['UPSTASH_REDIS_REST_URL'] ?? '',
  upstashToken: process.env['UPSTASH_REDIS_REST_TOKEN'] ?? '',
  ioredisUrl: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
}));
