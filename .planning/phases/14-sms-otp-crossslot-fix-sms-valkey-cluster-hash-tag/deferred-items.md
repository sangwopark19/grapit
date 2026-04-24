# Phase 14 — Deferred Items

Pre-existing issues discovered during Phase 14 execution that are out of scope for any of its 4 plans. Both Plan 02 and Plan 03 independently observed the same failures on the Wave 2 base commit and recorded them here.

---

## Pre-existing failure: `apps/api/test/sms-throttle.integration.spec.ts` TTL unit tests — **RESOLVED 2026-04-24**

**Status:** Resolved by quick task `260424-l23` (commit `e65fa99`). Actual root cause: the filter matched `.includes('throttler')` but `@nest-lab/throttler-storage-redis` stores keys as `{<tracker>:<throttlerName>}:hits` — no "throttler" substring. Fixed by switching to `.endsWith(':hits')` matching. Unrelated to the Phase 13 `@grabit` namespace rename originally suspected. Integration suite now 30/30 green; Phase 14 ci.yml `test:integration` step PR green blocker cleared.

**Discovered by:** Plan 02 (2026-04-24) and independently by Plan 03 (2026-04-24)

**Failing tests (2):**

- `SMS Throttle Integration (testcontainers + Valkey) > TTL 단위 검증 > send-code Throttler가 1h=3600000ms TTL을 Valkey에 설정하는지 확인` (line ~232)
- `SMS Throttle Integration (testcontainers + Valkey) > TTL 단위 검증 > verify-code Throttler가 15min=900000ms TTL을 Valkey에 설정하는지 확인` (line ~261)

**Assertion:** `expect(throttlerKeys.length).toBeGreaterThan(0)` — the tests scan Valkey for keys whose name contains `throttler`/`Throttler` substring (or prefix `throttle:*`) after a single throttled request. Observed `0` matches.

**Suspected root cause:** `ThrottlerStorageRedisService` (from `@nest-lab/throttler-storage-redis`) stores keys under a prefix that no longer contains those substrings — likely a consequence of the Phase 13 `@grapit/* → @grabit/*` namespace rename changing the storage key namespace, or a `@nest-lab/throttler-storage-redis` version change to the key-naming convention. The throttler itself still functions (8 rate-limit behavior tests in the same file pass) — only the TTL introspection helper tests that assert on key substring are broken.

**Verified pre-existing:** `git stash` of Plan 02 edits and running `pnpm --filter @grabit/api test:integration sms-throttle -- --run` on the Wave 2 base commit `4ebb2e1` reproduces the same 2/13 failures (identical count, identical test names, identical assertions). Plan 03 independently hit the same failures while running the full integration suite before its ci.yml step.

**Why out-of-scope for Plan 02 / Plan 03:**

- **Scope boundary:** Plan 02 refactors the `VERIFY_AND_INCREMENT_LUA atomic script (Valkey EVAL)` describe block to import from `sms.service` exports (6/6 green after refactor). Plan 03 creates the new `sms-cluster-crossslot.integration.spec.ts` and adds the ci.yml step. Neither plan touches the failing TTL introspection tests.
- **Unrelated to CROSSSLOT fix:** these tests read throttler-internal keys (`throttle:*`), not the SMS OTP keys (`{sms:${e164}}:*`) that Plan 01 changed.
- **Pre-existing on base:** the failure exists before Phase 14 begins.

**Caveat for Plan 03 Task 2 (ci.yml):** Plan 03 added a `test:integration` step to `.github/workflows/ci.yml` per SC-2. Because these two TTL tests currently fail on the base, CI will go red on merge until they are repaired. Plan 03 did not authorize either a temp skip or a fix inside the failing file — this must be resolved by the Phase 14 orchestrator (or a follow-up quick task) **before Phase 14's PR can merge green**.

**Recommended resolution:** Open a `/gsd:quick` task to audit the throttler key-prefix under `@grabit/api`'s `@nestjs/throttler` + `@nest-lab/throttler-storage-redis` wiring — inspect `await redis.keys('*')` output to see the actual prefix and update the key-substring filter (or switch to a deterministic key assertion via a known request IP/route combination). Estimated effort: 15–30 minutes.
