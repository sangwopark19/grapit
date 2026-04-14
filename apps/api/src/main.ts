import './instrument.js';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type IORedis from 'ioredis';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { TossPaymentExceptionFilter } from './common/filters/toss-payment-exception.filter.js';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe.js';
import { RedisIoAdapter } from './modules/booking/providers/redis-io.adapter.js';
import { REDIS_CLIENT } from './modules/booking/providers/redis.provider.js';

async function bootstrap() {
  // REVIEWS.md MED: FRONTEND_URL production hard-fail.
  // Password reset email links embed FRONTEND_URL; a missing or non-https value
  // breaks password recovery and phishing-protection guarantees.
  if (process.env['NODE_ENV'] === 'production') {
    const frontendUrl = process.env['FRONTEND_URL'];
    if (!frontendUrl || !frontendUrl.startsWith('https://')) {
      console.error(
        `[bootstrap] FRONTEND_URL must be an https URL in production. ` +
          `Received: ${frontendUrl ?? '<unset>'}. ` +
          'Reset links and email deliverability depend on this. Aborting startup.',
      );
      process.exit(1);
    }
  }

  const app = await NestFactory.create(AppModule);

  // Wire Socket.IO to the shared ioredis REDIS_CLIENT so seat-update events
  // broadcast across Cloud Run instances via Valkey pub/sub (VALK-04).
  // Falls back to the default in-process adapter when REDIS_URL is not set.
  const redisClient = app.get<IORedis>(REDIS_CLIENT);
  const redisIoAdapter = new RedisIoAdapter(app, redisClient);
  redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  app.enableCors({
    origin: process.env['FRONTEND_URL']
      ? process.env['FRONTEND_URL'].split(',').map((o) => o.trim())
      : 'http://localhost:3000',
    credentials: true,
  });

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cookieParser());

  app.useGlobalFilters(new HttpExceptionFilter(), new TossPaymentExceptionFilter());
  app.useGlobalPipes(new ZodValidationPipe());

  app.setGlobalPrefix('api/v1');

  const port = process.env['PORT'] ?? 8080;
  await app.listen(port);
  console.log(`API server running on http://localhost:${port}`);
}

bootstrap();
