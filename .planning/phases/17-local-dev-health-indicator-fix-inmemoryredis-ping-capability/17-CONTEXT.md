# Phase 17: Local dev health indicator fix - InMemoryRedis.ping() capability probe - Context

**Gathered:** 2026-04-29
**Status:** Complete - post-facto decision record

<domain>
## Phase Boundary

Phase 17 fixes a local development health regression: when `REDIS_URL` is unset in fresh local dev, the API uses `InMemoryRedis`, but `/api/v1/health` must not return 503 solely because the local fallback lacks an ioredis method.

The phase boundary is intentionally narrow:

- Add the minimum local fallback surface needed for health checks: `InMemoryRedis.ping()`.
- Add a defensive capability probe in `RedisHealthIndicator` so local/test Redis-like clients without `ping()` are reported as local fallback `up`.
- Preserve production safety: missing `REDIS_URL` in production still hard-fails, and real Redis/Valkey `ping()` failures still report `down`.
- Do not broaden the Redis mock into a full Redis implementation and do not change seat locking, SMS OTP, cache, Socket.IO, or production Redis provisioning behavior.

Because this context was gathered after 17-01/17-02 execution and verification, it records locked decisions, operational boundaries, and future maintenance rules rather than serving as pre-planning input.

</domain>

<decisions>
## Implementation Decisions

### Local Smoke Contract

- **D-01:** Automated verification is the canonical pass signal for the completed Phase 17. The phase is considered complete based on focused provider/health tests, full API tests, typecheck, lint, and `17-VERIFICATION.md`.
- **D-02:** A live local smoke remains the preferred operational confidence check when convenient, but it is not a retroactive blocker for this completed phase. Recommended command path:
  - `REDIS_URL= pnpm --filter @grabit/api dev`
  - `curl http://localhost:8080/api/v1/health`
  - Expected: HTTP 200 with Redis indicator `up`.
- **D-03:** If a future phase touches `HealthController`, `RedisHealthIndicator`, `redisProvider`, or local startup behavior, and the live smoke is not run, the residual risk must be called out explicitly the same way `17-VERIFICATION.md` does.

### Fallback Boundary

- **D-04:** Local/test fallback handling uses capability probes, not `NODE_ENV` branching, inside health/integration code. The deciding condition is whether the injected Redis-like client has the method needed for that code path.
- **D-05:** `InMemoryRedis` may gain a new method only when a real local/test code path needs that method and the method has focused tests that describe the expected ioredis-compatible behavior. Avoid broad mock completeness work.
- **D-06:** `ping()` is allowed because `/api/v1/health` depends on it and the correct local behavior is unambiguous: return `PONG`.
- **D-07:** `incr()` remains intentionally absent. Existing throttler fallback detection relies on `InMemoryRedis` not exposing `incr()`, and adding it would change `AppModule` behavior rather than merely improving surface parity.
- **D-08:** Any future addition to `InMemoryRedis` must include a regression test for the new surface and, where relevant, a guard test proving that production safety behavior remains unchanged.

### Production Safety

- **D-09:** Production missing `REDIS_URL` hard-fail is non-negotiable. The `redisProvider` production guard must remain the first line of defense against silent instance-local seat locking.
- **D-10:** The health indicator fallback applies only when `ping` is absent. If `ping` exists and rejects, or if it returns a value other than `PONG`, the Redis indicator must report `down`.
- **D-11:** Do not replace Redis health with a dev-mode skip in `HealthController`. Cloud Run health should continue to detect real Redis/Valkey connectivity loss.
- **D-12:** The message `ping unavailable; assuming local in-memory Redis mock` is reserved for local/test mock-like clients without `ping()`. It must not be used to mask real `IORedis` failures.

### Post-Facto Context Handling

- **D-13:** This `CONTEXT.md` is a post-facto decision record. The executed artifacts remain authoritative for what was built: `17-01-PLAN.md`, `17-02-PLAN.md`, `17-01-SUMMARY.md`, `17-02-SUMMARY.md`, and `17-VERIFICATION.md`.
- **D-14:** Downstream agents should use this context for audit, maintenance, or reopen decisions. Do not re-plan Phase 17 solely because this context was created after execution.
- **D-15:** If a new gap is discovered later, create a new phase or quick task that references this context and the debug artifact rather than reopening the completed plan history.

### the agent's Discretion

- Exact formatting of future live smoke evidence is flexible: a `HUMAN-UAT.md`, verification note, summary section, or PR checklist is acceptable if it captures command, environment, result, and timestamp.
- Future test file placement is flexible, but tests should stay close to the code path under protection: provider surface tests in `redis.provider.spec.ts`, health behavior tests in `redis.health.indicator.spec.ts`, and full module wiring tests only when the integration boundary changes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning, reopening, or modifying this area.**

### Phase 17 Definition and State

