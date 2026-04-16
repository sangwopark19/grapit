import { describe, it, expect, beforeAll, afterAll } from 'vitest';
// Plan 07+09에서 GREEN 전환 예정
// testcontainers로 실제 Valkey 인스턴스를 구동하여 ThrottlerStorageRedisService 통합 테스트

/**
 * 이 테스트는 testcontainers를 사용하여 실 Valkey 컨테이너를 띄우고
 * NestJS ThrottlerModule + @nest-lab/throttler-storage-redis가
 * Valkey에서 정확하게 rate limiting을 수행하는지 검증합니다.
 *
 * 실행: pnpm --filter @grapit/api test:integration sms-throttle -- --run
 * Docker가 필수입니다.
 */

// testcontainers import -- Plan 09에서 구현 시 실제 컨테이너 구동
// import { GenericContainer, StartedTestContainer } from 'testcontainers';
// import { Test, TestingModule } from '@nestjs/testing';
// import { INestApplication } from '@nestjs/common';
// import request from 'supertest';

describe('SMS Throttle Integration (testcontainers + Valkey)', () => {
  // let container: StartedTestContainer;
  // let app: INestApplication;

  beforeAll(async () => {
    // Plan 09에서 구현:
    // container = await new GenericContainer('valkey/valkey:8')
    //   .withExposedPorts(6379)
    //   .start();
    // const redisUrl = `redis://${container.getHost()}:${container.getMappedPort(6379)}`;
    // ... NestJS TestingModule 생성 with REDIS_URL
  }, 120_000);

  afterAll(async () => {
    // await app?.close();
    // await container?.stop();
  });

  describe('send-code rate limiting', () => {
    it('IP axis: 20/3600s 초과 시 429', async () => {
      // Plan 09에서 구현: 21번째 요청에서 429 반환 확인
      // for (let i = 0; i < 20; i++) { await request(app.getHttpServer()).post('/sms/send-code')... }
      // const res = await request(app.getHttpServer()).post('/sms/send-code')...
      // expect(res.status).toBe(429);
      expect(true).toBe(false); // RED: 미구현
    });

    it('phone axis: 5/3600s 초과 시 429', async () => {
      // Plan 09에서 구현: 동일 phone으로 6번째 요청에서 429
      expect(true).toBe(false); // RED: 미구현
    });
  });

  describe('verify-code rate limiting', () => {
    it('IP axis: 10/900s 초과 시 429', async () => {
      // Plan 09에서 구현: 11번째 verify 요청에서 429
      expect(true).toBe(false); // RED: 미구현
    });

    it('phone axis: 10/900s 초과 시 429', async () => {
      // Plan 09에서 구현: 동일 phone으로 11번째 verify 요청에서 429
      expect(true).toBe(false); // RED: 미구현
    });
  });

  describe('password-reset rate limiting (D-09)', () => {
    it('3/900s 유지 확인', async () => {
      // Plan 09에서 구현: 기존 password-reset throttle이 Valkey storage에서도 동작
      expect(true).toBe(false); // RED: 미구현
    });
  });

  // [Review #6 TTL ms 검증]
  describe('TTL 단위 검증', () => {
    it('Throttler가 1h=3600000ms를 정확히 적용하는지 확인', async () => {
      // Plan 09에서 구현:
      // Valkey에서 throttler key의 TTL을 PTTL로 확인하여
      // ms 단위로 3600000 이하인지 검증
      // const pttl = await redis.pttl('throttler:...');
      // expect(pttl).toBeLessThanOrEqual(3_600_000);
      // expect(pttl).toBeGreaterThan(3_599_000);
      expect(true).toBe(false); // RED: 미구현
    });
  });
});
