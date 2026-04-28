---
phase: 17-local-dev-health-indicator-fix-inmemoryredis-ping-capability
plan: 01
subsystem: api-health
tags: [vitest, redis, health, inmemoryredis]

provides:
  - RED test for InMemoryRedis `ping()` surface parity
  - RED test for RedisHealthIndicator no-ping capability fallback
affects: [17-02, local-dev-health]

key-files:
  modified:
    - apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts
    - apps/api/src/health/__tests__/redis.health.indicator.spec.ts

requirements-completed: [SC-1, SC-2, SC-3]
completed: 2026-04-28
---

# Phase 17 Plan 01 Summary

Added focused RED coverage for the local `/health` 503 regression.

## Task Commits

Pending commit at summary creation time:

1. Task 1: InMemoryRedis ping parity RED test
2. Task 2: RedisHealthIndicator no-ping capability RED test

## Verification

Provider test command:

```bash
pnpm --filter @grabit/api exec vitest run src/modules/booking/providers/__tests__/redis.provider.spec.ts --reporter=verbose
```

Result: 10 passed, 1 failed. Expected RED:

```text
TypeError: redis.ping is not a function
```

Health indicator test command:

```bash
pnpm --filter @grabit/api exec vitest run src/health/__tests__/redis.health.indicator.spec.ts --reporter=verbose
```

Result: 3 passed, 1 failed. Expected RED:

```text
expected 'down' to be 'up'
```

## Decisions

- Kept Plan 17-01 test-only. No production code changed.
- The RED failures point directly at the diagnosed root cause and the desired capability-probe behavior.

## Deviations

None.

## Self-Check: PASSED

- RED tests are present and collected.
- Existing tests in both files still run.
- Implementation remains deferred to Plan 17-02.

