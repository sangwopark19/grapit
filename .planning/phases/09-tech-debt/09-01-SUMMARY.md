---
phase: 09-tech-debt
plan: 01
subsystem: web-ui
tags:
  - tech-debt
  - refactor
  - tdd
  - sonner
  - utility-extraction
  - dead-code-removal
dependency_graph:
  requires: []
  provides:
    - "apps/web/lib/format-datetime.ts (nullable-safe formatDateTime util)"
    - "sonner classNames.info variant for locked-seat toast"
  affects:
    - "apps/web/components/booking/booking-page.tsx (2 toast call sites simplified)"
    - "apps/web/components/admin/admin-booking-detail-modal.tsx (uses shared util)"
    - "apps/web/hooks/use-booking.ts (useShowtimes removed)"
tech_stack:
  added: []
  patterns:
    - "nullable-safe formatter (string | null | undefined) -> string with em dash empty state"
    - "sonner toastOptions.classNames with variant-per-status (success/error/info)"
key_files:
  created:
    - "apps/web/lib/format-datetime.ts"
    - "apps/web/lib/format-datetime.test.ts"
  modified:
    - "apps/web/components/admin/admin-booking-detail-modal.tsx"
    - "apps/web/components/ui/sonner.tsx"
    - "apps/web/components/booking/booking-page.tsx"
    - "apps/web/hooks/use-booking.ts"
decisions:
  - "DEBT-03 'regression'은 존재하지 않음을 RESEARCH 단계에서 확인 — production seat-map-viewer.tsx는 손대지 않고 toast 인라인 style만 sonner classNames로 일원화"
  - "formatDateTime 유틸 추출 범위는 admin-booking-detail-modal 1개 파일만 (min scope) — booking-complete/reservation-detail/admin-booking-table 3개 파일은 non-null caller라서 건드리지 않음 (Pitfall 5 회피)"
  - "useShowtimes 훅은 서버에 엔드포인트 미존재 + enabled:false 상태였으므로 완전 제거 (UX 영향 없음)"
  - "TDD RED/GREEN 커밋을 squash하지 않고 원자적으로 보존 — 최종 HEAD만 CI 평가"
metrics:
  duration_minutes: 3
  completed_date: "2026-04-14"
---

# Phase 9 Plan 1: Quick Cleanup (DEBT-03/04/06) Summary

## One-Liner

Sonner classNames.info 변형 도입으로 locked-seat info toast 인라인 style 제거(DEBT-03), `apps/web/lib/format-datetime.ts` nullable-safe 유틸 추출로 admin-booking-detail-modal 삼항 제거(DEBT-04), 서버에 없는 엔드포인트를 가리키던 `useShowtimes` 훅 완전 삭제(DEBT-06).

## Objective Met

CI 초록 상태를 Plan 2 진입 전에 확정하고, UI-SPEC이 확정한 sonner 변형 결정을 수용하며, dead code를 제거해 다음 phase 작업 베이스를 깨끗하게 만드는 것 — 완료.

## Closure Evidence per DEBT

### DEBT-03 (locked-seat toast 일원화)

- **Change:** `apps/web/components/ui/sonner.tsx`의 `classNames`에 `info: 'bg-info-surface text-info border-info/20'` 추가 + `apps/web/components/booking/booking-page.tsx`의 toast.info 2곳(L192, L249) 인라인 `style={{ backgroundColor, color }}` 완전 제거.
- **Verification:**
  - `pnpm --filter @grapit/web test seat-map-viewer` → **7/7 PASS** (production `seat-map-viewer.tsx` 미변경, 회귀 없음)
  - `grep -q "info: 'bg-info-surface text-info border-info/20'" apps/web/components/ui/sonner.tsx` → exit 0
  - `! grep -q "style: { backgroundColor" apps/web/components/booking/booking-page.tsx` → exit 0
  - `grep -c "toast.info('이미 다른 사용자가 선택한 좌석입니다')" apps/web/components/booking/booking-page.tsx` → 2 (두 호출부 모두 plain)
- **Commit:** `503fc6f refactor(09-tech-debt): unify locked-seat info toast via sonner classNames (DEBT-03)`

### DEBT-04 (formatDateTime nullable-safe 유틸)

