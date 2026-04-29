---
phase: 17
slug: local-dev-health-indicator-fix-inmemoryredis-ping-capability
status: complete
---

# Phase 17 Patterns

## Provider Test Pattern

Use the existing `redis.provider.spec.ts` factory helper:

```ts
process.env['NODE_ENV'] = 'test';
const client = useFactory(createMockConfig('')) as unknown as MemRedis;
```

Extend the local `MemRedis` type only for methods under test. Keep assertions focused on public behavior, not private class access.

## Health Indicator Test Pattern

`redis.health.indicator.spec.ts` already builds a fake Terminus service:

```ts
const indicator = new RedisHealthIndicator(mockHealth as never, mockRedis as never);
```

Use the same pattern for a no-ping client:

```ts
const redisWithoutPing = { get: vi.fn() };
const indicator = new RedisHealthIndicator(mockHealth as never, redisWithoutPing as never);
```

Expected result: status `up`, with a message documenting local in-memory fallback.

## Capability Probe Pattern

Mirror `RedisIoAdapter.connectToRedis()`:

```ts
const maybeClient = this.redis as { ping?: unknown };
if (typeof maybeClient.ping !== 'function') {
  return indicator.up({ message: 'ping unavailable; assuming local in-memory Redis mock' });
}
```

Important:

- The guard checks capability, not `NODE_ENV`.
- Existing reject/unexpected response paths remain down.
- Production empty `REDIS_URL` is still blocked in `redisProvider`.

## InMemoryRedis Surface Parity

Add the minimal ioredis-compatible command:

```ts
async ping(): Promise<'PONG'> {
  return 'PONG';
}
```

Do not add `incr()`: `AppModule` throttler fallback tests intentionally assert that `InMemoryRedis` lacks `incr()`.

