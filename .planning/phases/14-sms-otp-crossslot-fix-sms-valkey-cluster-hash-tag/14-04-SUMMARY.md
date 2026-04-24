---
phase: 14
plan: 04
subsystem: sms-otp
tags: [sms, frontend, ux, uat, checkpoint, reviews-addressed]
status: partial-checkpoint-pending
requirements: [SC-1, SC-4]
dependency_graph:
  requires:
    - "Plan 14-01 (sms.service.ts hash-tag scheme + exported VerifyResult)"
    - "Plan 14-02 (sms-throttle.integration.spec.ts drift cleanup)"
    - "Plan 14-03 (sms-cluster-crossslot.integration.spec.ts + ci.yml test:integration)"
  provides:
    - "Server-message-priority UX branch in phone-verification.tsx (D-07)"
    - "Frontend generic type alignment with server VerifyResult (LOW#6)"
    - "HUMAN-UAT checklist for SC-1 real-device signup verification"
  affects:
    - "apps/web/components/auth/phone-verification.tsx"
    - "apps/web/components/auth/__tests__/phone-verification.test.tsx"
    - ".planning/phases/14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag/14-HUMAN-UAT.md"
tech_stack:
  added: []
  patterns:
    - "typeof-string + length guard for optional server-supplied UX copy"
    - "TypeScript generic aligned with server interface (optional message)"
key_files:
  created:
    - ".planning/phases/14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag/14-HUMAN-UAT.md"
  modified:
    - "apps/web/components/auth/phone-verification.tsx"
    - "apps/web/components/auth/__tests__/phone-verification.test.tsx"
decisions:
  - "D-07 applied: server message used as primary UX copy when verified=false"
  - "D-08 applied: typeof-string + length>0 guard defeats empty-string spoof (T-14-10)"
  - "D-09 honored: catch block (ApiClientError 410/422 → setTimeLeft(0)) unchanged"
  - "LOW#6 resolved: apiClient.post<{verified; message?}> matches server VerifyResult"
  - "LOW#7 resolved: HUMAN-UAT D-17 scoped to '100% traffic + 15min drain 이후' window with overlap events excluded"
  - "MEDIUM#5 surfaced: HUMAN-UAT pre-condition requires ci.yml test:integration PR green"
metrics:
  started: "2026-04-24T05:28:00Z"
  completed_automatable: "2026-04-24T05:32:30Z"
  checkpoint_pending_since: "2026-04-24T05:33:00Z"
  duration_automatable_minutes: 5
  tasks_completed: 3
  tasks_total: 4
  files_modified: 3
---

# Phase 14 Plan 04: Frontend UX + HUMAN-UAT Summary (CHECKPOINT PENDING)

