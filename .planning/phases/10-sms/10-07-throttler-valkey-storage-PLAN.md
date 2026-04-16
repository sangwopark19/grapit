---
phase: 10
plan: 07
type: execute
wave: 3
depends_on: [10-01, 10-02]
files_modified:
  - apps/api/src/app.module.ts
  - apps/api/src/modules/booking/providers/redis.provider.ts
autonomous: true
requirements: [SMS-01]
must_haves:
  truths:
    - "ThrottlerModule이 forRootAsync로 전환되어 ConfigService + REDIS_CLIENT 주입"
    - "REDIS_CLIENT이 실 ioredis 인스턴스일 때 ThrottlerStorageRedisService로 storage 설정"
    - "REDIS_URL 미설정 local dev(InMemoryRedis fallback)에서는 storage 옵션 omit → in-memory throttler로 fallback"
    - "auth.controller.ts password-reset @Throttle이 동작 그대로 유지 (코드 변경 없음 — storage 변경만)"
    - "Cloud Run 멀티 인스턴스에서 SMS throttler 카운트가 Valkey로 공유"
    - "sms-throttle.integration.spec.ts(testcontainers Valkey)가 GREEN 상태"
  artifacts:
    - path: "apps/api/src/app.module.ts"
      provides: "ThrottlerModule.forRootAsync + Valkey storage"
      contains: "ThrottlerStorageRedisService"
    - path: "apps/api/src/modules/booking/providers/redis.provider.ts"
      provides: "ThrottlerStorageRedisService 호환을 위한 InMemoryRedis 보강 (incr/expire 정확한 시그니처) OR storage 조건부 적용"
  key_links:
    - from: "app.module.ts"
      to: "@nest-lab/throttler-storage-redis"
      via: "new ThrottlerStorageRedisService(redis)"
      pattern: "ThrottlerStorageRedisService"
    - from: "app.module.ts"
      to: "REDIS_CLIENT"
      via: "useFactory inject BookingModule exported redisProvider"
      pattern: "inject:.*REDIS_CLIENT"
    - from: "ThrottlerModule"
      to: "Cloud Run 멀티 인스턴스"
      via: "Valkey 공유 INCR/EXPIRE로 분산 카운팅"
      pattern: "ThrottlerStorageRedisService"
---

<objective>
`ThrottlerModule.forRoot`을 `forRootAsync`로 전환하고 `@nest-lab/throttler-storage-redis`의 `ThrottlerStorageRedisService`를 Phase 7 `REDIS_CLIENT`에 연결한다. CONTEXT D-08 (Valkey 공유) + D-09 (password-reset 이전) 구현. RESEARCH §"Pattern 2: ThrottlerModule.forRootAsync with Valkey storage" + §"Common Pitfalls > Pitfall 5 (InMemoryRedis 호환성)" 반영.

**Plan 06과 관계:** Plan 06이 `@Throttle` 데코레이터를 추가했지만 저장소가 in-memory면 Cloud Run 멀티 인스턴스에서 카운트 분산 실패 → 본 Plan이 Valkey storage로 전환해 D-06/D-07 실효성 확보. password-reset 데코레이터(`auth.controller.ts:120,133`)는 코드 변경 없이 동일한 storage 전환으로 자동 이전 (D-09).

Purpose: 멀티 인스턴스 환경에서 rate limit이 인스턴스별 독립이 되는 위협(T-10-07-01) 제거. InMemoryRedis fallback과의 호환성은 storage 조건부 적용으로 회피.

Output: `apps/api/src/app.module.ts` (ThrottlerModule 섹션 수정) + `apps/api/src/modules/booking/providers/redis.provider.ts` (InMemoryRedis 호환 필요 시 보강).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/10-sms/10-CONTEXT.md
@.planning/phases/10-sms/10-RESEARCH.md
@apps/api/src/app.module.ts
@apps/api/src/modules/booking/providers/redis.provider.ts
@apps/api/src/modules/booking/booking.module.ts
@apps/api/src/modules/auth/auth.controller.ts
@apps/api/test/sms-throttle.integration.spec.ts

<interfaces>
# 적용할 storage contract

```typescript
// @nest-lab/throttler-storage-redis@1.2.0
// 생성자 4가지 형태, 이 프로젝트는 (redis: Redis) 형태 사용
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import type IORedis from 'ioredis';

new ThrottlerStorageRedisService(redisClient); // ioredis 인스턴스

// NestJS 11 / @nestjs/throttler 6 forRootAsync
import { ThrottlerModule } from '@nestjs/throttler';

ThrottlerModule.forRootAsync({
  imports: [BookingModule],    // REDIS_CLIENT export 보유
  inject: [REDIS_CLIENT],
  useFactory: (redis: IORedis | InMemoryRedis) => ({
    throttlers: [{ name: 'default', ttl: 60_000, limit: 60 }],
    // storage는 실 ioredis일 때만 (InMemoryRedis 미지원 방지)
    ...(isRealIORedis(redis) ? { storage: new ThrottlerStorageRedisService(redis) } : {}),
  }),
});
```

