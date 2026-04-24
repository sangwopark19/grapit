---
phase: 14
plan: 02
subsystem: sms-otp / valkey-cluster / integration-test
tags: [sms, valkey, integration-test, refactor, drift-removal]
requires:
  - "14-01 (exports VERIFY_AND_INCREMENT_LUA + smsOtpKey + smsAttemptsKey + smsVerifiedKey from apps/api/src/modules/sms/sms.service.ts)"
provides:
  artifacts:
    - "apps/api/test/sms-throttle.integration.spec.ts — drift-free integration test importing single source of truth (VERIFY_AND_INCREMENT_LUA + 3 key builders)"
  downstream_effects:
    - "SC-3 partial: sms-throttle spec now re-uses Plan 01 exports, so any future sms.service key-scheme change propagates automatically to integration tests (D-13 closed loop)"
affects:
  - "SC-3 (API test suite green) — target describe block `VERIFY_AND_INCREMENT_LUA atomic script (Valkey EVAL)` is 6/6 green. Phase-wide fully-green gate confirmed in Plan 04 after Plan 03 lands."
  - "T-14-04 (test-source drift re-emergence) — structurally mitigated via OTP key literal grep gate (0) + no local Lua body copy"
tech-stack:
  added: []
  patterns:
    - "Single source of truth for Lua + key builders (tests import from production service)"
    - "ESM + Node module resolution .js suffix on relative src imports (matches existing integration spec convention, see admin-dashboard.integration.spec.ts)"
key-files:
  created:
    - ".planning/phases/14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag/deferred-items.md"
  modified:
    - "apps/api/test/sms-throttle.integration.spec.ts"
decisions:
  - "Import path uses `.js` suffix (ESM) — matches admin-dashboard.integration.spec.ts L8/L18/L19 convention in the same test dir"
  - "Kept 6 atomic-script describe bodies byte-identical except for key-literal → builder-call replacements and the single Lua-const removal; no test-logic changes"
  - "Pre-existing failures of 2 `TTL 단위 검증` tests documented as deferred (ThrottlerStorageRedisService key prefix evolved past the substring filter; out-of-scope for Plan 02)"
metrics:
  duration_min: 8
  completed_utc: 2026-04-24T05:41:57Z
  tasks_completed: 1
  commits: 2
---

# Phase 14 Plan 02: sms-throttle integration spec drift removal Summary

**One-liner:** `apps/api/test/sms-throttle.integration.spec.ts` 의 중복된 Lua 본체 (25줄) 와 OTP 키 리터럴 17 개를 Plan 01 이 export 한 4-symbol SoT (`VERIFY_AND_INCREMENT_LUA` + `smsOtpKey`/`smsAttemptsKey`/`smsVerifiedKey`) import 로 일괄 치환해, Phase 10.1 때 drift 로 standalone-green 상태가 프로덕션 cluster CROSSSLOT 을 가리던 구조를 근원 차단.

## Completed Tasks

| Task | Name                                                                       | Commit    | Files modified                                        |
| ---- | -------------------------------------------------------------------------- | --------- | ----------------------------------------------------- |
| 1    | Replace duplicated Lua body + key literal helper with imports              | `575ea5b` | `apps/api/test/sms-throttle.integration.spec.ts`      |
| —    | (chore) log pre-existing TTL-key-prefix failures in deferred-items.md      | `00517fc` | `.planning/phases/14-.../deferred-items.md` (created) |

## Modified Line Ranges

### `apps/api/test/sms-throttle.integration.spec.ts` (25 insertions, 43 deletions — net −18 lines)

- **L10-16 (+6 lines)** — added `import { VERIFY_AND_INCREMENT_LUA, smsOtpKey, smsAttemptsKey, smsVerifiedKey } from '../src/modules/sms/sms.service.js';` right after `import request from 'supertest';`.
- **L285-310 (removed 25-line Lua body)** — the duplicated `const VERIFY_AND_INCREMENT_LUA = \`…\`` block plus its "Must match sms.service.ts VERIFY_AND_INCREMENT_LUA exactly" comment is gone. Replaced with a 2-line note (`// D-13 SoT: …`) referencing the top-of-file import.
- **L312-316 → L294-298** — `keys(phone)` helper: replaced the 3 literal entries (`` `sms:otp:${phone}` ``, `` `sms:attempts:${phone}` ``, `` `sms:verified:${phone}` ``) with `smsOtpKey(phone)`, `smsAttemptsKey(phone)`, `smsVerifiedKey(phone)`.
- **6 scenario bodies (14 literal call-site replacements)** — every `` redis.set(`sms:otp:${phone}`, …) ``, `` redis.get(`sms:otp:${phone}`) ``, `` redis.get(`sms:attempts:${phone}`) ``, `` redis.get(`sms:verified:${phone}`) ``, `` redis.ttl(`sms:attempts:${phone}`) ``, `` redis.ttl(`sms:verified:${phone}`) `` call inside the 6 `it(…)` blocks under the `VERIFY_AND_INCREMENT_LUA atomic script (Valkey EVAL)` describe was replaced with the corresponding builder call.

