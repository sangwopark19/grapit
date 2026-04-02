import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BookingController } from './booking.controller.js';
import { BookingService } from './booking.service.js';
import { BookingGateway } from './booking.gateway.js';
import { upstashRedisProvider, ioredisClientProvider } from './providers/redis.provider.js';

@Module({
  imports: [ConfigModule],
  controllers: [BookingController],
  providers: [
    BookingService,
    BookingGateway,
    upstashRedisProvider,
    ioredisClientProvider,
  ],
  exports: [BookingService],
})
export class BookingModule {}
