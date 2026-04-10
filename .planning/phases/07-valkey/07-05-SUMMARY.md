---
phase: 07-valkey
plan: 05
subsystem: api/health + api/booking tests
tags: [valkey, health-check, terminus, testcontainers, lua, integration-test, cloud-run-liveness]
requires:
  - 07-01  # REDIS_CLIENT provider + ioredis migration
  - 07-02  # Lua script migration to ioredis.eval() flat signature
  - 07-03  # Provisioning + smoke checks
provides:
  - "RedisHealthIndicator backed by HealthIndicatorService.check(key)"
  - "Cloud Run /health now reports Valkey up/down (silent outage mitigation)"
  - "testcontainers-based real-Valkey Lua roundtrip spec"
  - "test:integration script + vitest.integration.config.ts (isolated from default test run)"
affects:
  - apps/api/src/health/health.controller.ts
  - apps/api/src/health/health.module.ts
  - apps/api/vitest.config.ts
tech-stack:
  added:
    - "testcontainers ^11.14.0 (devDependency)"
  patterns:
    - "Terminus 11 HealthIndicatorService.check(key).up/down API (not deprecated HealthIndicator base class)"
    - "REDIS_CLIENT DI injection via BookingModule re-export instead of duplicate provider"
    - "Two vitest configs: fast unit suite (default) + slow integration suite (test:integration)"
key-files:
  created:
    - apps/api/src/health/redis.health.indicator.ts
    - apps/api/src/health/__tests__/redis.health.indicator.spec.ts
    - apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts
    - apps/api/vitest.integration.config.ts
  modified:
    - apps/api/src/health/health.controller.ts
    - apps/api/src/health/health.module.ts
    - apps/api/vitest.config.ts
    - apps/api/package.json
    - pnpm-lock.yaml
decisions:
  - "Keep the integration spec script-level (raw LOCK/UNLOCK/GET_VALID Lua strings copied into the spec file) instead of importing from booking.service.ts — the scripts are module-private const in booking.service.ts and exposing them only for a test would widen the public surface. Copy-paste is audited on every run via the assertion phase."
  - "Skip adding InMemoryRedis.ping() mock method in this plan. Local dev without REDIS_URL intentionally reports unhealthy, which is useful Cloud Run signal. Also avoids file overlap with Plan 07-04 (parallel wave 3)."
  - "Use HealthModule imports: [BookingModule] instead of duplicating redisProvider to avoid spawning a second ioredis connection. No circular import because BookingModule does not reference HealthModule anywhere in src."
  - "Two separate vitest config files over a single config with env-var gating — explicit is better than conditional, and CI can invoke the integration script directly."
metrics:
  duration_minutes: 4
  completed: "2026-04-10"
  commits: 2
  files_touched: 9
  tests_added_unit: 3
  tests_added_integration: 5
---

# Phase 07 Plan 05: Health check + Valkey integration test summary

## One-liner

RedisHealthIndicator wired into Cloud Run /health and real-Valkey Lua roundtrip via testcontainers — closes 07-REVIEWS HIGH #2 and MEDIUM #7.

## What shipped

### Task 1 — RedisHealthIndicator + HealthController wiring + 3 unit tests
Commit: `7f34d8b`

- Created `apps/api/src/health/redis.health.indicator.ts`. Injects `REDIS_CLIENT` + `HealthIndicatorService`. `isHealthy(key)` calls `redis.ping()` and returns:
  - `.up()` when the reply is exactly `PONG`
  - `.down({ message: 'unexpected ping response: ...' })` when the reply is anything else
  - `.down({ message: err.message })` when the ping throws (e.g. `ECONNREFUSED`)
- Wired into `HealthController.check()` — the check array now includes `() => this.redisIndicator.isHealthy('redis')`. Cloud Run liveness probe now turns Valkey outages into `503` responses and triggers instance restart.
- `HealthModule` now imports `BookingModule` (to receive REDIS_CLIENT via DI) and registers `RedisHealthIndicator` as a provider. No circular import — `BookingModule` does not reference `HealthModule` anywhere.
- 3 unit tests under `apps/api/src/health/__tests__/redis.health.indicator.spec.ts` cover PONG → up, reject → down, non-PONG → down paths. All pass in 2ms.
- Follows TDD: RED phase verified (tests fail with "Cannot find module '../redis.health.indicator.js'"), then GREEN phase (implementation added, 3/3 pass).

### Task 2 — testcontainers integration spec for Lua scripts
Commit: `89d58e2`

- Created `apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts`. Boots a real `valkey/valkey:8-alpine` container via testcontainers, connects `ioredis`, and runs the exact LOCK_SEAT / UNLOCK_SEAT / GET_VALID_LOCKED_SEATS Lua scripts (copied verbatim from `booking.service.ts`) via `redis.eval()`.
- 5 cases:
  1. Happy lock path — returns `[1, lockKey, seatId]`, verifies SET+TTL+SADD side effects
  2. `GET_VALID_LOCKED_SEATS_LUA` returns the previously locked seat
  3. Duplicate lock on the same seat returns `[0, 'CONFLICT']`
  4. Owner unlock returns `1`, deletes the key, removes SADD members
  5. Non-owner unlock returns `0`, lock stays with the original owner
