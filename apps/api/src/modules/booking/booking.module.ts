import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BookingController } from './booking.controller.js';
import { BookingService } from './booking.service.js';
import { BookingGateway } from './booking.gateway.js';
import { redisProvider } from './providers/redis.provider.js';

@Module({
  imports: [ConfigModule],
  controllers: [BookingController],
  providers: [
    BookingService,
    BookingGateway,
    redisProvider,
  ],
  exports: [BookingService, BookingGateway, redisProvider],
})
export class BookingModule {}
