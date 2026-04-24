# Phase 14 Deferred Items

## Plan 02 (2026-04-24)

### PRE-EXISTING FAILURE (out-of-scope for Plan 02)

**File:** `apps/api/test/sms-throttle.integration.spec.ts`

**Failing tests (2):**
- `SMS Throttle Integration (testcontainers + Valkey) > TTL 단위 검증 > send-code Throttler가 1h=3600000ms TTL을 Valkey에 설정하는지 확인`
- `SMS Throttle Integration (testcontainers + Valkey) > TTL 단위 검증 > verify-code Throttler가 15min=900000ms TTL을 Valkey에 설정하는지 확인`

**Assertion:** `expect(throttlerKeys.length).toBeGreaterThan(0)` — the tests look for Valkey keys whose name contains `throttler`/`Throttler` substring after a single throttled request, but `ThrottlerStorageRedisService` (from `@nest-lab/throttler-storage-redis`) apparently now stores keys under a prefix that does not include those substrings (likely a version upgrade changed the key naming convention).

**Verified pre-existing:** `git stash` of Plan 02 edits before running `pnpm --filter @grabit/api test:integration sms-throttle -- --run` reproduces the SAME 2/13 failures (identical count, identical test names, identical assertion).

**Why out-of-scope for Plan 02:**
- These tests concern `@nestjs/throttler` ThrottlerStorageRedisService internals, not the OTP Lua script or the 3 OTP keys that Plan 02 touches.
- Plan 02's target scope (`VERIFY_AND_INCREMENT_LUA atomic script (Valkey EVAL)` describe block, 6 `it` bodies) is 6/6 GREEN after the refactor.
- Rule: Executor auto-fixes issues DIRECTLY caused by the current task's changes. These are pre-edit failures.

**Recommended resolution (future phase):** Update the key-substring filter to match the current `ThrottlerStorageRedisService` key format (inspect `await redis.keys('*')` output to see the actual prefix), or switch to a deterministic key assertion via a known request IP/route combination.

---