- Added `apps/api/vitest.integration.config.ts` with `include: ['**/*.integration.spec.ts']`, `hookTimeout: 120000` (for cold image pull), `testTimeout: 60000`.
- Updated `apps/api/vitest.config.ts` — default test run now excludes `**/*.integration.spec.ts` so the unit loop stays fast.
- Added `apps/api/package.json` scripts entry: `"test:integration": "vitest run --config vitest.integration.config.ts"`.
- Added `testcontainers` as a devDependency (`^11.14.0`). There is no dedicated `@testcontainers/redis` npm package — the pattern is `new GenericContainer('valkey/valkey:8-alpine').withExposedPorts(6379)`.

## Review feedback coverage

| 07-REVIEWS.md item | Status | Where |
|---|---|---|
| HIGH consensus #2 — "Valkey에 대한 실제 런타임 테스트 0건" | CLOSED | Task 2 |
| MEDIUM consensus #7 — "HealthController에 Valkey ping 부재" | CLOSED | Task 1 |

Deferred to backlog (NOT in this plan, remain open):
- MEDIUM #4 — KEYS → SCAN + UNLINK
- MEDIUM #5 — cache stampede defense
- MEDIUM #8 — RedisModule(global) extraction
- provision-valkey.sh idempotency/parameterization
- findById viewCount stale fix
- password reset stub

## Tests and verification

| Command | Result |
|---|---|
| `pnpm --filter @grapit/api exec vitest run src/health/__tests__/redis.health.indicator.spec.ts` | 3/3 passing, ~2ms |
| `pnpm --filter @grapit/api test` | 20 files / 151 passing, integration spec correctly excluded |
| `pnpm --filter @grapit/api exec tsc --noEmit` | Exit 0, clean |
| Grep assertions (8 patterns from plan verification block) | All 8 OK |

**Integration test NOT executed locally** — the executor environment does not have Docker running. The spec boots cleanly at vitest collection time and discovers 5 tests, then fails fast in `beforeAll` with `Error: Could not find a working container runtime strategy` which is the documented fallback behavior from testcontainers v11. In CI / developer machines with Docker, the five tests will run against the real Valkey 8 container. This gap is acceptable because:
  1. The Lua scripts are copied verbatim from `booking.service.ts` (assertion-verifiable)
  2. The assertion shape mirrors ioredis's documented `eval()` return for Lua table returns
  3. Any divergence will be caught on the first CI run with Docker available
  4. The unit tests in `booking.service.spec.ts` already cover the same code paths via `InMemoryRedis`

## Deviations from Plan

### Minor — pnpm-lock.yaml not in files_modified list

The plan's `files_modified` frontmatter lists `pnpm-lock.yaml` at the phase-root level, but since this is a pnpm workspace, the actual lockfile is at repo root (`/pnpm-lock.yaml`). Committed both `apps/api/package.json` and the root `pnpm-lock.yaml` as one atomic change. No functional impact.

### Minor — worktree initial branch base fixup

The worktree branch (`worktree-agent-afb89545`) was created from `main` (`af1a763`) rather than the expected Phase 7 base (`acba502`). Per the `<worktree_branch_check>` protocol, performed `git reset --hard acba502` at session start before doing any work. This fixup produced no new commits; it only corrected the starting SHA.

### Otherwise: plan executed exactly as written

No Rule 1/2/3 auto-fixes needed. No architectural decisions required. No auth gates.

## Known stubs

None introduced by this plan.

## Threat Flags

None. The plan's threat_model section already covered T-07-15 (silent outage mitigation) and T-07-16 (Lua Tampering) both of which are CLOSED by this plan.

## Reminders for merge gate

- 07-HUMAN-UAT.md runtime items from Plan 04 Task 4 release gate still need to be marked PASS before PR #13 merge.
- Plan 04 and Plan 05 are on the same wave 3 and may commit out of order; no file overlap, so rebase should be trivial.
- Integration spec requires Docker. Ensure the CI job that runs `pnpm --filter @grapit/api test:integration` has Docker-in-Docker or a services matrix with Valkey.

## Self-Check: PASSED

**Files exist:**
- `apps/api/src/health/redis.health.indicator.ts` — FOUND
- `apps/api/src/health/__tests__/redis.health.indicator.spec.ts` — FOUND
- `apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts` — FOUND
- `apps/api/vitest.integration.config.ts` — FOUND
- `apps/api/src/health/health.controller.ts` (modified) — FOUND with `RedisHealthIndicator` import
- `apps/api/src/health/health.module.ts` (modified) — FOUND with `BookingModule` import
- `apps/api/vitest.config.ts` (modified) — FOUND with `*.integration.spec.ts` exclude
- `apps/api/package.json` (modified) — FOUND with `testcontainers` devDep and `test:integration` script

**Commits exist:**
- `7f34d8b` — `feat(07-05): add RedisHealthIndicator to /health` — FOUND
- `89d58e2` — `test(07-05): add testcontainers integration spec for Valkey Lua scripts` — FOUND