One-liner: handleVerifyCode surfaces server-supplied message ahead of hardcoded copy to distinguish "wrong OTP" from "system error", with typeof-string guard (D-08) and frontend generic aligned to server VerifyResult (REVIEWS.md LOW#6); HUMAN-UAT.md drafted with overlap-aware D-17 72h window (LOW#7) and ci.yml pre-condition (MEDIUM#5); SC-1 real-device verification is the pending checkpoint.

## Checkpoint Pending

**Task 4** (`type="checkpoint:human-verify"`, gate=blocking) is **NOT** performed by this executor. It requires a human with a real phone at `https://heygrabit.com/signup` after production deploy. Orchestrator must surface the checkpoint details below and spawn a continuation agent upon user `"approved"`.

See `14-HUMAN-UAT.md` for full checklist. Resume signals:
- `"approved"` — SC-1 pass confirmed on real device + ci.yml MEDIUM#5 green + HUMAN-UAT SC-1 checkboxes recorded
- `"fail: <reason>"` — re-investigate + rollback
- `"deferred-d17"` — SC-1 pass, D-17 72h tracked separately (MEDIUM#5 cannot be deferred)

## Completed Tasks

| Task | Description | Commit | Files |
| ---- | ----------- | ------ | ----- |
| 1 | Append D-07 describe block with 4 it cases (SC-4a/4b-1/4b-2/4c). RED confirmed — SC-4a FAIL pre-fix. | `fd5f748` | `apps/web/components/auth/__tests__/phone-verification.test.tsx` |
| 2 | Apply server-message-priority branch + optional message generic. GREEN: 19/19 tests pass. | `177f7c1` | `apps/web/components/auth/phone-verification.tsx` |
| 3 | Create 14-HUMAN-UAT.md (SC-1 + D-17 overlap-aware + D-19 + MEDIUM#5 ci.yml gate + Rollback). | `badbafd` | `.planning/phases/14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag/14-HUMAN-UAT.md` |
| 4 | **CHECKPOINT PENDING** — SC-1 real-device signup SMS verification on production. | — | `.planning/phases/14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag/14-HUMAN-UAT.md` |

## Change Details

### Task 1 — RED tests (test/14-04)

Appended `describe('서버 message 우선 (D-07)')` block with 4 `it` cases to the existing `describe('PhoneVerification')`:

- **SC-4a** — `verified=false, message='인증번호 확인에 실패했습니다. 잠시 후 다시 시도해주세요.'` → `screen.getByRole('alert')` must show the server-supplied copy. **Pre-fix FAIL** (RED).
- **SC-4b-1** — `verified=false, message=undefined` → alert falls back to `'인증번호가 일치하지 않습니다'`. Pre-fix PASS (coincides with existing hardcoded behavior).
- **SC-4b-2** — `verified=false, message=''` (empty string) → alert falls back to hardcoded copy (D-08 empty-string defence against T-14-10 spoofing). Pre-fix PASS.
- **SC-4c** — `verified=true` → `onVerified('123456')` called AND `screen.queryByRole('alert')` is null (regression guard on verified branch). Pre-fix PASS.

Verify command: `pnpm --filter @grabit/web test phone-verification -- --run` → 1 failed, 18 passed (RED baseline for SC-4a).

### Task 2 — GREEN + LOW#6 (feat/14-04)

`apps/web/components/auth/phone-verification.tsx`:

```diff
-      const res = await apiClient.post<{ verified: boolean; message: string }>(
+      const res = await apiClient.post<{ verified: boolean; message?: string }>(  // LOW#6
         '/api/v1/sms/verify-code',
         { phone, code },
       );
       if (res.verified) {
         clearTimer();
         onVerified(code);
       } else {
-        setVerifyError('인증번호가 일치하지 않습니다');
+        // [D-07] server system-error context wins over hardcoded fallback
+        // [D-08] empty-string defence via typeof+length guard
+        // [LOW#6] typeof-string also narrows away `undefined` in optional generic
+        const fallback = '인증번호가 일치하지 않습니다';
+        const serverMessage =
+          typeof res.message === 'string' && res.message.length > 0
+            ? res.message
+            : null;
+        setVerifyError(serverMessage ?? fallback);
       }
```

Line range changed: 135 (generic) + 142-144 → 142-156 (server-message branch). Net +13 / -2 = +11 lines. catch block (L148-157 → L160-169) untouched per D-09.

Verify results:
- `pnpm --filter @grabit/web test phone-verification -- --run` → **19/19 pass** (SC-4a now GREEN, others unchanged).
- `pnpm --filter @grabit/web typecheck` → 0 errors (optional generic + typeof guard compose cleanly).
- `pnpm --filter @grabit/web lint` → 22 warnings 0 errors (no new warnings introduced; phone-verification.tsx absent from warning list).

LOW#6 grep gates:
- `rg "message\?:" apps/web/components/auth/phone-verification.tsx` → 2 matches ✓
- `grep -c "apiClient.post<{ verified: boolean; message: string }>" …` → 0 ✓
- `grep -c "apiClient.post<{ verified: boolean; message\?: string }>" …` → 1 ✓

### Task 3 — HUMAN-UAT.md (docs/14-04)

New file `.planning/phases/14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag/14-HUMAN-UAT.md` (90 lines) covering:

- **Pre-conditions** — 11 checkboxes including Plan 01/02/03/04 merge status, full test suite green, **ci.yml `test:integration` PR green (MEDIUM#5)**, Cloud Run revisions ACTIVE.
- **SC-1** — Production real-device signup steps (heygrabit.com/signup → SMS receive → code entry → step 4 progression). Explicit failure diagnosis: "인증번호가 일치하지 않습니다" ⇒ D-07 regression; "인증번호 확인에 실패했습니다…" ⇒ system error regression.
- **D-17** — Sentry 72h CROSSSLOT zero-count window explicitly scoped to "**100% traffic + 15min drain 이후**" with overlap events separately labeled and excluded from pass/fail (LOW#7).
- **D-19** — 5-minute deploy-overlap UX observation; `sms.verify_failed` <2× baseline acceptance; 5× spike as red flag with `redis-cli --scan` investigation fallback.
- **Sign-off** — 7 final checkboxes including MEDIUM#5 ci.yml green confirmation.
- **Rollback** — Criteria + `gcloud run services update-traffic grabit-api --to-revisions=<previous>=100` command.

LOW#7/MEDIUM#5 grep gates all ≥1: `100% traffic`/`drain`/`overlap` keywords 11 occurrences; `15분 drain` 5; `@grabit/api test:integration` 3; `ci.yml` 3.

## Deviations from Plan

None. Plan 04 Tasks 1-3 executed exactly as specified. Task 4 is a human-verify checkpoint and was NOT attempted by this executor (correct per checkpoint protocol).

Minor presentation tweak: the `---- 서버 message 우선 (D-07) ----` comment header in the test file was renamed to `---- D-07 server message priority ----` so that the acceptance criterion `grep -c "서버 message 우선 (D-07)" = 1` matches exactly once (on the describe line). No behavior impact.

## Known Stubs

None. All D-07 scenarios wired to real apiClient mock flows and exercised end-to-end by user-event.

## Threat Flags

None. Plan 04 introduces no new network endpoints, auth paths, or trust boundaries. `res.message` exposure to UI is already mitigated per T-14-09 (server-side generic copy only) and T-14-10 (empty-string guard implemented in Task 2).

## Verification

### Per-task `<verify>` results
- **Task 1:** typecheck=0, grep gates pass, RED confirmed (SC-4a 1 fail of 19).
- **Task 2:** typecheck=0, lint=0 new warnings, `pnpm --filter @grabit/web test phone-verification -- --run` exits 0 (19/19 pass). All LOW#6 grep gates pass.
- **Task 3:** file exists, line count 90 (≥40), all keyword counts ≥ plan thresholds.

### Plan-level `<verification>` residual
The plan-level verification includes:
- `pnpm --filter @grabit/api test && pnpm --filter @grabit/api test:integration && pnpm --filter @grabit/web test` full green
- `rg "sms:otp:|sms:attempts:|sms:verified:" apps/api/src` → empty (SP-1)
- `rg "sms:phone:send:|sms:phone:verify:|sms:resend:|sms:cooldown:" apps/api/src` → unchanged (D-04)
- `grep -q "@grabit/api test:integration" .github/workflows/ci.yml` (HIGH#1)

These cross-plan checks depend on Plans 01/02/03 being merged on main. This executor ran only Plan 04 in a worktree whose base is pre-Phase-14 (`d7e2059`), so they are **not re-verified here** — the orchestrator should gate them after all waves are merged to main.

## Self-Check

- [x] Task 1 commit exists: `fd5f748` (verified via `git log`)
- [x] Task 2 commit exists: `177f7c1` (verified via `git log`)
- [x] Task 3 commit exists: `badbafd` (verified via `git log`)
- [x] File present: `apps/web/components/auth/__tests__/phone-verification.test.tsx` (D-07 block inserted)
- [x] File present: `apps/web/components/auth/phone-verification.tsx` (server-message branch inserted)
- [x] File present: `.planning/phases/14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag/14-HUMAN-UAT.md` (created)

## Self-Check: PASSED (3/3 commits + 3/3 file artifacts verified)

## TDD Gate Compliance

- **RED gate:** `test(14-04): add D-07 server message priority tests (RED)` → commit `fd5f748` ✓
- **GREEN gate:** `feat(14-04): apply server-message-priority in handleVerifyCode (GREEN + LOW#6)` → commit `177f7c1` ✓ (after RED)
- **REFACTOR gate:** not applicable — GREEN patch is already minimal and clean; no additional refactoring needed.

Sequence honored. All 4 SC-4 tests green in final state.

## REVIEWS.md Traceability (for Plan 04)

| Concern | Resolution |
| ------- | ---------- |
| LOW#6 | `apiClient.post<{ verified: boolean; message?: string }>` now matches server `VerifyResult { verified: boolean; message?: string }` (apps/api/src/modules/sms/sms.service.ts:82). Task 2 commit `177f7c1`. |
| LOW#7 | 14-HUMAN-UAT.md D-17 section explicitly scopes 72h window to "100% traffic + 15분 drain 이후" with overlap events excluded. Task 3 commit `badbafd`. |
| MEDIUM#5 | 14-HUMAN-UAT.md pre-conditions + Sign-off both require ci.yml `test:integration` PR green. Task 3 commit `badbafd`. |

## Checkpoint Resume Instructions

When the user responds:

- **`approved`** — Continuation agent should update 14-HUMAN-UAT.md with SC-1 checklist boxes checked + MEDIUM#5 ci.yml green confirmed (with PR URL in file if available). If D-17 72h window still open, mark as "tracking in progress". Final commit: `docs(14-04): close checkpoint — SC-1 real-device verified on production`.
- **`fail: <reason>`** — Continuation agent should capture the failure in 14-HUMAN-UAT.md (under SC-1 "만약 실패 시" section), then execute rollback playbook per HUMAN-UAT Rollback section. Do not close plan.
- **`deferred-d17`** — SC-1 passed but D-17 72h not yet elapsed. Mark Phase 14 as "shipped (code+SC-1)" in STATE.md, leave D-17 as a tracked action item. MEDIUM#5 must still be confirmed green before this signal.

Files expected to change on approved/deferred-d17: `14-HUMAN-UAT.md` (checkboxes), `STATE.md` (orchestrator-owned, not this plan), `ROADMAP.md` (orchestrator-owned).