- **Change:** `apps/web/lib/format-datetime.ts` 신규 생성 — 시그니처 `(string | null | undefined) => string`, null/undefined/invalid 시 em dash `—` (U+2014) 반환. `admin-booking-detail-modal.tsx`에서 로컬 `function formatDateTime` 삭제 + 삼항 `paidAt ? formatDateTime(paidAt) : '—'` 제거(util 내부에서 null 처리).
- **Verification:**
  - `pnpm --filter @grapit/web test format-datetime` → **4/4 PASS** (null, undefined, valid ISO, invalid 케이스)
  - `pnpm --filter @grapit/web typecheck` → 0 errors
  - `grep -c 'function formatDateTime' apps/web/components/admin/admin-booking-detail-modal.tsx` → 0 (인라인 정의 제거)
  - `grep -q "from '@/lib/format-datetime'" apps/web/components/admin/admin-booking-detail-modal.tsx` → exit 0
  - 다른 3개 파일(booking-complete/reservation-detail/admin-booking-table)은 **미변경** — Pitfall 5 회피 확인
- **Commits:** `1469238 test(09-tech-debt): add failing format-datetime tests` (RED) → `f56e4cf refactor(09-tech-debt): extract formatDateTime util with nullable signature (DEBT-04)` (GREEN)

### DEBT-06 (useShowtimes dead code 제거)

- **Change:** `apps/web/hooks/use-booking.ts`에서 `useShowtimes` 함수 전체(10줄) 삭제. `apps/web/components/booking/booking-page.tsx`에서 import/호출/useMemo 의존성 모두 정리 — `allShowtimes`가 `performance?.showtimes ?? []`만 사용하도록 단순화.
- **Verification:**
  - `grep -rn 'useShowtimes' apps/` → 0건 (완전 제거, comment 포함 전역)
  - `grep -rn 'showtimesData' apps/web/` → 0건
  - `grep -c 'export function useShowtimes' apps/web/hooks/use-booking.ts` → 0
  - `grep -c 'performance?.showtimes ?? \[\]' apps/web/components/booking/booking-page.tsx` → 1
- **Commit:** `b546975 refactor(09-tech-debt): remove dead useShowtimes hook (DEBT-06)`

## Plan-Level Checks (Wave-complete)

- `pnpm typecheck` → **Tasks: 4 successful, 4 total** (0 errors)
- `pnpm lint` → **Tasks: 3 successful, 3 total** (0 errors, 18 pre-existing warnings — 모두 본 Plan 변경 범위 밖, CLAUDE.md 지침상 미수정)
- `pnpm test` → **Tasks: 3 successful** — API 160/160 PASS, web 91/91 PASS (format-datetime 4/4, seat-map-viewer 7/7 포함)

## Files Modified (Actual vs Planned)

| Planned | Actual | Status |
|---------|--------|--------|
| apps/web/components/ui/sonner.tsx | apps/web/components/ui/sonner.tsx | ✓ |
| apps/web/components/booking/booking-page.tsx | apps/web/components/booking/booking-page.tsx | ✓ |
| apps/web/lib/format-datetime.ts | apps/web/lib/format-datetime.ts | ✓ (신규) |
| apps/web/lib/format-datetime.test.ts | apps/web/lib/format-datetime.test.ts | ✓ (신규) |
| apps/web/components/admin/admin-booking-detail-modal.tsx | apps/web/components/admin/admin-booking-detail-modal.tsx | ✓ |
| apps/web/hooks/use-booking.ts | apps/web/hooks/use-booking.ts | ✓ |

6개 파일 정확히 일치 (PLAN.md frontmatter와 100% 매치).

## Pitfall Triggers

| Pitfall | Description | Triggered? |
|---------|-------------|------------|
| Pitfall 4 | Production seat-map-viewer.tsx 수정 | ❌ No — git diff HEAD~4 -- apps/web/components/booking/seat-map-viewer.tsx 가 완전 비어있음 |
| Pitfall 5 | 4개 파일 formatDateTime 통합 시 포맷 불일치 | ❌ No — admin-booking-detail-modal 1개 파일만 교체, 나머지 3개는 미변경 |
| Lint warning 증가 | 내 변경으로 warning이 늘었는지 | ❌ No — 18건 모두 pre-existing (eslint.config.mjs의 `import/no-anonymous-default-export` + use-countdown.ts의 `react-hooks/refs`) |

