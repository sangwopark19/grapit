import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { Test } from '@nestjs/testing';
import { type INestApplication, HttpStatus } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { APP_GUARD } from '@nestjs/core';
import IORedis from 'ioredis';
import request from 'supertest';

/**
 * SMS Throttle Integration Test -- testcontainers Valkey
 *
 * 실제 Valkey 컨테이너를 구동하여 @nestjs/throttler + ThrottlerStorageRedisService가
 * Valkey에서 정확하게 rate limiting을 수행하는지 검증합니다.
 *
 * 실행: pnpm --filter @grapit/api test:integration sms-throttle -- --run
 * Docker가 필수입니다.
 */

// --- Minimal SmsController for isolated throttle testing ---
import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

@Controller('sms')
class TestSmsController {
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @Post('send-code')
  sendCode(@Body() body: { phone: string }) {
    return { success: true, message: 'mock', phone: body.phone };
  }

  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Post('verify-code')
  verifyCode(@Body() body: { phone: string; code: string }) {
    return { verified: true, phone: body.phone };
  }
}

@Controller('auth')
class TestAuthController {
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 900_000 } })
  @Post('password-reset/request')
  passwordResetRequest(@Body() body: { email: string }) {
    return { message: 'ok', email: body.email };
  }
}

describe('SMS Throttle Integration (testcontainers + Valkey)', () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let redis: IORedis;

  beforeAll(async () => {
    // Start Valkey container
    container = await new GenericContainer('valkey/valkey:8')
      .withExposedPorts(6379)
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(6379);
    const redisUrl = `redis://${host}:${port}`;

    // Create a standalone ioredis client for TTL verification
    redis = new IORedis(redisUrl, { maxRetriesPerRequest: 3 });

    // Build NestJS TestingModule with real Valkey-backed throttler
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', ttl: 60_000, limit: 60 }],
          storage: new ThrottlerStorageRedisService(redis),
        }),
      ],
      controllers: [TestSmsController, TestAuthController],
      providers: [
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await redis?.quit();
    await container?.stop();
  });

  describe('send-code rate limiting', () => {
    it('IP axis: 20/3600s -- 21번째 요청에서 429', async () => {
      // Flush keys to isolate test
      await redis.flushall();

      const server = app.getHttpServer();

      // 20 requests should succeed
      for (let i = 0; i < 20; i++) {
        const res = await request(server)
          .post('/sms/send-code')
          .send({ phone: `+8201000000${String(i).padStart(2, '0')}` })
          .expect(HttpStatus.OK);
        expect(res.body.success).toBe(true);
      }

      // 21st request should be throttled (429)
      const throttled = await request(server)
        .post('/sms/send-code')
        .send({ phone: '+82010000099' });
      expect(throttled.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });

    it('phone axis: 동일 phone + 서로 다른 IP axis는 @Throttle default로 동일 IP에서 test', async () => {
      // This test validates that the IP-based default throttle is enforced
      // Phone-axis throttling (5/3600s) is done in SmsService via Lua script,
      // not through @nestjs/throttler. The throttler handles IP-axis only.
      // The SmsService Lua counter is tested in sms.service.spec.ts unit tests.
      await redis.flushall();

      const server = app.getHttpServer();

      // Send 20 requests with same phone (IP axis throttle applies)
      for (let i = 0; i < 20; i++) {
        await request(server)
          .post('/sms/send-code')
          .send({ phone: '+82010012345678' })
          .expect(HttpStatus.OK);
      }

      // 21st request exceeds IP axis limit
      const res = await request(server)
        .post('/sms/send-code')
        .send({ phone: '+82010012345678' });
      expect(res.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });
  });

  describe('verify-code rate limiting', () => {
    it('IP axis: 10/900s -- 11번째 요청에서 429', async () => {
      await redis.flushall();

      const server = app.getHttpServer();

      // 10 requests should succeed
      for (let i = 0; i < 10; i++) {
        await request(server)
          .post('/sms/verify-code')
          .send({ phone: `+8201000000${String(i).padStart(2, '0')}`, code: '123456' })
          .expect(HttpStatus.OK);
      }

      // 11th request should be throttled
      const res = await request(server)
        .post('/sms/verify-code')
        .send({ phone: '+82010000099', code: '123456' });
      expect(res.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });

    it('같은 phone으로 반복 verify -- IP axis limit 적용', async () => {
      await redis.flushall();

      const server = app.getHttpServer();

      for (let i = 0; i < 10; i++) {
        await request(server)
          .post('/sms/verify-code')
          .send({ phone: '+82010012345678', code: '000000' })
          .expect(HttpStatus.OK);
      }

      const res = await request(server)
        .post('/sms/verify-code')
        .send({ phone: '+82010012345678', code: '000000' });
      expect(res.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });
  });

  describe('password-reset rate limiting (D-09)', () => {
    it('3/900s -- 4번째 요청에서 429', async () => {
      await redis.flushall();

      const server = app.getHttpServer();

      // 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        await request(server)
          .post('/auth/password-reset/request')
          .send({ email: `user${i}@test.com` })
          .expect(HttpStatus.OK);
      }

      // 4th request should be throttled
      const res = await request(server)
        .post('/auth/password-reset/request')
        .send({ email: 'blocked@test.com' });
      expect(res.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });
  });

  // [Review #6 TTL ms 검증]
  describe('TTL 단위 검증', () => {
    it('send-code Throttler가 1h=3600000ms TTL을 Valkey에 설정하는지 확인', async () => {
      await redis.flushall();

      const server = app.getHttpServer();

      // Make one request to create throttler key
      await request(server)
        .post('/sms/send-code')
        .send({ phone: '+82010099998888' })
        .expect(HttpStatus.OK);

      // Find throttler keys in Valkey
      const keys = await redis.keys('*');
      const throttlerKeys = keys.filter(
        (k) => k.includes('throttler') || k.includes('Throttler'),
      );

      // At least one throttler key should exist
      expect(throttlerKeys.length).toBeGreaterThan(0);

      // Check PTTL of any throttler key -- should be <= 3_600_000ms (1h)
      // The send-code endpoint has ttl: 3_600_000
      for (const key of throttlerKeys) {
        const pttl = await redis.pttl(key);
        // PTTL should be positive and <= 3_600_000ms
        expect(pttl).toBeGreaterThan(0);
        expect(pttl).toBeLessThanOrEqual(3_600_000);
        // Should be close to 3_600_000ms (within first second of creation)
        expect(pttl).toBeGreaterThan(3_599_000);
      }
    });

    it('verify-code Throttler가 15min=900000ms TTL을 Valkey에 설정하는지 확인', async () => {
      await redis.flushall();

      const server = app.getHttpServer();

      await request(server)
        .post('/sms/verify-code')
        .send({ phone: '+82010088887777', code: '123456' })
        .expect(HttpStatus.OK);

      const keys = await redis.keys('*');
      const throttlerKeys = keys.filter(
        (k) => k.includes('throttler') || k.includes('Throttler'),
      );

      expect(throttlerKeys.length).toBeGreaterThan(0);

      for (const key of throttlerKeys) {
        const pttl = await redis.pttl(key);
        expect(pttl).toBeGreaterThan(0);
        expect(pttl).toBeLessThanOrEqual(900_000);
        expect(pttl).toBeGreaterThan(899_000);
      }
    });
  });
});
