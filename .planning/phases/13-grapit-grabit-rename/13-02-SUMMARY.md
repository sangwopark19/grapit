---
phase: 13-grapit-grabit-rename
plan: 02
subsystem: user-facing-copy
tags: [rename, ui, email, sms, legal, grabit, heygrabit, no-op-verification]

# Dependency graph
requires:
  - phase: 13-grapit-grabit-rename
    plan: 01
    provides: "bulk multi-pattern rename (D-10 inventory, `\\bGrapit\\b` 포함) + legal MD `@heygrabit.com` email transition (D-07) 이 실행되어 Plan 02 surface 까지 이미 흡수됨"
provides:
  - "SC-2 gate green: UI/email/SMS/legal 모든 사용자-노출 surface 에 `Grapit` / `@grapit.com` / `[Grapit]` 잔여 0 증명"
  - "Plan 02 scope 의 13개 타겟 파일 모두 최종 상태 (`Grabit` + `@heygrabit.com`) 확정"
  - "D-07 legal email 전환 (최소 4건 `@heygrabit.com`) 검증"
  - "D-15 negative audit (legal MD 내부 deferred HTML 주석 없음) 검증"
  - "D-17 sms.service.spec.ts:137 fixture 단순 치환 ('Grabit' alphanumeric KISA 반례 유지) 검증"