## Verification Evidence

| Gate                                                                                                      | Expected                 | Actual               | Status |
| --------------------------------------------------------------------------------------------------------- | ------------------------ | -------------------- | ------ |
| `grep -c "^const VERIFY_AND_INCREMENT_LUA" apps/api/test/sms-throttle.integration.spec.ts`                | 0 (no local const decl)  | 0                    | PASS   |
| import block contains `VERIFY_AND_INCREMENT_LUA,`                                                         | ≥ 1                      | 1 (L12)              | PASS   |
| `grep -c "from '../src/modules/sms/sms.service" apps/api/test/sms-throttle.integration.spec.ts`           | ≥ 1                      | 1 (L16)              | PASS   |
| `grep -cE "sms:otp:|sms:attempts:|sms:verified:" apps/api/test/sms-throttle.integration.spec.ts`          | 0 (OTP literals removed) | 0                    | PASS   |
| `grep -cE "sms:phone:send:|sms:phone:verify:" apps/api/test/sms-throttle.integration.spec.ts` (pre=post)  | 0 (not used in this spec)| 0                    | PASS   |
| `grep -c "smsOtpKey|smsAttemptsKey|smsVerifiedKey" apps/api/test/sms-throttle.integration.spec.ts`        | ≥ 6                      | 20                   | PASS   |
| VERIFY_AND_INCREMENT_LUA symbol usage count                                                               | ≥ 6 (scenarios) + 1 import | 12 (1 import + 8 evals + 3 other) | PASS |
| `pnpm --filter @grabit/api typecheck`                                                                     | exit 0                   | exit 0               | PASS   |
| `pnpm --filter @grabit/api lint` — warnings on sms-throttle.integration.spec.ts                            | 0                        | 0                    | PASS   |
| Docker integration run — describe `VERIFY_AND_INCREMENT_LUA atomic script (Valkey EVAL)` (6 it blocks)    | 6 green                  | 6 green              | PASS   |
| Overall sms-throttle.integration.spec.ts full run                                                          | 11 green + 2 pre-existing failures (unchanged) | 11 green + 2 pre-existing failures (unchanged) | PASS (scope-limited) |

### Raw verification commands

```text
$ grep -c "^const VERIFY_AND_INCREMENT_LUA" apps/api/test/sms-throttle.integration.spec.ts
0
$ grep -cE "sms:otp:|sms:attempts:|sms:verified:" apps/api/test/sms-throttle.integration.spec.ts
0
$ grep -cE "sms:phone:send:|sms:phone:verify:" apps/api/test/sms-throttle.integration.spec.ts
0
$ pnpm --filter @grabit/api typecheck
# exit 0 (no TS errors)
$ pnpm --filter @grabit/api test:integration sms-throttle -- --run
# VERIFY_AND_INCREMENT_LUA atomic script (Valkey EVAL) — 6/6 green:
#   ✓ 정답 코드 → VERIFIED …
#   ✓ 오답 코드 → WRONG …
#   ✓ otp 없음 → EXPIRED
#   ✓ attempts 5회 초과 시 NO_MORE_ATTEMPTS …
#   ✓ attempts EXPIRE 900s 설정 확인
#   ✓ verified 플래그 TTL 600s 설정 확인
```

## Rate-Limit Literal Invariant (D-04) Proof

- Pre-edit `grep -cE "sms:phone:send:|sms:phone:verify:" apps/api/test/sms-throttle.integration.spec.ts` = **0**
- Post-edit same grep = **0**
- File never contained those literals — it uses `@nestjs/throttler` decorators (`@Throttle(...)`) not manual key writes, so the invariant is trivially preserved. (The rate-limit SERVICE keys that _do_ exist live in `sms.service.ts` and were locked in Plan 01 with pre=post=5.)

## Lua Body Single-Source-of-Truth (D-13) Proof

- Before: `apps/api/test/sms-throttle.integration.spec.ts` L285-310 held a byte-copy of the Lua script, prefaced with `// Must match sms.service.ts VERIFY_AND_INCREMENT_LUA exactly`. That copy was the exact drift vector which made Phase 10.1 ship a standalone-green test while production (cluster) threw CROSSSLOT.
- After: 0 occurrences of `^const VERIFY_AND_INCREMENT_LUA` in the spec. The sole reference is the `VERIFY_AND_INCREMENT_LUA,` import on L12, consumed by 8 `redis.eval(VERIFY_AND_INCREMENT_LUA, 3, …)` call sites across 6 `it(…)` bodies. Any future change to the Lua body in `sms.service.ts` propagates to this test without a second edit.

## Deviations from Plan

### [Rule 3 — blocking infra] `@grabit/shared` build not present on fresh worktree
- **Found during:** Task 1 verify (pre-commit typecheck).
- **Issue:** `pnpm --filter @grabit/api typecheck` failed with 30+ `Cannot find module '@grabit/shared'` errors — the shared package's `dist/` is `.gitignore`d and not rebuilt on a clean worktree.
- **Fix:** ran `pnpm install --prefer-offline` (node_modules missing) then `pnpm --filter @grabit/shared build`. Both succeeded; API typecheck subsequently exits 0.
- **Files modified:** none (infra only — lockfile and node_modules outside repo scope).
- **Commit:** no separate commit (setup work, not code change).