- `.planning/ROADMAP.md` — Phase 17 goal, requirements proxy (`SC-1`..`SC-4`), and completed plan list.
- `.planning/STATE.md` — Phase 17 roadmap evolution entry and locked decision: two-layer local health fix with `InMemoryRedis.ping()` plus capability probe.
- `.planning/debug/local-api-health-503-no-redis.md` — Root-cause diagnosis from Phase 13 UAT gap 1. This is the authoritative problem statement and reproduction record.

### Phase 17 Execution Artifacts

- `.planning/phases/17-local-dev-health-indicator-fix-inmemoryredis-ping-capability/17-RESEARCH.md` — Recommended fix, risks, and verification strategy.
- `.planning/phases/17-local-dev-health-indicator-fix-inmemoryredis-ping-capability/17-PATTERNS.md` — Provider test, health indicator test, capability probe, and `InMemoryRedis` surface parity patterns.
- `.planning/phases/17-local-dev-health-indicator-fix-inmemoryredis-ping-capability/17-01-PLAN.md` — RED test plan for `ping()` parity and no-ping health fallback.
- `.planning/phases/17-local-dev-health-indicator-fix-inmemoryredis-ping-capability/17-02-PLAN.md` — Implementation plan for `InMemoryRedis.ping()` and `RedisHealthIndicator` capability probe.
- `.planning/phases/17-local-dev-health-indicator-fix-inmemoryredis-ping-capability/17-01-SUMMARY.md` — RED execution summary and expected failing signals.
- `.planning/phases/17-local-dev-health-indicator-fix-inmemoryredis-ping-capability/17-02-SUMMARY.md` — Implementation summary, commits, verification commands, and guard checks.
- `.planning/phases/17-local-dev-health-indicator-fix-inmemoryredis-ping-capability/17-VERIFICATION.md` — Final verification evidence and residual risk note.

### Affected Code

- `apps/api/src/modules/booking/providers/redis.provider.ts` — `InMemoryRedis`, production `REDIS_URL` hard-fail, local fallback factory.
- `apps/api/src/health/redis.health.indicator.ts` — Terminus Redis health check and `ping` capability probe.
- `apps/api/src/health/health.controller.ts` — Public `/api/v1/health` route using `RedisHealthIndicator`.
- `apps/api/src/modules/booking/providers/redis-io.adapter.ts` — Existing `duplicate()` capability probe pattern that Phase 17 mirrors.
- `apps/api/src/app.module.ts` — Throttler storage wiring that depends on `InMemoryRedis` not exposing `incr()`.

### Regression Tests

- `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts` — `InMemoryRedis` surface parity tests, including `ping() returns PONG for local health checks`.
- `apps/api/src/health/__tests__/redis.health.indicator.spec.ts` — Health indicator tests for `PONG`, missing `ping`, rejected `ping`, and unexpected response.
- `apps/api/src/app.module.spec.ts` — Guard tests proving `InMemoryRedis` does not implement `incr()` and local throttler fallback remains intact.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `InMemoryRedis` in `apps/api/src/modules/booking/providers/redis.provider.ts`: local dev/test fallback that implements only the Redis subset used by the app.
- `RedisHealthIndicator` in `apps/api/src/health/redis.health.indicator.ts`: Terminus 11 health indicator using `HealthIndicatorService.check(key).up()/down()`.
- Provider and health focused specs: fast regression surface for this class of bug.

### Established Patterns

- Production config misconfiguration should hard-fail rather than silently degrade to local mocks.
- Capability probes are preferred over environment checks when code receives a Redis-like object that may be either real `IORedis` or `InMemoryRedis`.
- Local fallback methods are added incrementally and only when a concrete app path needs them.
- RED/GREEN split is already captured by 17-01 and 17-02: tests first, implementation second.

### Integration Points

- `REDIS_CLIENT` provider feeds both real `IORedis` and `InMemoryRedis` into consumers.
- `/api/v1/health` is public and wrapped by Terminus `HealthCheckService`.
- Cloud Run health depends on this route, so production Redis failures must remain visible.
- Local dev without `REDIS_URL` depends on `InMemoryRedis` for booking/SMS/cache-adjacent flows, but that fallback is not persistent and not multi-instance safe.

</code_context>

<specifics>
## Specific Ideas

- User selected all gray areas for capture: local smoke contract, fallback boundary, production safety wording, and post-facto context style.
- The phase exists because Phase 13 UAT surfaced a pre-existing Phase 7 health indicator gap; it is not a Phase 13 rename regression.
- The fix is deliberately two-layered: method parity for the known fallback plus defensive capability probing for future local/test fallback objects.
- The most important maintenance rule is negative: do not weaken production health or silently pass real Redis failures while making local dev friendlier.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope. Optional live local smoke remains a verification preference, not a new capability.

</deferred>

---

*Phase: 17-local-dev-health-indicator-fix-inmemoryredis-ping-capability*
*Context gathered: 2026-04-29*