## TDD Push 정책 준수

- RED 커밋(`1469238`) + GREEN 커밋(`f56e4cf`)이 **분리된 원자적 커밋**으로 보존됨 (squash 없음, REVIEWS.md LOW 반영)
- 4개 커밋 모두 로컬에만 존재 — 중간 push 없음. 최종 HEAD는 모든 task 통과 상태로 외부 CI 평가 대상.

## Deviations from Plan

### Minor Auto-adjustment

**1. [Rule 3 - Blocking] comment 내 "useShowtimes" 키워드 제거**
- **Found during:** Task 3 acceptance check
- **Issue:** 단순화된 `allShowtimes` useMemo 위에 "useShowtimes removed" 라는 히스토릭 comment를 달았으나, `grep -rn 'useShowtimes' apps/ | wc -l` 가 0이 아닌 1이 되어 acceptance criteria와 충돌
- **Fix:** comment를 "All showtimes sourced from performance detail" 로 단축하여 키워드 제거
- **Files modified:** apps/web/components/booking/booking-page.tsx
- **Commit:** 동일 task 커밋 `b546975`에 포함 (수정 후 스테이지)

그 외 deviation 없음 — plan 원본 그대로 실행.

## Auth Gates

없음 — Plan 01은 로컬 refactor만 수행, 외부 서비스/API 호출 없음.

## Known Stubs

없음 — 모든 변경이 완전한 기능 교체 또는 dead code 삭제.

## Commits (in order)

| # | Commit | Message |
|---|--------|---------|
| 1 | `1469238` | `test(09-tech-debt): add failing format-datetime tests` (RED) |
| 2 | `f56e4cf` | `refactor(09-tech-debt): extract formatDateTime util with nullable signature (DEBT-04)` (GREEN) |
| 3 | `503fc6f` | `refactor(09-tech-debt): unify locked-seat info toast via sonner classNames (DEBT-03)` |
| 4 | `b546975` | `refactor(09-tech-debt): remove dead useShowtimes hook (DEBT-06)` |

## Duration

약 3분 (actual execution, dependency install 제외).

## Next

**Plan 02 (09-02-PLAN.md):** Terms 약관 MD 파일화 (DEBT-02) + Resend + React Email 이메일 서비스 실구현 (DEBT-01). Wave 2.

## Self-Check: PASSED

### Files Created/Modified Exist

- [x] `apps/web/lib/format-datetime.ts` — FOUND
- [x] `apps/web/lib/format-datetime.test.ts` — FOUND
- [x] `apps/web/components/admin/admin-booking-detail-modal.tsx` — modified (no inline formatDateTime, imports from @/lib/format-datetime)
- [x] `apps/web/components/ui/sonner.tsx` — modified (classNames.info added)
- [x] `apps/web/components/booking/booking-page.tsx` — modified (no inline toast style, useShowtimes reference removed)
- [x] `apps/web/hooks/use-booking.ts` — modified (useShowtimes deleted)

### Commits Exist in git log

- [x] `1469238` — FOUND (test: add failing format-datetime tests)
- [x] `f56e4cf` — FOUND (refactor: extract formatDateTime util)
- [x] `503fc6f` — FOUND (refactor: unify locked-seat info toast)
- [x] `b546975` — FOUND (refactor: remove dead useShowtimes hook)

### Acceptance Criteria

- [x] `pnpm typecheck` (root) exits 0
- [x] `pnpm lint` (root) exits 0 (warnings only, all pre-existing)
- [x] `pnpm test` (root) exits 0 — format-datetime 4/4 PASS, seat-map-viewer 7/7 PASS
- [x] `grep -rn 'useShowtimes' apps/` → 0건
- [x] `apps/web/lib/format-datetime.ts` exports `formatDateTime` with nullable signature
- [x] `apps/web/components/ui/sonner.tsx` contains `info: 'bg-info-surface text-info border-info/20'`
- [x] `apps/web/components/booking/booking-page.tsx` no `style: { backgroundColor` inline prop on toast.info
- [x] `apps/web/components/booking/seat-map-viewer.tsx` unchanged (empty diff)
- [x] 4개의 의미 있는 commit (test RED + 3 refactors)
