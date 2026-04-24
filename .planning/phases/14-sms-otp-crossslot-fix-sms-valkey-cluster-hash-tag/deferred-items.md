# Phase 14 — Deferred Items

Pre-existing issues discovered during execution that are out of scope for plan 14-03.

## From plan 14-03 (sms-cluster-crossslot integration test + ci.yml)

### Pre-existing failures in `apps/api/test/sms-throttle.integration.spec.ts` TTL-unit-check tests

Observed on base commit `4ebb2e1` during `pnpm --filter @grabit/api test:integration` execution:

```
 FAIL  test/sms-throttle.integration.spec.ts > SMS Throttle Integration > TTL 단위 검증 > send-code Throttler가 1h=3600000ms TTL을 Valkey에 설정하는지 확인
 AssertionError: expected 0 to be greater than 0 (test/sms-throttle.integration.spec.ts:232:36)

 FAIL  test/sms-throttle.integration.spec.ts > SMS Throttle Integration > TTL 단위 검증 > verify-code Throttler가 15min=900000ms TTL을 Valkey에 설정하는지 확인
 AssertionError: expected 0 to be greater than 0 (test/sms-throttle.integration.spec.ts:261:36)
```

**Root cause (suspected):** The tests scan for throttler keys via `redis.keys('throttle:*')` but @nestjs/throttler may be using a different key prefix than the test expects (likely due to Phase 13 rename `@grapit/* → @grabit/*` changing the storage key namespace). The throttler itself still functions — the 8 rate-limit behavior tests above these two all pass. Only the TTL/PTTL introspection helper tests are broken.

**Why deferred:**
- **Scope boundary:** plan 14-03 creates a *new* cluster-mode integration file + adds a ci.yml step. It does not modify `sms-throttle.integration.spec.ts`.
- **Unrelated to CROSSSLOT fix:** these tests read throttler-internal keys (`throttle:*`), not the SMS OTP keys (`{sms:${e164}}:*`) that plan 14-01 changed.
- **Pre-existing on base commit:** the failure is present before plan 14-03 begins and was not introduced by this plan's changes.

**Action:** Suggest opening a follow-up quick task (`/gsd:quick`) to audit the throttler key-prefix under `@grabit/api`'s `@nestjs/throttler` + `@nest-lab/throttler-storage-redis` wiring. These two tests can be repaired without touching any Phase 14 files.

**Caveat for plan 14-03 Task 2 (ci.yml):** Because these tests currently fail on the base commit, CI will go red when Task 2 enables `pnpm --filter @grabit/api test:integration`. Plan 14-03 cannot merge green until either (a) these are fixed by the follow-up quick task, or (b) plan 14-03 opens a temporary skip. The plan does not authorize either action, so this is flagged for the Phase 14 orchestrator/human-UAT to resolve before merging the wave.
