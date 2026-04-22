---
phase: 12-ux
fixed_at: 2026-04-22T10:30:30Z
review_path: .planning/phases/12-ux/12-REVIEW.md
iteration: 2
findings_in_scope: 9
fixed: 4
already_fixed: 4
skipped: 1
status: partial
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-04-22T10:30:30Z
**Source review:** `.planning/phases/12-ux/12-REVIEW.md`
**Iteration:** 2 (누적 리포트 — iteration 1 결과 포함)

**Summary (누적):**
- 범위 내 finding: 9건 (Warning 3, Info 6)
- Fixed: 4건 (IN-02, IN-03, IN-04, IN-05 — iteration 2 신규)
- Already fixed: 4건 (WR-01, WR-02, WR-03은 iteration 1에서 수정됨. IN-01은 WR-02 수정에 흡수됨)
- Skipped: 1건 (IN-06 — 제품 의도 확정 필요)
- 상태: `partial` (IN-06 product decision 대기)

검증 방식 (iteration 2):
- Tier 1: 각 수정 직후 해당 구간 재-Read 및 `git diff`로 확인
- Tier 2: `pnpm --filter @grapit/web typecheck` — 0 errors
- Tier 2: `pnpm --filter @grapit/web lint` — 0 errors (기존 warning 22건은 변동 없음)
- Regression: `pnpm --filter @grapit/web exec vitest run` — 136/136 pass (20 files)

## Previously fixed (iteration 1)

이전 iteration에서 수정되어 이미 main branch에 반영된 finding들. iteration 2 시작 시 코드 상태가 REVIEW.md Fix 블록과 일치함을 재확인했다 — 재수정/중복 커밋 없음.

### WR-01: useEffect self-triggering dependency (pendingRemovals)

**Status:** `already_fixed`
**Files modified:** `apps/web/components/booking/seat-map-viewer.tsx`
**Commit:** `2c99c46` (iteration 1)
**확인 (iteration 2):** `seat-map-viewer.tsx:50-98` — `pendingRemovals`가 effect deps에서 제외되어 있고, 재선택 분기에서 `setPendingRemovals` 함수형 업데이터 내부의 `prevSet.has(id)` 분기가 적용되어 있음. REVIEW.md Fix 블록과 일치.

### WR-02: `maxSelect` prop이 선언만 되고 완전히 미사용

**Status:** `already_fixed`
**Files modified:** `apps/web/components/booking/seat-map-viewer.tsx`
**Commit:** `c7036e5` (iteration 1 — 옵션 B 선택)
**확인 (iteration 2):** `seat-map-viewer.tsx:31, 372-391` — 함수 시그니처 구조분해에 `maxSelect`가 추가되었고, `handleClick` 내부에서 `!selectedSeatIds.has(seatId) && selectedSeatIds.size >= maxSelect` 가드가 작동. deps에 `maxSelect` 포함.

### WR-03: viewer의 DOMParser 결과에 parsererror 가드 누락

**Status:** `already_fixed`
**Files modified:** `apps/web/components/booking/seat-map-viewer.tsx`
**Commit:** `d686dcf` (iteration 1)
**확인 (iteration 2):** `seat-map-viewer.tsx:147-155` — `processedSvg` useMemo에 `doc.documentElement.tagName === 'parsererror' || doc.querySelector('parsererror')` 가드가 존재하고, 실패 시 `return null`로 렌더 분기가 "좌석 배치도가 준비되지 않았습니다" fallback을 출력하는 구조. admin(`svg-preview.tsx:50-57`), `prefix-svg-defs-ids.ts:35`와 통일.

### IN-01: `handleClick` useCallback에 사용되지 않는 `selectedSeatIds` 의존성

**Status:** `already_fixed (absorbed into WR-02)`
**Files modified:** `apps/web/components/booking/seat-map-viewer.tsx`
**Commit:** `c7036e5` (iteration 1 — WR-02 수정에 포함됨)
**확인 (iteration 2):** WR-02 옵션 B 적용으로 `handleClick` 내부에서 `selectedSeatIds.size`(line 385)와 `selectedSeatIds.has(seatId)`(line 385)가 실제 사용됨. 따라서 deps에 `selectedSeatIds`를 유지하는 것이 오히려 올바른 상태. REVIEW.md IN-01도 이 케이스(옵션 B 선택 시 deps 유지)를 명시적으로 권장.

## Fixed Issues (iteration 2 신규)

### IN-02: `handleMouseOut` useCallback에 사용되지 않는 `tierColorMap` 의존성

**Status:** `fixed`
**Files modified:** `apps/web/components/booking/seat-map-viewer.tsx`
**Commit:** `57d51cb`
**적용 내용:**
- `handleMouseOut`의 deps 배열에서 `tierColorMap` 제거 (`[seatStates, selectedSeatIds, tierColorMap]` → `[seatStates, selectedSeatIds]`).
- 함수 본문 내에서 `tierColorMap`을 참조하지 않으므로 의미 변화 없음.
- 주석에 리뷰 근거(`review IN-02`) 명시 — `seatConfig` 변경 시 불필요한 함수 재생성 방지.

### IN-03: `svg-preview.tsx`의 좌석 수 카운팅이 문자열 정규식 기반

