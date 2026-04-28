---
phase: 17
slug: local-dev-health-indicator-fix-inmemoryredis-ping-capability
status: complete
source:
  - .planning/debug/local-api-health-503-no-redis.md
  - apps/api/src/modules/booking/providers/redis.provider.ts
  - apps/api/src/health/redis.health.indicator.ts
  - apps/api/src/health/__tests__/redis.health.indicator.spec.ts
---

# Phase 17 Research

## Problem

Fresh local API startup with `REDIS_URL` unset can serve most development flows through `InMemoryRedis`, but `/api/v1/health` returns 503.

Confirmed root cause from `.planning/debug/local-api-health-503-no-redis.md`:

- `redisProvider` returns `new InMemoryRedis() as unknown as IORedis` when `redis.url` is empty and `NODE_ENV !== 'production'`.
- `InMemoryRedis` currently implements the subset used by booking/SMS/cache paths, but it does not implement `ping()`.
- `RedisHealthIndicator.isHealthy()` unconditionally calls `this.redis.ping()`.
- Runtime result in local fallback: `this.redis.ping is not a function`, caught as indicator down, then Terminus converts down status to health 503.

## Relevant Code

### `apps/api/src/modules/booking/providers/redis.provider.ts`

- `InMemoryRedis` is a local development/test fallback only.
- Production with empty `REDIS_URL` already hard-fails, so adding fallback health behavior does not mask production misconfiguration.
- Existing parity tests live in `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts`.

### `apps/api/src/health/redis.health.indicator.ts`

- Uses Terminus 11 `HealthIndicatorService.check(key).up()/down()` API.
- Existing tests cover real-ish redis `ping()` success, rejection, and unexpected response.
- Missing test coverage: injected redis client without `ping()`.

### Existing Capability Probe Pattern

`apps/api/src/modules/booking/providers/redis-io.adapter.ts` checks:

```ts
if (typeof maybeClient.duplicate !== 'function') {
  // assume InMemoryRedis mock and fall back
}
```

Phase 17 should use the same capability-probe style for health, not environment string checks.

## Recommended Fix

Use a two-layer fix:

1. Add `async ping(): Promise<'PONG'>` to `InMemoryRedis`.
2. Add a defensive capability probe in `RedisHealthIndicator`:
   - If `redis.ping` is not a function, return `indicator.up({ message: 'ping unavailable; assuming local in-memory Redis mock' })`.
   - If `redis.ping` exists, preserve current behavior: `PONG` -> up, reject/unexpected -> down.

Why both:

- `InMemoryRedis.ping()` restores ioredis surface parity and fixes the known local fallback.
- The capability probe prevents the same class of failure if another local/test fallback lacks `ping()`.

## Verification Strategy

Fast checks:

- `pnpm --filter @grabit/api exec vitest run src/modules/booking/providers/__tests__/redis.provider.spec.ts src/health/__tests__/redis.health.indicator.spec.ts`
- `pnpm --filter @grabit/api typecheck`
- `pnpm --filter @grabit/api lint`

Optional local smoke after implementation:

- Start API with `REDIS_URL` unset.
- `curl http://localhost:8080/api/v1/health` should return 200.

## Risks

- Do not weaken production health. Production still depends on `REDIS_URL` hard-fail in `redisProvider`.
- Do not make real Redis ping failures pass. The capability probe must only apply when `ping` is absent, not when it exists and fails.
- Do not add `incr()` to `InMemoryRedis`; existing throttler detection relies on its absence.

