---
phase: 07-valkey
plan: 01
subsystem: backend/booking/redis
tags: [redis, ioredis, refactor, booking, valkey-migration]
requirements: [VALK-01, VALK-03, VALK-04]
dependency-graph:
  requires:
    - "@grapit/api booking module (BookingService, BookingModule)"
    - "ioredis 5.x (already installed)"
  provides:
    - "REDIS_CLIENT symbol (single unified ioredis injection token)"
    - "redisProvider (exported from BookingModule for downstream use)"
    - "InMemoryRedis mock with ioredis-compatible eval signature"
  affects:
    - "apps/api/src/modules/booking/booking.service.ts (eval calls)"
    - "apps/api/src/modules/booking/__tests__/booking.service.spec.ts (test mocks)"
    - "apps/api/src/config/redis.config.ts (single url key)"
tech-stack:
  removed:
    - "@upstash/redis 1.37.x (dependency deleted from apps/api/package.json)"
  patterns:
    - "ioredis flat eval signature: eval(script, numKeys, ...keysAndArgs)"
    - "Single Redis client via DI symbol (REDIS_CLIENT)"
key-files:
  modified:
    - apps/api/src/modules/booking/providers/redis.provider.ts
    - apps/api/src/modules/booking/booking.service.ts
    - apps/api/src/modules/booking/booking.module.ts
    - apps/api/src/modules/booking/__tests__/booking.service.spec.ts
    - apps/api/src/config/redis.config.ts
    - apps/api/package.json
    - pnpm-lock.yaml
decisions:
  - "ioredis 플랫 eval 시그니처 채택 (Upstash object-keys 패턴 폐기)"
  - "REDIS_CLIENT 단일 symbol로 통합 (UPSTASH_REDIS + IOREDIS_CLIENT 폐기)"
  - "redis.config.ts를 url 단일 키로 단순화 (upstashUrl/Token/ioredisUrl 통합)"
metrics:
  duration: "~8min"
  tasks: 2
  files: 7
  tests_passed: 16
  completed: "2026-04-10"
---

# Phase 07 Plan 01: Unify Redis client to ioredis (remove Upstash) Summary

@upstash/redis HTTP 클라이언트를 제거하고 BookingService와 Socket.IO adapter가 모두 단일 ioredis TCP 클라이언트(REDIS_CLIENT)를 사용하도록 통합했다. InMemoryRedis mock과 테스트는 ioredis 플랫 eval 시그니처(`script, numKeys, ...keysAndArgs`)로 동기화되었다.

## What Was Built

### Task 1: Redis provider 통합 + config 정리 (commit 61e6dfd)

**redis.provider.ts 전면 재작성:**
- `UPSTASH_REDIS` / `IOREDIS_CLIENT` Symbol 삭제 → 단일 `REDIS_CLIENT` Symbol
- `import { Redis } from '@upstash/redis'` 삭제
- 두 개의 provider(`upstashRedisProvider`, `ioredisClientProvider`) → 단일 `redisProvider`
- `redisProvider`는 `REDIS_URL` 환경변수로 ioredis 클라이언트를 생성하고, 없으면 InMemoryRedis mock으로 폴백
- `InMemoryRedis.eval()` 시그니처를 ioredis 플랫 패턴으로 변환:
  ```typescript
  async eval(_script: string, numKeys: number, ...keysAndArgs: (string | number)[]): Promise<unknown>
  ```

**redis.config.ts 단순화:**
- `upstashUrl`, `upstashToken`, `ioredisUrl` 3개 키 삭제
- `url: process.env['REDIS_URL'] ?? ''` 단일 키로 교체

**booking.module.ts 업데이트:**
- `upstashRedisProvider`, `ioredisClientProvider` 삭제
- `redisProvider` 단일 등록 + `exports`에 추가 (PerformanceModule 등 다른 모듈이 REDIS_CLIENT 주입할 수 있도록)

**@upstash/redis 제거:**
- `pnpm --filter @grapit/api remove @upstash/redis`로 apps/api/package.json에서 완전 삭제

### Task 2: BookingService eval() 변환 + 테스트 업데이트 (commit 9f4900f)

**booking.service.ts 시그니처 변환:**
- import 변경: `Redis` from `@upstash/redis` → `IORedis` from `ioredis`
- 주입 토큰 변경: `@Inject(UPSTASH_REDIS)` → `@Inject(REDIS_CLIENT)`
- `lockSeat` eval (3 keys, 5 args):
  ```typescript
  await this.redis.eval(LOCK_SEAT_LUA, 3,
    userSeatsKey, lockKey, lockedSeatsKey,
    userId, String(LOCK_TTL), String(MAX_SEATS), seatId, keyPrefix)
  ```