**Status:** `fixed`
**Files modified:** `apps/web/components/admin/svg-preview.tsx`
**Commit:** `925785d`
**적용 내용:**
- `handleSvgUpload` 내부의 `(text.match(/data-seat-id/g) || []).length` → `doc.querySelectorAll('[data-seat-id]').length`로 변경.
- 같은 `useCallback` scope에서 이미 파싱된 `doc` 변수를 재사용 (line 49에서 `parser.parseFromString`한 결과). 추가 parse 비용 없음.
- 주석에 리뷰 근거(`review IN-03`) 명시 — text/CDATA/주석 내 'data-seat-id' substring false positive 제거.
- 기존 테스트 7건(`svg-preview.test.tsx`) 모두 통과 확인.

### IN-04: `prefixSvgDefsIds` serialize 후 문자열 regex 치환 한계

**Status:** `fixed` (옵션 A — 문서 주석 보강)
**Files modified:** `apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts`
**Commit:** `6858578`
**적용 내용:**
- **옵션 A만 적용** — 기존 serialize + regex 치환 로직은 그대로 유지하고, 파일 상단 JSDoc에 "Serialize + regex 치환의 알려진 한계" 섹션 추가.
- 명시한 한계:
  - `<text>url(#grad1)</text>` 등 text node 리터럴도 치환됨
  - `<![CDATA[... url(#grad1) ...]]>` CDATA 내 리터럴도 치환됨
  - `<!-- url(#grad1) -->` 주석 내 리터럴도 치환됨
  - `<use href="#id">` / `<use xlink:href="#id">` href 기반 참조는 **미커버** (기존 한계와 같은 섹션에 통합)
- MVP 수용 근거 및 향후 DOM 기반 치환(`fill`/`stroke`/`style`/`use[href]` 직접 set) 리팩터 권장을 별도 phase로 명시.
- **옵션 B(DOM 기반 리팩터)는 적용하지 않음** — orchestrator 지시에 따라 별도 phase로 연기.

### IN-05: `handleSvgUpload` useCallback deps에 state setter 누락 (명시 권장)

**Status:** `fixed`
**Files modified:** `apps/web/components/admin/svg-preview.tsx`
**Commit:** `d6ff902`
**적용 내용:**
- `const presignedUploadMutate = presignedUpload.mutateAsync;`를 `useCallback` 외부 렌더 스코프에서 추출.
- `handleSvgUpload` 내부의 `presignedUpload.mutateAsync({...})` 호출을 `presignedUploadMutate({...})`로 치환.
- `useCallback` deps를 `[presignedUpload]` → `[presignedUploadMutate]`로 narrowing.
- React setter(`setSvgUrl`, `setTotalSeats`)는 stable identity 컨벤션에 따라 deps에 추가하지 않음 — 주석에 근거 명시.
- 효과: `presignedUpload` 객체의 `isPending` 변화로 identity가 바뀌어도 `handleSvgUpload`는 재생성되지 않음 (`mutateAsync`는 React Query가 stable하게 유지).

## Skipped Issues

### IN-06: `hot-section.tsx` / `new-section.tsx` "더보기" 링크 하드코딩

**Status:** `skipped (requires product decision)`
**Files:**
- `apps/web/components/home/hot-section.tsx:22-27`
- `apps/web/components/home/new-section.tsx:18-23`
**Original issue:** HOT 공연 / 신규 오픈 섹션의 "더보기" 링크가 `/genre/musical?sort=popular` / `/genre/musical?sort=latest`로 musical 장르에 **하드코딩**되어 있다. HOT과 신규 오픈 섹션은 전 장르를 아우르는 큐레이션이므로 musical로만 필터링되는 것은 의도와 어긋난다.
**Skip rationale:** 제품 의도 확정이 선행되어야 한다. 올바른 수정은 "전체 장르" 대상 목록 라우트(예: `/performances?sort=popular`, `/performances?sort=latest`)를 신설하는 것이지만, 해당 라우트/페이지는 현재 코드베이스에 존재하지 않는다. 다음 중 어느 방향인지 제품 결정이 필요:
- **A.** 전용 전체 목록 라우트(`/performances` 또는 `/search` 등) 신설 → 새 페이지/쿼리 계약/SEO 고려 필요 (별도 phase)
- **B.** 현재 musical 고정은 의도된 동작 → 코드 변경 없음, 주석으로 의도 명시
- **C.** HOT/신규 섹션에서 "더보기" 링크를 제거 → UX 결정

**권장 액션:** Backlog 이관. Phase 12 외 작업으로 트래킹하여 제품 결정이 내려진 시점에 별도 phase 생성.

---

## 범위 전체 처리 요약

| Finding | Severity | Status | Commit | Note |
|---------|----------|--------|--------|------|
| WR-01   | Warning  | already_fixed | `2c99c46` | iteration 1 |
| WR-02   | Warning  | already_fixed | `c7036e5` | iteration 1 — 옵션 B |
| WR-03   | Warning  | already_fixed | `d686dcf` | iteration 1 |
| IN-01   | Info     | already_fixed | `c7036e5` | WR-02 수정에 흡수 |
| IN-02   | Info     | fixed         | `57d51cb` | iteration 2 |
| IN-03   | Info     | fixed         | `925785d` | iteration 2 |
| IN-04   | Info     | fixed         | `6858578` | iteration 2 — 옵션 A (문서만) |
| IN-05   | Info     | fixed         | `d6ff902` | iteration 2 |
| IN-06   | Info     | skipped       | —         | 제품 결정 필요 — backlog |

---

_Fixed: 2026-04-22T10:30:30Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
