---
phase: 12-ux
fixed_at: 2026-04-22T10:22:30Z
review_path: .planning/phases/12-ux/12-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-04-22T10:22:30Z
**Source review:** `.planning/phases/12-ux/12-REVIEW.md`
**Iteration:** 1

**Summary:**
- 범위 내 finding: 3건 (Warning 3, Critical 0)
- Info 6건: 범위 제외 (fix_scope=critical_warning)
- 수정 완료: 3건
- Skip: 0건
- 상태: `all_fixed`

검증 방식:
- Tier 1: 각 수정 직후 해당 구간 재-Read로 확인
- Tier 2: `pnpm --filter @grapit/web typecheck` 및 `pnpm --filter @grapit/web lint` 전부 0 errors
- Regression: `pnpm --filter @grapit/web exec vitest run` — 136/136 tests pass (20 files)

## Fixed Issues

### WR-01: useEffect self-triggering dependency (pendingRemovals)

**Files modified:** `apps/web/components/booking/seat-map-viewer.tsx`
**Commit:** `2c99c46`
**적용 내용:**
- `selectedSeatIds` diff effect의 deps에서 `pendingRemovals` 제거.
- 재선택 분기의 `pendingRemovals.has(id)` 외부 읽기 → `setPendingRemovals` 함수형 업데이터 내부의 `prevSet.has(id)`로 이동 (값 없으면 `prevSet` 그대로 반환하여 불필요한 렌더 트리거 방지).
- 결과: effect가 `selectedSeatIds` 변경 시에만 실행되어 self-triggering 재실행 + `prevSelectedRef.current = new Set(curr)` 재할당 비용 제거.
- 주석에 리뷰 근거 명시 (`review WR-01`).

### WR-02: `maxSelect` prop 선언만 되고 완전히 미사용

**Files modified:** `apps/web/components/booking/seat-map-viewer.tsx`
**Commit:** `c7036e5`
**적용 내용:**
- 리뷰의 옵션 B(내부 가드) 선택. 이유:
  1. 상위(`booking-page.tsx`)가 이미 `MAX_SEATS`를 검증 중이므로 옵션 A(prop 제거)도 타당하지만, viewer 테스트 25곳(`maxSelect={4}`)이 변경되어 diff가 커진다.
  2. double-defense로 broadcast race 등 상위 상태 업데이트 지연 케이스를 방어할 수 있다.
- 함수 시그니처 구조분해에 `maxSelect` 추가.
- `handleClick` 내부에서 `!selectedSeatIds.has(seatId) && selectedSeatIds.size >= maxSelect` 시 early return. 이미 선택된 좌석의 해제는 항상 허용.
- `useCallback` deps에 `maxSelect` 추가.
- **IN-01에 대한 부수 효과:** 이번 수정으로 `selectedSeatIds.size`와 `selectedSeatIds.has()`가 실제 사용되므로 IN-01이 지적한 "미사용 `selectedSeatIds` 의존성" 문제는 해소됨 (deps 유지가 정당화됨). 주석에 명시.

### WR-03: viewer의 DOMParser 결과에 parsererror 가드 누락

**Files modified:** `apps/web/components/booking/seat-map-viewer.tsx`
**Commit:** `d686dcf`
**적용 내용:**
- `processedSvg` useMemo에서 `DOMParser.parseFromString` 직후 parsererror 가드 추가.
- `doc.documentElement.tagName === 'parsererror' || doc.querySelector('parsererror')` 시 `return null`.
- 기존 렌더 분기 `if (!processedSvg)`가 "좌석 배치도가 준비되지 않았습니다" fallback을 출력하므로 별도 UI 변경 없음.
- admin(`svg-preview.tsx`) 및 `prefix-svg-defs-ids.ts`와 동일한 파싱 계약으로 통일.

## Skipped Issues

없음 (범위 내 3건 전부 수정 완료).

## 범위 외 (Info — 별도 패스 시 검토)

- **IN-01** useCallback deps의 `selectedSeatIds` 사용 여부: WR-02 적용 결과 실제 사용 상태가 되어 자연 해소.
- **IN-02** `handleMouseOut`의 `tierColorMap` 미사용 의존성
- **IN-03** `svg-preview.tsx` 좌석 수 카운팅을 `DOMParser` 기반으로 변경
- **IN-04** `prefix-svg-defs-ids.ts`의 serialize 후 regex 치환 제한 (문서 주석 보강 또는 DOM 기반 전환)
- **IN-05** `svg-preview.tsx`의 `handleSvgUpload` useCallback deps 최적화
- **IN-06** `hot-section.tsx`/`new-section.tsx`의 "더보기" 링크가 musical 장르에 하드코딩 — 제품 의도 확정 필요

---

_Fixed: 2026-04-22T10:22:30Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