affects: [13-03, 13-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "post-merge state verification (Wave 1 결과 머지 후 Wave 2 의 target state 가 이미 달성되었을 때 no-op 검증 + SUMMARY 커밋 패턴)"
    - "multi-layer acceptance audit (task-by-task rg + 전역 SC-2 audit + audit-brand-rename.sh + unit test + web build 5단 gate)"

key-files:
  created:
    - ".planning/phases/13-grapit-grabit-rename/13-02-SUMMARY.md"
  modified: []

key-decisions:
  - "Plan 02 대상 13개 파일 모두 Plan 01 Task 1 의 `\\bGrapit\\b` 멀티 패턴 bulk sed 에 의해 이미 치환 완료 상태 → 중복 수정 불필요, 파일 수정 0 건으로 no-op 검증"
  - "Task 1-3 를 개별 `refactor(13-02):` 커밋으로 분할하지 않고, SUMMARY.md 단일 `docs(13-02):` 커밋으로 통합 (파일 수정이 0 이라 분할의 의미가 없음)"
  - "D-15 negative audit 추가 실행: legal MD 에 `Phase 13 deferred follow-up` HTML 주석이 존재하지 않음을 증명 (Plan 01 이 legal MD 작업 시 주석을 추가하지 않았는지 검증)"
  - "D-17 은 spec L137 fixture 가 이미 `'Grabit'` 으로 치환되어 있고 alphanumeric 속성 유지로 KISA 반례 의도 유효 — 별도 allowlist 미도입 (Plan 의 D-17 결정 그대로 이행)"

patterns-established:
  - "Wave 2 파일 surface 가 Wave 1 bulk rename 에 흡수된 경우 : 파일 수정 0 + SUMMARY 커밋 + 전체 acceptance gate 증빙"
  - "audit-brand-rename.sh 를 Plan 02 수용 기준 (verification gate) 재사용 — Plan 01 이 정의한 audit 이 Plan 02 SC-2 까지 커버"

requirements-completed:
  - SC-2
  - SC-4

# Metrics
duration: ~2min
completed: 2026-04-22
---

# Phase 13 Plan 02: User-Facing Copy Rename Summary

**Plan 02 의 13 개 타겟 파일이 Plan 01 의 D-10 inventory-driven bulk rename 에 의해 이미 `Grabit` / `@heygrabit.com` 상태로 치환되어 있었음 — Plan 02 Wave 2 는 추가 파일 수정 없이 전체 acceptance gate (UI rg audit + email/SMS rg audit + legal rg audit + D-15 negative audit + unit tests + web build + audit-brand-rename.sh + SC-4 historical diff) 를 재실행해 SC-2 / SC-4 완료 상태를 확정.**

## Performance

- **Duration:** ~2 min (worktree 기준)
- **Started:** 2026-04-22T05:58:29Z (worktree agent spawn)
- **Completed:** 2026-04-22T05:59:43Z
- **Tasks:** 3 (모두 no-op verification)
- **Files modified:** 0 (SUMMARY.md 1 개만 created)

## Accomplishments

- **SC-2 gate green 확정**: 아래 5 단 audit 전부 통과
  1. `rg -l '\bGrapit\b' apps/web/app apps/web/components --glob '!*.test.*' --glob '!*.spec.*'` → **0 files**
  2. `rg -c '\bGrapit\b|\[Grapit\]' apps/api/src/modules/auth/email/email.service.ts apps/api/src/modules/sms/sms.service.ts apps/api/src/modules/sms/sms.service.spec.ts | awk -F: '{s+=$2} END {print s+0}'` → **0**
  3. `rg -l 'Grapit|@grapit\.com' apps/web/content/legal/` → **0 files**
  4. `rg -l '\bGrapit\b|@grapit\.com|\[Grapit\]' apps/web/app apps/web/components apps/web/content apps/api/src/modules/auth/email apps/api/src/modules/sms` → **0 files**
  5. `./scripts/audit-brand-rename.sh` → `ALL CHECKS PASSED`
- **D-07 legal email 전환 확정**: `rg -c '@heygrabit\.com' apps/web/content/legal/ | awk -F: '{s+=$2} END {print s}'` = **4** (terms-of-service.md×1 + privacy-policy.md×3).
- **D-15 negative audit 신규 증명**: `rg -l 'Phase 13 deferred follow-up|\[Phase 13 deferred' apps/web/content/legal/` = **0** — legal MD 내부에 deferred HTML 주석이 추가되지 않았음.
- **D-17 fixture 상태 확인**: `rg -q "INFOBIP_SENDER: 'Grabit'" apps/api/src/modules/sms/sms.service.spec.ts` exit **0** (L137 단순 치환 완료, 'Grabit' alphanumeric 유지로 KISA 반례 유효).
- **Unit test green**: `pnpm --filter @grabit/api test -- email.service.spec sms.service.spec` → 29 test files / 283 tests **all pass** (vitest 가 `--` 뒤 필터를 전체로 확대 실행한 결과, 전체 API test suite 통과).
- **Web build green**: `pnpm --filter @grabit/web build` → 13 routes (6 static + 7 dynamic) emit, exit 0.
- **SC-4 historical preservation 확정**: `git diff --name-only efcc6b2...HEAD -- .planning/milestones/ .planning/phases/0[1-9]-* .planning/phases/09.1-* .planning/phases/10.1-* .planning/phases/11-* .planning/phases/12-* .planning/quick/` → empty.

## Task Commits

1. **Task 1 (UI copy rename, 7 files)** — no source commit; state already satisfied by Plan 01 commit `4948787` (`refactor(13-01): rename @grapit/* scope to @grabit/* across monorepo + D-10 inventory-driven rename`). Plan 02 Wave 2 는 검증만 수행.
2. **Task 2 (Email/SMS + unit spec, 3 files)** — no source commit; state already satisfied by Plan 01 commit `4948787` (bulk `\bGrapit\b` pattern applied to `apps/api/src/modules/auth/email/email.service.ts` + `apps/api/src/modules/sms/sms.service.ts` + `apps/api/src/modules/sms/sms.service.spec.ts`). D-17 의 L137 fixture 도 같은 bulk 치환으로 `'Grabit'` 이 됨.
3. **Task 3 (Legal MD + D-07 email, 3 files)** — no source commit; state already satisfied by Plan 01 commit `6dc66ea` (`refactor(13-01): rename docs + legal MDs + add audit-brand-rename.sh (D-10 allowlist)`). D-07 `@grapit.com → @heygrabit.com` 전단 치환도 Plan 01 Task 3 에서 수행됨.

**SUMMARY commit** (Plan 02 의 유일한 커밋): `docs(13-02): ...` — `.planning/phases/13-grapit-grabit-rename/13-02-SUMMARY.md` (신규 생성).

## Files Created/Modified

**Created (1):**
- `.planning/phases/13-grapit-grabit-rename/13-02-SUMMARY.md` — Phase 13 Plan 02 완료 요약 + Wave 1 흡수 deviation 기록.

**Modified (0):**
- Plan 02 의 <files> 선언 13 개 파일 모두 수정 필요 없음. 전수 검증 결과 acceptance criteria 전부 green.

## Decisions Made

- **Task 1-3 개별 `refactor(13-02):` 커밋 분할 미채택.** 실제 파일 수정이 0 이므로 `git commit --allow-empty` 로 분할해도 빈 커밋 3 개만 생기고 meaningful history 를 제공하지 않음. SUMMARY 내 task-by-task acceptance 결과 표가 동일한 추적 정보를 훨씬 더 명료하게 제공한다고 판단. 단일 `docs(13-02):` SUMMARY 커밋으로 통합.
- **Unit test 필터 확장은 deviation 아님.** `pnpm --filter @grabit/api test -- email.service.spec sms.service.spec` 가 vitest 에서 path filter 로 동작하지 않고 전체 283 tests 실행 → 모두 green. Plan 의 요구사항("두 spec 이 green") 는 오히려 더 강하게 충족됨 (regression 검출 범위 확장).
- **Wave 1 bulk rename 흡수 확인 방법.** Plan 01 SUMMARY 의 "7-pattern bulk sed" 기재 + Plan 02 타겟 13 파일 전수 rg 스캔 (`\bGrapit\b` / `\[Grapit\]` / `@grapit\.com`) 결과 **모든 파일 현재 `Grabit` / `@heygrabit.com` 상태** 로 교차 증명.

## Deviations from Plan

### Wave 1 Absorption (Plan 02 scope 가 Plan 01 bulk rename 에 흡수됨)

**[Rule N/A — Deviation-but-not-fix] Plan 01 D-10 inventory-driven bulk sed 가 Plan 02 의 13 개 타겟 파일까지 이미 치환함**

- **Found during:** Task 1 read-first 단계 — 7 개 UI 파일 read 시 이미 `Grabit` 문자열 상태.
- **Diagnosis:**
  - Plan 01 Task 1 STEP 0 inventory 는 `rg -l 'grapit|Grapit|@grapit/|@grapit\.' --glob '!.planning/**' --glob '!pnpm-lock.yaml' --glob '!node_modules/**' --glob '!apps/*/dist/**' --glob '!apps/*/.next/**' --glob '!packages/*/dist/**' --glob '!.claude/**'` 로 동적 구성됨 — Plan 02 <files> 선언 13 파일 모두 여기 포함됨.
  - Plan 01 Task 1 STEP 4 bulk rename 이 `@grapit/` + `\bGrapit\b` + `grapit_test` + `grapit-uploads` + `cdn\.grapit\.kr` + `admin@grapit\.test` + `@e2e\.grapit\.dev` 의 멀티 패턴으로 inventory 파일 전체에 sed 적용.
  - Plan 01 Task 3 의 legal MD 수작업 섹션이 `@grapit.com → @heygrabit.com` 전단 치환 수행 (Plan 01 SUMMARY key-files.modified 중 `apps/web/content/legal/{privacy-policy,terms-of-service,marketing-consent}.md` 기재).
- **Net effect on Plan 02:** <files> 선언된 13 파일 모두 코드 편집 불필요, 상태 이미 달성. Plan 02 Task 별 done criteria 는 "파일 내용이 `Grabit` 상태" 이므로 검증만으로 충족.
- **Files affected:** (Plan 01 이 이미 수정, Plan 02 는 수정 0)
  - UI: apps/web/app/layout.tsx, apps/web/app/page.tsx, apps/web/components/layout/{gnb,footer,mobile-menu}.tsx, apps/web/components/admin/admin-sidebar.tsx, apps/web/app/admin/layout.tsx
  - Email/SMS: apps/api/src/modules/auth/email/email.service.ts, apps/api/src/modules/sms/sms.service.{ts,spec.ts}
  - Legal: apps/web/content/legal/{terms-of-service,privacy-policy,marketing-consent}.md
- **Verification:** 전수 rg scan 전부 green (위 Accomplishments 5 단 audit 참조).
- **Why not rolled into Plan 01:** Plan 02 는 논리적 "사용자 노출 카피" 경계를 독립 PR 로 리뷰하기 위한 단위 — 실제 치환은 Plan 01 과정에서 자연 발생했지만, Phase 13 체크포인트와 SC-2 gate 증명을 Plan 02 Wave 로 유지하여 롤백/리뷰 단위 불변. (Plan 01 Task 1 커밋 한 개로 UI + email + SMS + legal 까지 다 들어간 것은 plan 의 원래 의도보다 scope 가 넓은 bulk 동작이었음 — 수정보다 사후 검증이 훨씬 저비용.)
- **Impact on plan spec:** 없음. Plan 02 의 verification / acceptance_criteria 가 모두 green 으로 확인됨.

### Auto-fixed Issues

None — Plan 02 Wave 2 는 파일 수정 0 이므로 auto-fix 발생 여지 없음.

### Auth Gates

None.

## Issues Encountered

- **`node_modules` 없음:** worktree 스폰 직후 `pnpm install --frozen-lockfile` 실행 필요했음. 설치 후 `@grabit/shared` build 선행 수행 (Plan 01 SUMMARY 에 이미 보고된 "build artifact 재생성" 이슈와 동일) → typecheck/test green.
- **없음 — 실제 실패 건 0.**

## User Setup Required

없음.

## Next Phase Readiness

- **Plan 03 (P3 — 인프라 식별자 생성) 진입 조건 충족:**
  - SC-2 gate 전구간 green (UI/email/SMS/legal 모든 user-facing surface 에 `Grapit` / `@grapit.com` 잔여 0).
  - SC-4 historical preservation 유지 (Plan 02 worktree 에서 수정된 파일 0 건).
  - `audit-brand-rename.sh` 가 Plan 03 에서도 동일 스크립트로 재사용 가능 — deploy.yml rename 이 들어오면 Plan 03 은 스크립트의 `--glob '!.github/workflows/deploy.yml'` 제외 플래그를 제거하여 audit scope 를 확장해야 함.
- **Plan 03 Task 주요 reminder:**
  - `deploy.yml` 의 `AR_REPO=grapit` / `WEB_SERVICE=grapit-web` / `API_SERVICE=grapit-api` / `@grapit/api` pnpm filter rename (Plan 01 이 scope 제외했음).
  - `grabit-web` / `grabit-api` 신규 Cloud Run 서비스 provisioning + `api.heygrabit.com` 서브도메인 domain-mapping (D-09).
  - 신규 Sentry 프로젝트 생성 + DSN 교체 (D-12 admin-diagnostics _sentry-test endpoint).
  - 신규 Artifact Registry 저장소 생성 + `grapit-cloudrun@` SA reader 권한 확인 (D-11).
  - GitHub vars `CLOUD_RUN_API_URL=https://api.heygrabit.com` 세팅 후 두 번째 deploy 재실행 검증 (D-13).
- **Plan 13-04 (도메인 cutover) 에서 처리될 deferred note (D-15 이관):** `support@heygrabit.com`, `privacy@heygrabit.com` mailbox 실제 개설 — 사업자등록 후 Cloudflare Email Routing 또는 Workspace Admin. 본 SUMMARY 의 next-phase-readiness 가 이 follow-up 을 공식 인지. Plan 13-04 Task 6 이 `.planning/PROJECT.md` Concerns 섹션 + `13-04-SUMMARY.md` `Additional post-phase tasks` 블록에 최종 이관 기록.

## Self-Check: PASSED

- `.planning/phases/13-grapit-grabit-rename/13-02-SUMMARY.md` — FOUND (created this plan, about to be committed)
- Plan 02 <files> 선언 13 파일 존재 확인:
  - `apps/web/app/layout.tsx` — FOUND
  - `apps/web/app/page.tsx` — FOUND
  - `apps/web/components/layout/gnb.tsx` — FOUND
  - `apps/web/components/layout/footer.tsx` — FOUND
  - `apps/web/components/layout/mobile-menu.tsx` — FOUND
  - `apps/web/components/admin/admin-sidebar.tsx` — FOUND
  - `apps/web/app/admin/layout.tsx` — FOUND
  - `apps/api/src/modules/auth/email/email.service.ts` — FOUND
  - `apps/api/src/modules/sms/sms.service.ts` — FOUND
  - `apps/api/src/modules/sms/sms.service.spec.ts` — FOUND
  - `apps/web/content/legal/terms-of-service.md` — FOUND
  - `apps/web/content/legal/privacy-policy.md` — FOUND
  - `apps/web/content/legal/marketing-consent.md` — FOUND
- Plan 01 referenced commits — FOUND:
  - `4948787` (refactor(13-01): rename @grapit/*) — present in worktree base
  - `e08e6db` (refactor(13-01): dev/CI DB + seed) — present in worktree base
  - `6dc66ea` (refactor(13-01): docs + legal MDs + audit) — present in worktree base
- `./scripts/audit-brand-rename.sh` — exit **0**, `ALL CHECKS PASSED`
- `pnpm --filter @grabit/api test -- email.service.spec sms.service.spec` — 283/283 pass, **0 fail**
- `pnpm --filter @grabit/web build` — exit **0**, 13 routes emit
- SC-2 audit: UI + email/SMS + legal + 전역 stale — 모두 **0**
- D-15 negative audit: `Phase 13 deferred follow-up` 주석 — **0 matches**
- D-07 `@heygrabit.com` count — **4** (≥ 4 요구 충족)
- D-17 L137 fixture `INFOBIP_SENDER: 'Grabit'` — FOUND
- SC-4 historical diff (base `efcc6b2` → HEAD): .planning/milestones/, phases/0[1-9]-*, 09.1-*, 10.1-*, 11-*, 12-*, quick/ — **empty** (active 13-* 예외 LOW #11 적용)
- Plan 02 worktree 수정 파일 : 1 (`.planning/phases/13-grapit-grabit-rename/13-02-SUMMARY.md` — 이 파일 자체)

---
*Phase: 13-grapit-grabit-rename*
*Wave 2 (Plan 02) — User-facing copy rename (absorbed by Wave 1 bulk rename)*
*Completed: 2026-04-22*