### [Out-of-scope pre-existing failure] 2 TTL-key-prefix tests
- **Found during:** Task 1 `acceptance test:integration sms-throttle -- --run`.
- **Issue:** `TTL 단위 검증 > send-code / verify-code Throttler가 …ms TTL을 Valkey에 설정하는지 확인` both fail with `expected 0 to be greater than 0` because `ThrottlerStorageRedisService` no longer writes keys whose names contain the `throttler`/`Throttler` substring.
- **Verified pre-existing:** `git stash` of Plan 02 edits before running the same command reproduces 2/13 identical failures. **Not caused by this refactor.**
- **Fix applied:** none (out-of-scope — Rule: auto-fix only issues DIRECTLY caused by current task). Documented in `.planning/phases/14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag/deferred-items.md` for a future cleanup pass.

## Authentication Gates

None. All work was edit / grep / `pnpm typecheck` / `pnpm lint` / `pnpm test:integration` / `git commit` — no auth boundaries crossed.

## Known Stubs

None. This plan is a pure refactor. No hardcoded empty values, placeholders, or TODO markers introduced.

## Threat Flags

None. Refactor-only test-side change — no new network endpoints, auth paths, file access patterns, or schema changes. Threat disposition from plan body (T-14-04 mitigate, T-14-05 accept) is now satisfied: the OTP key literal grep gate is 0 by construction, so a future contributor reintroducing `sms:otp:${…}` would have to physically undo the import — a visible diff signal.

## REVIEWS.md Concern Traceability

- **REVIEWS.md HIGH#2 (stale spec expectations):** already handled by Plan 01 Task 2 (`sms.service.spec.ts` + `redis.provider.spec.ts`). This plan touches a DIFFERENT spec file (`apps/api/test/sms-throttle.integration.spec.ts`) — drift-free by design after this edit.
- **REVIEWS.md MEDIUM#3 (final grep gate `rg "sms:otp:|sms:attempts:|sms:verified:" apps/api/src`):** unchanged — this spec is under `apps/api/test/`, outside the gate path. Phase-wide gate confirmed green by Plan 01 Self-Check.

## TDD Gate Compliance

Plan type is `execute` (refactor). The target describe block's 6 `it(…)` bodies were GREEN before the refactor (using literal keys against a standalone Valkey) and remain GREEN after the refactor (using imported builders that produce the exact same string values under Plan 01's output — `smsOtpKey('+821099990001')` = `'{sms:+821099990001}:otp'`, etc.). Behavior equivalence proof:

- Pre-edit keys: `sms:otp:+821099990001`, `sms:attempts:+821099990001`, `sms:verified:+821099990001`.
- Post-edit keys (via Plan 01 builders): `{sms:+821099990001}:otp`, `{sms:+821099990001}:attempts`, `{sms:+821099990001}:verified`.
- Standalone Valkey (the testcontainer used here) does NOT enforce hash-tag slot uniformity, so both key shapes work identically on the `redis.eval(…, 3, …)` and `redis.set/get/ttl/del(…)` surface. The cluster-mode regression guard (SC-2 / Pattern §4) is covered in Plan 03, not here.

This is a textbook "refactor under green test" cycle — no RED→GREEN ping-pong commit needed because the observable behavior is identical.

## Self-Check: PASSED

**Files:**
- `apps/api/test/sms-throttle.integration.spec.ts` — FOUND (modified, git diff HEAD~2 HEAD shows 25+/43− net −18 lines)
- `.planning/phases/14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag/deferred-items.md` — FOUND (created)
- `.planning/phases/14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag/14-02-SUMMARY.md` — FOUND (this file)

**Commits:**
- `575ea5b refactor(14-02): import Lua + key builders from sms.service in sms-throttle integration spec` — FOUND
- `00517fc chore(14-02): log pre-existing TTL-key-prefix failures in deferred-items.md` — FOUND

**Gates:**
- `grep -c "^const VERIFY_AND_INCREMENT_LUA" apps/api/test/sms-throttle.integration.spec.ts` → 0
- `grep -cE "sms:otp:|sms:attempts:|sms:verified:" apps/api/test/sms-throttle.integration.spec.ts` → 0
- `pnpm --filter @grabit/api typecheck` → exit 0
- `pnpm --filter @grabit/api test:integration sms-throttle -- --run` → 11/13 green (2/13 pre-existing failures out-of-scope, documented in deferred-items.md). Target describe block `VERIFY_AND_INCREMENT_LUA atomic script (Valkey EVAL)` → 6/6 green.

---

*Plan: 14-02 — sms-throttle integration spec drift removal (Lua + 3 OTP key builders imported from sms.service single source of truth)*
*Phase: 14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag*
*Completed: 2026-04-24T05:41:57Z*
