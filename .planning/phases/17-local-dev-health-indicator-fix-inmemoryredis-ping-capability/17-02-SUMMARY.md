---
phase: 17-local-dev-health-indicator-fix-inmemoryredis-ping-capability
plan: 02
subsystem: api-health
tags: [redis, health, inmemoryredis, terminus]

requires:
  - phase: 17-local-dev-health-indicator-fix-inmemoryredis-ping-capability
    provides: RED tests from 17-01
provides:
  - InMemoryRedis `ping()` surface parity
  - RedisHealthIndicator no-ping capability fallback
  - Focused provider/health tests passing
affects: [local-dev-health, phase-13-uat-gap-1]

key-files:
  modified:
    - apps/api/src/modules/booking/providers/redis.provider.ts
    - apps/api/src/health/redis.health.indicator.ts

requirements-completed: [SC-1, SC-2, SC-3, SC-4]
completed: 2026-04-28
---

# Phase 17 Plan 02 Summary

Implemented the local dev health fix for `REDIS_URL` unset environments.

## Task Commits

1. **Task 1: Implement InMemoryRedis.ping()** - `984c0e9`
2. **Task 2: Add RedisHealthIndicator ping capability probe** - `0292bcd`
3. **Task 3: Verification** - no code changes

## Changes

- Added `async ping(): Promise<'PONG'>` to `InMemoryRedis`.
- Added a capability probe in `RedisHealthIndicator` for injected clients without `ping()`.
- Preserved real Redis failure behavior: `ping()` rejection and non-`PONG` responses still report down.

## Verification

Focused tests:

```bash
pnpm --filter @grabit/api exec vitest run \
  src/modules/booking/providers/__tests__/redis.provider.spec.ts \
  src/health/__tests__/redis.health.indicator.spec.ts \
  --reporter=verbose
```

Result: 2 files passed, 15 tests passed.

Static checks:

```bash
pnpm --filter @grabit/api typecheck
pnpm --filter @grabit/api lint
```

Results:

- Typecheck passed.
- Lint exited 0 with 36 pre-existing warnings outside this change.

Guard checks:

- `redis.provider.ts` contains `async ping()`.
- `redis.health.indicator.ts` contains `ping unavailable; assuming local in-memory Redis mock`.
- `InMemoryRedis` still has no `async incr(` implementation.
- Production empty `REDIS_URL` hard-fail code path was not changed.

## Deviations

No local dev server smoke was run. The plan marked it optional; focused tests directly cover the diagnosed failure and the provider fallback.

## Self-Check: PASSED

- 17-01 RED tests are GREEN after implementation.
- No schema files changed.
- No production Redis failure path was weakened.

