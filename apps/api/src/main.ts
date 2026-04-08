import './instrument.js';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { TossPaymentExceptionFilter } from './common/filters/toss-payment-exception.filter.js';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