- `unlockSeat` eval (3 keys, 2 args):
  ```typescript
  await this.redis.eval(UNLOCK_SEAT_LUA, 3,
    lockKey, userSeatsKey, lockedSeatsKey,
    userId, seatId)
  ```
- `getSeatStatus` eval (1 key, 1 arg):
  ```typescript
  await this.redis.eval(GET_VALID_LOCKED_SEATS_LUA, 1,
    lockedSeatsKey, keyPrefix)
  ```
- `smembers()` 호출에서 `as string[]` 캐스트 제거 (ioredis는 네이티브 `string[]` 반환)

**booking.service.spec.ts mock 검증 업데이트:**
- `[script, keys, args]` 분해 → flat `callArgs` 슬라이싱으로 전환:
  ```typescript
  const callArgs = mockRedis.eval.mock.calls[0] as unknown[];
  const script = callArgs[0] as string;
  const numKeys = callArgs[1] as number;
  const flatKeys = callArgs.slice(2, 2 + numKeys) as string[];
  const flatArgs = callArgs.slice(2 + numKeys) as string[];
  ```
- 3개 테스트 케이스(lockSeat, unlockSeat, getSeatStatus) 모두 업데이트
- `createMockRedis()`에 `ttl` mock 함수 추가 (getMyLocks에서 사용)

## Verification Results

**테스트 통과:** `booking.service.spec.ts` 16 tests passed (duration 5ms)
```
 ✓ modules/booking/__tests__/booking.service.spec.ts (16 tests) 5ms
 Test Files  1 passed (1)
      Tests  16 passed (16)
```

**TypeScript 컴파일:** `pnpm --filter @grapit/api exec tsc --noEmit` 통과 (에러 0건)

**완전 제거 확인:**
- `grep -r '@upstash/redis' apps/api/src/` → 결과 없음
- `grep -r 'UPSTASH_REDIS' apps/api/src/` → 결과 없음
- `apps/api/package.json`에서 `@upstash/redis` 키 없음

## Success Criteria Check

- [x] @upstash/redis 패키지 완전 제거 (package.json + 모든 import)
- [x] REDIS_CLIENT 단일 Symbol로 provider 통합
- [x] eval() 시그니처 3곳 모두 ioredis 플랫 패턴으로 변환 (lockSeat, unlockSeat, getSeatStatus)
- [x] InMemoryRedis mock eval() 시그니처 동기화
- [x] 기존 테스트 전체 통과 (16/16)
- [x] TypeScript 컴파일 에러 없음

## Deviations from Plan

None — plan executed exactly as written.

사전 조건으로 `pnpm install`과 `pnpm --filter @grapit/shared build`를 worktree에서 최초 1회 실행해야 했으나(node_modules 누락), 이는 worktree 환경 세팅일 뿐 plan 변경이나 deviations는 아님. 모든 코드 변경은 plan 사양 그대로 수행됨.

## Dependencies Unblocked

- **Plan 07-02 (Socket.IO adapter 통합):** REDIS_CLIENT가 export되어 BookingGateway의 Socket.IO adapter도 동일 클라이언트를 주입받을 수 있게 됨
- **Plan 07-03 (Valkey 마이그레이션 검증):** 단일 클라이언트 경로 확보로 Valkey 호환성 테스트가 단순화됨

## Known Stubs

None. 모든 코드 경로가 실제 ioredis 클라이언트 또는 InMemoryRedis fallback으로 연결되어 있다.

## Threat Flags

플랜에 명시된 threat model(`T-07-01` ~ `T-07-03`) 범위를 벗어나는 새로운 trust boundary나 attack surface는 도입되지 않았다. Lua 스크립트는 하드코딩 유지, 사용자 입력은 KEYS/ARGV로만 전달, REDIS_URL은 환경변수 주입 원칙 유지.

## Commits

| Task | Hash | Description |
|------|------|-------------|
| Task 1 | `61e6dfd` | refactor(07-01): unify Redis provider to single ioredis client |
| Task 2 | `9f4900f` | refactor(07-01): convert BookingService eval() to ioredis flat signature |

## Self-Check

### Files verified (exist at expected paths)

- [x] apps/api/src/modules/booking/providers/redis.provider.ts (rewritten)
- [x] apps/api/src/config/redis.config.ts (simplified)
- [x] apps/api/src/modules/booking/booking.module.ts (single provider)
- [x] apps/api/src/modules/booking/booking.service.ts (ioredis signature)
- [x] apps/api/src/modules/booking/__tests__/booking.service.spec.ts (updated mocks)
- [x] apps/api/package.json (no @upstash/redis)

### Commits verified

- [x] 61e6dfd — found in git log
- [x] 9f4900f — found in git log

## Self-Check: PASSED
