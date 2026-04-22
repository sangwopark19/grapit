---
phase: quick-260422-eya
plan: 01
subsystem: booking/seat-map-viewer
tags: [bugfix, regression, vitest, pr18-code-review]
requires:
  - apps/web/components/booking/booking-page.tsx::handleSeatClick (라인 184-208, locked → toast 분기)
provides:
  - "seat-map-viewer.tsx::handleClick — locked 좌석은 maxSelect 우회하여 parent 위임 (D-13 invariant 복원)"
affects:
  - apps/web/components/booking/seat-map-viewer.tsx (가드 1줄 수정)
  - apps/web/components/booking/__tests__/seat-map-viewer.test.tsx (회귀 테스트 3건 추가)
tech-stack:
  added: []
  patterns:
    - "viewer/parent 책임 분리: viewer는 onSeatClick 호출만 보장, parent가 locked toast 처리"
key-files:
  created: []
  modified:
    - apps/web/components/booking/seat-map-viewer.tsx
    - apps/web/components/booking/__tests__/seat-map-viewer.test.tsx
decisions:
  - "locked 좌석을 viewer maxSelect 가드에서 제외하여 parent의 toast 분기로 위임 (commit 45b884e invariant 유지)"
metrics:
  duration: ~7min
  completed: 2026-04-22
  tasks: 1
  files: 2
  tests_added: 3
  tests_total: 139
---

# Quick Task 260422-eya: seat-map-viewer maxSelect locked 회귀 수정 Summary

PR #18 리뷰 regression — `seat-map-viewer.tsx::handleClick`의 WR-02 fix(commit c7036e5)가 locked 좌석 클릭까지 차단하여 parent의 "이미 다른 사용자가 선택한 좌석입니다" toast가 표시되지 않던 문제를 가드에 `state !== 'locked'` 조건을 추가해 복구했다.

## Objective

PR #18 코드리뷰 regression 수정: maxSelect 도달 후 locked 좌석을 클릭해도 parent toast가 떠야 하는 동작(commit 45b884e D-13 invariant)을 복원한다.

## What Changed

### apps/web/components/booking/seat-map-viewer.tsx

handleClick 가드를 다음과 같이 수정 (라인 384-389):

Before:
```typescript
const state = seatStates.get(seatId) ?? 'available';
if (state === 'sold') return;
// 새로 선택하는 좌석이고 한도 초과면 무시 (해제는 항상 허용)
if (!selectedSeatIds.has(seatId) && selectedSeatIds.size >= maxSelect) {
  return;
}
onSeatClick(seatId);
```

After:
```typescript
const state = seatStates.get(seatId) ?? 'available';
if (state === 'sold') return;
// PR18-CR-MAXSELECT-LOCKED: locked는 maxSelect 우회하여 parent에 위임 (D-13 invariant), available 한도만 차단
if (
  state !== 'locked' &&
  !selectedSeatIds.has(seatId) &&
  selectedSeatIds.size >= maxSelect
) {
  return;
}
onSeatClick(seatId);
```

가드 의미:
- `sold` → viewer 차단 (기존 유지)
- `locked` (미선택) → maxSelect 우회 → parent로 위임 → parent가 toast (commit 45b884e invariant)
- `available` (미선택, 한도 도달) → viewer 차단 (WR-02 유지)
- 이미 선택된 좌석 → 항상 onSeatClick 호출 (해제 허용)

### apps/web/components/booking/__tests__/seat-map-viewer.test.tsx

회귀 방지 테스트 3건 추가 (PR18-CR-MAXSELECT-LOCKED 라벨):

1. `maxSelect 도달 후에도 locked 좌석 클릭은 parent로 위임된다` — selectedSeatIds={A-1, A-2}, maxSelect=2, B-1=locked → onSeatClick('B-1') 호출 검증
2. `회귀 방지: maxSelect 도달 시 sold 좌석은 여전히 viewer에서 차단` — B-1=sold → onSeatClick 미호출 검증
3. `회귀 방지: maxSelect 도달 시 available 좌석은 viewer에서 차단 (WR-02 유지)` — B-1=available → onSeatClick 미호출 검증

## Verification Results

| Check | Command | Result |
|-------|---------|--------|
| 단위 테스트 (RED) | `vitest run -t "PR18-CR-MAXSELECT-LOCKED"` | 1 fail / 2 pass (예상대로 locked 케이스만 RED) |
| 단위 테스트 (GREEN) | `vitest run components/booking/__tests__/seat-map-viewer.test.tsx` | 20/20 GREEN |
| 전체 web 회귀 | `vitest run` | 139/139 GREEN (기존 136 + 신규 3) |
| typecheck | `pnpm --filter @grapit/web typecheck` | 0 error |
| lint | `pnpm --filter @grapit/web lint` | 0 error (기존 warning 22건은 변경 외 파일) |

## Commits

| Hash | Message |
|------|---------|
| fcc6a7b | fix(quick-260422-eya): handleClick에 state !== 'locked' 가드 추가 (PR18-CR-MAXSELECT-LOCKED) |

## Deviations from Plan

None — plan executed exactly as written. Plan의 Step 1~5 모두 의도대로 진행 (RED → GREEN → 회귀 검사 → typecheck/lint).

참고: 작업 도구 환경 특성상 main repo 경로(`/Users/sangwopark19/icons/grapit/...`)와 worktree 경로(`/Users/sangwopark19/icons/grapit/.claude/worktrees/agent-ae96c5fe/...`)가 별개의 working tree로 존재하여, 초기 Edit이 main repo에 적용되었다. 검증(vitest 139/139, typecheck, lint) 후 동일 변경을 worktree에 cp로 옮기고 main을 `git checkout --`로 되돌려 worktree에 단일 커밋으로 정리. 변경 내용/파일/검증 결과는 plan 그대로다.

## Authentication Gates

None.

## Self-Check: PASSED

- [x] FOUND: apps/web/components/booking/seat-map-viewer.tsx (worktree, modified)
- [x] FOUND: apps/web/components/booking/__tests__/seat-map-viewer.test.tsx (worktree, modified)
- [x] FOUND: commit fcc6a7b
- [x] PR18-CR-MAXSELECT-LOCKED 라벨 테스트 3건 GREEN (vitest 20/20)
- [x] 전체 web 회귀 139/139 GREEN
- [x] typecheck 0 error
- [x] lint 0 error
- [x] booking-page.tsx 미수정
- [x] 코멘트 1줄로 최소화 (CLAUDE.md 준수)
