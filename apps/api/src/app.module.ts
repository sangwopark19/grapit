import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './health/health.module.js';
import { DrizzleModule } from './database/drizzle.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UserModule } from './modules/user/user.module.js';
import { SmsModule } from './modules/sms/sms.module.js';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard.js';
import { authConfig } from './config/auth.config.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
      load: [authConfig],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    DrizzleModule,
    HealthModule,
    AuthModule,
    UserModule,
    SmsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