```typescript
// apps/api/src/modules/booking/providers/redis.provider.ts (export REDIS_CLIENT 재사용)
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <id>10-07-T1</id>
  <name>Task 1: ThrottlerModule forRootAsync + Valkey storage 전환 (InMemoryRedis 호환성 가드 포함)</name>
  <files>
    apps/api/src/app.module.ts,
    apps/api/src/modules/booking/providers/redis.provider.ts
  </files>
  <behavior>
    - app.module.ts가 ThrottlerModule.forRootAsync 사용, BookingModule imports, REDIS_CLIENT inject
    - 실 ioredis 주입 시 storage = new ThrottlerStorageRedisService(redis)
    - InMemoryRedis(local dev REDIS_URL 미설정) 주입 시 storage 옵션 omit
    - 구분 방법: `redis instanceof IORedis` OR `typeof redis.incr === 'function' && typeof redis.call === 'function'` (ioredis만 `call` 보유)
    - 기본 throttler 설정은 기존 `ttl: 60_000, limit: 60` 유지 (global default)
    - password-reset @Throttle 데코레이터 3 req/15min 동작 변경 없음 (storage 교체만)
  </behavior>
  <read_first>
    - apps/api/src/app.module.ts (현재 ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]))
    - apps/api/src/modules/booking/providers/redis.provider.ts (REDIS_CLIENT export + InMemoryRedis 시그니처)
    - apps/api/src/modules/booking/booking.module.ts (redisProvider export 확인)
    - apps/api/src/modules/auth/auth.controller.ts:118-135 (password-reset @Throttle 동작 유지)
    - .planning/phases/10-sms/10-CONTEXT.md D-08, D-09
    - .planning/phases/10-sms/10-RESEARCH.md §"Pattern 2", §"Common Pitfalls > Pitfall 5"
    - apps/api/test/sms-throttle.integration.spec.ts (Plan 01에서 작성한 integration 테스트 — 본 Plan이 GREEN 전환)
  </read_first>
  <action>
    **Step 1: Import 추가 in app.module.ts**:
    ```typescript
    import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
    import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
    import type IORedis from 'ioredis';
    import { BookingModule } from './modules/booking/booking.module.js';
    import { REDIS_CLIENT } from './modules/booking/providers/redis.provider.js';
    ```

    **Step 2: ThrottlerModule.forRoot → forRootAsync**:
    ```typescript
    // 기존 (제거 대상)
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),

    // 신규
    ThrottlerModule.forRootAsync({
      imports: [BookingModule],   // REDIS_CLIENT를 re-export
      inject: [REDIS_CLIENT],
      useFactory: (redis: IORedis) => {
        // InMemoryRedis는 `call` 메서드가 없음 → storage 옵션 omit (dev fallback)
        // 실 ioredis는 `call`을 통해 Lua EVAL 실행 가능 → Valkey storage 연결
        const isRealRedis = typeof (redis as IORedis).call === 'function';
        return {
          throttlers: [{ name: 'default', ttl: 60_000, limit: 60 }],
          ...(isRealRedis
            ? { storage: new ThrottlerStorageRedisService(redis) }
            : {}),
        };
      },
    }),
    ```

    근거:
    - RESEARCH §"Pattern 2" Caveat: InMemoryRedis는 `incr`/`expire` 미구현 → ThrottlerStorageRedisService가 Lua EVAL 시 `unknown Lua script pattern` throw (Pitfall 5).
    - `call` 메서드 존재 여부가 실 ioredis vs InMemoryRedis 가장 안전한 식별자 (InMemoryRedis는 미구현, ioredis는 공식 API).
    - 기존 `ttl: 60000, limit: 60` 값 유지 — 글로벌 default throttle, 기존 API 호환.

    **Step 3: BookingModule 이미 app.module.ts imports 배열에 있는지 확인** (line 38 `BookingModule` 존재) — 그대로 두고 ThrottlerModule이 `imports: [BookingModule]` 통해 REDIS_CLIENT DI 획득 가능.

    **Step 4 (선택): InMemoryRedis 보강 — dev에서도 storage 테스트 원하면 `incr` + `expire` 추가**:
    ```typescript
    // apps/api/src/modules/booking/providers/redis.provider.ts
    // InMemoryRedis 클래스 내부 추가 (기존 메서드 뒤에)
    async incr(key: string): Promise<number> {
      const current = parseInt(this.store.get(key) ?? '0', 10);
      const next = current + 1;
      this.store.set(key, String(next));
      return next;
    }

    // call은 의도적으로 구현하지 않음 (storage 조건부 분기 동작을 위해)
    ```

    Planner 결정: **Step 4 선택사항.** Step 3까지만 적용해도 production Valkey storage + dev in-memory throttler fallback이 동작하며, sms-throttle integration 테스트(Plan 01)는 testcontainers로 실 Valkey를 띄우므로 본 Plan의 storage 분기를 통과함. `incr` 보강은 integration 테스트가 만족하지 않으면 추가.

    **Step 5: 기존 APP_GUARD / JwtAuthGuard 블록 변경 없음.** `ThrottlerGuard`가 `APP_GUARD`로 등록된 상태 그대로 둔다 — storage 교체는 guard가 내부적으로 사용하는 ThrottlerService의 dependency 변경일 뿐 guard 등록은 무관.

    **주의사항:**
    - password-reset @Throttle 3/15min은 storage 전환으로 자동 Valkey 이전 (D-09 구현 — 코드 변경 없음)
    - Plan 06의 SMS throttle 데코레이터도 동일한 storage 사용 → 분산 카운팅 획득
    - Circular dependency: BookingModule이 ThrottlerModule에 의존하지 않으므로 `imports: [BookingModule]` 안전
    - JWT guard 순서: `APP_GUARD` 배열 순서 유지 (ThrottlerGuard → JwtAuthGuard 기존 순서)
  </action>
  <acceptance_criteria>
    - `grep -q "ThrottlerModule.forRootAsync" apps/api/src/app.module.ts`
    - `grep -q "ThrottlerStorageRedisService" apps/api/src/app.module.ts`
    - `grep -q "inject:.*REDIS_CLIENT" apps/api/src/app.module.ts`
    - `grep -q "imports:.*BookingModule" apps/api/src/app.module.ts` (ThrottlerModule forRootAsync 내부)
    - `grep -q "typeof.*call === 'function'" apps/api/src/app.module.ts` (InMemoryRedis 가드)
    - `grep -q "ttl: 60_000\|ttl: 60000" apps/api/src/app.module.ts` (global default 유지)
    - `pnpm --filter @grapit/api typecheck` exits 0
    - `pnpm --filter @grapit/api test -- --run app.module` exits 0 (만약 app.module spec 존재 시)
    - `pnpm --filter @grapit/api test:integration sms-throttle -- --run` exits 0 (Plan 01 integration 테스트 GREEN)
  </acceptance_criteria>
  <verify>
    <automated>pnpm --filter @grapit/api typecheck && pnpm --filter @grapit/api test -- --run</automated>
  </verify>
  <requirements>SMS-01</requirements>
  <autonomous>true</autonomous>
  <commit>refactor(10-07): migrate ThrottlerModule to Valkey storage via REDIS_CLIENT (D-08, D-09)</commit>
  <done>forRootAsync 전환, InMemoryRedis 조건부 fallback, password-reset 동작 그대로, SMS throttle 데코레이터 Valkey 카운팅 유효화, testcontainers integration 테스트 GREEN</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Cloud Run multi-instance → Valkey | 분산 카운터 저장소, TCP (VPC egress) |
| dev process → InMemoryRedis | REDIS_URL 미설정 로컬 전용, 프로세스 내부 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10-07-01 | Tampering | per-instance throttler (Cloud Run 다중 인스턴스 분산 카운팅 실패, HIGH — SMS pumping 우회) | mitigate | forRootAsync + ThrottlerStorageRedisService(ioredis) — 모든 인스턴스가 동일 Valkey 키 공유. RESEARCH §"Pattern 2" |
| T-10-07-02 | Denial of Service | Valkey 장애 시 throttler fail-open 가능 | accept | Phase 7 Valkey는 Memorystore로 99.95% SLA. 장애 시 에러 응답보다는 fail-open이 UX 우위 (사용자 가입 차단 회피). Sentry alert로 가시화 |
| T-10-07-03 | Tampering | InMemoryRedis 호환성 오판 (Pitfall 5 — 부팅 실패) | mitigate | `typeof redis.call === 'function'` 체크로 storage 옵션 조건부. dev fallback은 in-memory throttler |
| T-10-07-04 | Information Disclosure | credential leak (Valkey 접속 URL) | accept | `redis.url` ConfigService 경유, GCP Secret Manager 바인딩. 기존 Phase 7에서 해결 |
</threat_model>

<verification>
- `pnpm --filter @grapit/api typecheck` green
- `pnpm --filter @grapit/api lint` green
- `pnpm --filter @grapit/api test -- --run` green (기존 unit 테스트 영향 없음)
- `pnpm --filter @grapit/api test:integration sms-throttle -- --run` green (testcontainers Valkey로 실 Lua 동작 검증)
- local dev (REDIS_URL 미설정)에서 `pnpm --filter @grapit/api dev` 부팅 성공 (InMemoryRedis fallback)
</verification>

<success_criteria>
- ThrottlerModule이 Valkey storage 사용 (production + staging)
- Local dev에서 InMemoryRedis로 throttler in-memory fallback — `unknown Lua script pattern` 에러 발생 안 함
- password-reset throttle 3/15min 동작 그대로 유지 (D-09)
- SMS throttle 데코레이터(Plan 06) + password-reset throttle이 동일 Valkey 저장소 공유 → 인메모리/Valkey 혼재 방지
- integration 테스트(testcontainers)에서 limit + 1번째 요청 429 응답 확인
</success_criteria>

<output>
After completion, create `.planning/phases/10-sms/10-07-SUMMARY.md` with:
- forRootAsync 전환 diff
- InMemoryRedis 호환성 가드 구현 방식
- password-reset throttle이 변경 없이 Valkey로 이전된 방식 설명 (D-09)
- integration 테스트 실행 결과 요약
</output>
