---
phase: 17-local-dev-health-indicator-fix-inmemoryredis-ping-capability
status: passed
verified: 2026-04-28
plans_verified: [17-01, 17-02]
gaps_found: 0
human_needed: false
---

# Phase 17 Verification

## Goal

`REDIS_URL` unset local dev fallback should no longer make `/api/v1/health` fail solely because `InMemoryRedis` lacks `ping()`.

## Result

Passed.

## Evidence

### InMemoryRedis ping parity

- File: `apps/api/src/modules/booking/providers/redis.provider.ts`
- Evidence: `InMemoryRedis` now implements:

```ts
async ping(): Promise<'PONG'> {
  return 'PONG';
}
```

Provider tests pass, including the new `ping() returns PONG for local health checks` test.

### Health indicator capability probe

- File: `apps/api/src/health/redis.health.indicator.ts`
- Evidence: `RedisHealthIndicator` checks for absent `ping()` before invoking it and reports local in-memory fallback as up.

Existing down cases remain covered:

- `redis.ping()` rejects -> down
- `redis.ping()` returns non-`PONG` -> down

### Production safety

Production missing `REDIS_URL` hard-fail remains in `redisProvider` and was not modified.

`InMemoryRedis` still does not implement `incr()`, preserving throttler fallback detection.

## Automated Checks

```bash
pnpm --filter @grabit/api exec vitest run \
  src/modules/booking/providers/__tests__/redis.provider.spec.ts \
  src/health/__tests__/redis.health.indicator.spec.ts \
  --reporter=verbose
```

Result: 15/15 passed.

```bash
pnpm --filter @grabit/api typecheck
```

Result: passed.

```bash
pnpm --filter @grabit/api lint
```

Result: exit 0, with 36 pre-existing warnings outside this phase.

```bash
pnpm --filter @grabit/api test
```

Result: 29/29 test files passed, 323/323 tests passed.

## Residual Risk

No live `/api/v1/health` smoke was run in this turn. The unit coverage targets the diagnosed code path directly.
