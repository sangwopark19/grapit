---
phase: 12
plan: 03
subsystem: ui/booking/seat-map-viewer
tags: [ux, seat-map, viewer, mini-map, mobile, selection-animation, stage-overlay, broadcast-priority, race-guard]
dependency_graph:
  requires:
    - "12-00 (Wave 0 target tests — seat-map-viewer.test.tsx 10 신규 + prefix-svg-defs-ids.test.ts 5)"
    - "12-01 (globals.css — [data-seat-checkmark] + [data-fading-out=\"true\"] @keyframes)"
    - "12-02 (apps/web/hooks/use-is-mobile.ts — useIsMobile + getServerSnapshot named export)"
  provides:
    - "UX-02 viewer STAGE 오버레이 (in-memory, D-07/D-19 호환, unified parsing contract)"
    - "UX-04 선택 좌석 fill transition + 체크마크 fade-in/out (B-2-RESIDUAL-V2 Option C)"
    - "UX-05 데스크톱 MiniMap (W-2 <defs> ID 충돌 방지)"
    - "UX-06 모바일 자동 1.4x 초기 줌 (D-17/D-18)"
    - "W-2 prefixSvgDefsIds 헬퍼 (named export, 단위 테스트 가능)"
  affects:
    - "Plan 12-03.5 (MiniMap smoke test gate) 실행 준비"
    - "Plan 12-04 (manual QA gate)"
tech-stack:
  added: []
  patterns:
    - "react-zoom-pan-pinch MiniMap 내장 컴포넌트 + children에 별도 SVG render"
    - "DOMParser + XMLSerializer 기반 SVG 변환 (정규식 회피)"
    - "useRef<Map<string, timeoutId>> per-seat race guard"
    - "dangerouslySetInnerHTML 마운트 후 useEffect가 attribute 변경 → CSS transition 정상 발화"
key-files:
  created:
    - "apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts (~60줄)"
  modified:
    - "apps/web/components/booking/seat-map-viewer.tsx (+200줄 순증)"
decisions:
  - "useMemo는 기본 tier 색상만 담당, primary fill 변경은 별도 useEffect — B-2-RESIDUAL-V2 Option C"
  - "D-13 BROADCAST PRIORITY: useMemo 안 locked/sold 분기를 선택보다 먼저 평가, useEffect도 seatStates.get()으로 skip"
  - "W-2 helper를 seat-map-viewer.tsx 안 private 함수가 아닌 별도 파일 + named export로 분리 — 단위 테스트 가능, JSDoc에 coverage 제한 명시"
  - "per-seat timeout Map 설계: rapid 해제→재선택 시 각 seatId 독립적으로 clearTimeout + pendingRemovals 동기 갱신"
metrics:
  duration_seconds: 569
  tasks_completed: 3
  files_created: 1
  files_modified: 1
  completed_at: "2026-04-21T06:29Z"
---

# Phase 12 Plan 03: Viewer 핵심 변경 Summary

Viewer seat-map에 MiniMap + 모바일 자동 1.4x 초기 줌 + STAGE 오버레이 + 선택 좌석 fill 150ms transition + 체크마크 fade-in/out을 per-seat timeout Map으로 race-safe하게 추가하고, D-13 broadcast 우선 정책을 locked/sold priority 체크로 준수했다.

## 실행 결과

- **3개 task 모두 atomic commit 완료 (serial, 같은 파일)**
- **16 seat-map-viewer 케이스** (기존 6 회귀 + 신규 10) GREEN 전환
- **5 prefix-svg-defs-ids helper 케이스** GREEN 전환
- **전체 vitest 136 passed** (20 test files)
- **typecheck GREEN**
- **lint 0 errors** (24 pre-existing warnings 유지)

## 커밋 내역

| Task | Commit   | 제목                                                                   |
| ---- | -------- | ---------------------------------------------------------------------- |
| 1    | 74934a9  | feat(12-03): add W-2 helper + viewer imports/MiniMap/mobile initialScale |
| 2    | 015d6b1  | feat(12-03): add STAGE overlay + checkmark attr + per-seat timeout race guard |
| 3    | 3c2e5fd  | feat(12-03): add fill transition useEffect with D-13 broadcast priority |

## Task 1 변경 (UX-05/06 + W-2 helper 분리)

**신규 파일 `apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts`:**
- `prefixSvgDefsIds(svgString, prefix)` named export
- DOMParser + XMLSerializer 기반 ID mapping
- `url(#oldId)` 정규식 치환 — escape safe (`[.*+?^${}()|[\]\\]` 이스케이프)
- `<defs>` 없으면 original 반환, parsererror graceful fallback
- **JSDoc에 reviews revision LOW #6 coverage 제한 명시:**
  - 현재 커버: `url(#id)` gradient/pattern 참조, CSS url("#id")
  - 미커버: `<use href="#id">`, `<use xlink:href="#id">`, `<textPath>`, `<mpath>`
  - MVP 수용 근거 + 미래 확장 경로 명시

**seat-map-viewer.tsx 변경:**
- `import { ..., MiniMap } from 'react-zoom-pan-pinch'`
- `import { useIsMobile } from '@/hooks/use-is-mobile'`
- `import { prefixSvgDefsIds } from './__utils__/prefix-svg-defs-ids'`
- `const isMobile = useIsMobile()` 호출
- `<TransformWrapper key={isMobile ? 'mobile' : 'desktop'} initialScale={isMobile ? 1.4 : 1} ...>`
- 데스크톱 전용 `<MiniMap width={120} borderColor="#6C3CE0" className="..." aria-label="좌석 미니맵">` 마운트
- MiniMap children은 `prefixSvgDefsIds(processedSvg, 'mini-')` 호출로 <defs> ID 접두사 처리

## Task 2 변경 (UX-02 STAGE + UX-04 체크마크 attr + race-safe timeout Map)

**state/ref 신설:**
- `prevSelectedRef = useRef<Set<string>>(new Set())`
- `timeoutsRef = useRef<Map<string, number>>(new Map())`
- `[pendingRemovals, setPendingRemovals] = useState<Set<string>>(new Set())`

**Race-safe per-seat timeout Map useEffect:**
- `selectedSeatIds` 변경 감지
- **재선택 감지**: `curr - prev`에서 pending인 seat → 기존 `clearTimeout` + `Map.delete` + `setPendingRemovals(next)` 동기 호출
- **해제 감지**: `prev - curr`에서 timeout 등록 → 150ms 후 pendingRemovals.delete + Map.delete
- **prevSelectedRef.current = new Set(curr)**를 useEffect 본문 끝에서 동기 갱신 (기존 setTimeout callback 안 갱신 제거)
- unmount cleanup useEffect로 남은 timeout 전부 clear

**useMemo 분기 재구성 (D-13 BROADCAST PRIORITY 적용):**
```
if (state === 'locked' || state === 'sold') {
  // LOCKED_COLOR + transition:none — broadcast 즉시 회색
} else if (showCheckmark && tierInfo) {
  // tier 기본 색상 + SELECTED_STROKE + 체크마크 <text>
  // 체크마크에 data-seat-checkmark 부여
  // isRemoving && !isSelected이면 data-fading-out="true" 부여
} else if (tierInfo) {
  // available tier 기본 색상
}
```

**UX-02 STAGE 오버레이 (unified parsing + W-1):**
- `doc.querySelector('[data-stage]')` — root + descendant 모두 탐색
- `VALID_STAGES = ['top', 'right', 'bottom', 'left'] as const` — enum narrowing + default `top` fallback
- viewBox `split(/[\s,]+/)` + `[minX, minY, width, height]` 모두 사용 (LOW #8)
- 기존 `<text>STAGE</text>` 있으면 viewer no-op (idempotent)
- **W-1 in-memory only**: processedSvg useMemo 안 doc에만 적용, R2 원본 SVG 불변
- `<g aria-label="무대 위치: {dataStage}">` 배지 그룹 생성, 4방향 좌표 계산 시 vbMinX/vbMinY 반영

**data-tier-id 속성:**
- 모든 분기 (selected, available)에 seat element의 tierName 부여

**useMemo deps 업데이트:**
- `[rawSvg, seatStates, selectedSeatIds, tierColorMap, pendingRemovals]`

## Task 3 변경 (UX-04 transition + Option C + D-13 BROADCAST PRIORITY)

**신규 useEffect:**
- deps: `[selectedSeatIds, pendingRemovals, tierColorMap, seatStates, processedSvg]`
- `containerRef.current.querySelector('svg')` — 마운트된 SVG root 접근
- **selectedSeatIds forEach**: 각 seatId에 대해
  1. `seatStates.get(seatId)` 체크 — `'locked'` 또는 `'sold'`이면 **early return** (D-13 BROADCAST PRIORITY MED #4)
  2. `el.style.transition = 'fill 150ms ease-out, stroke 150ms ease-out'`
  3. `el.setAttribute('fill', '#6C3CE0')` — Brand Purple (D-03)
- **pendingRemovals forEach**: tierColorMap의 원래 색상으로 fill 복원 + transition 유지
- useMemo가 기본 tier 색상을 outerHTML로 반환 → React 자식 DOM remount → 새 rect는 tier 색 mount → useEffect가 primary 덮어쓰기 → CSS transition 정상 발화

## reviews revision 적용 증거

### HIGH #1 per-seat timeout Map 재설계
- `timeoutsRef = useRef<Map<string, number>>` ✅
- `clearTimeout(existing)` + `timeoutsRef.current.delete(id)` 재선택 시 호출 ✅
- `prevSelectedRef.current = new Set(curr)` diff 계산 직후 (useEffect 본문 끝) 동기 갱신 ✅
- 신규 테스트 케이스 8 (rapid 80ms 해제 → 재선택 → 200ms 추가) `data-fading-out` stuck 없음 GREEN

### HIGH #2 unified parsing contract + viewBox min-x/min-y
- `doc.querySelector('[data-stage]')` root+descendant 탐색 ✅
- `VALID_STAGES = ['top', 'right', 'bottom', 'left'] as const` enum narrowing ✅
- viewBox `split(/[\s,]+/).map(Number)` + `vbMinX/vbMinY/vbW/vbH` 모두 사용 ✅
- 신규 테스트 케이스 9 (`<g data-stage="right">` descendant x좌표 > 200) GREEN

### MED #4 D-13 BROADCAST PRIORITY
- useMemo에서 locked/sold 분기를 선택 분기보다 먼저 평가 → LOCKED_COLOR + `transition:none` 박아둠 ✅
- useEffect 안 `seatStates.get(seatId) === 'locked' || 'sold'` 시 early return (primary 색 skip, transition 부여 skip) ✅
- useEffect deps에 `seatStates` 포함 (broadcast 감지) ✅
- 신규 테스트 케이스 10 (selected → broadcast locked) fill=`#d1d5db` + `transition:none` GREEN

### LOW #6 helper JSDoc coverage 제한
- `url(#id)` 커버 명시 ✅
- `<use href="#id">`, `xlink:href`, `<textPath>`, `<mpath>` 미커버 명시 ✅
- MVP 수용 근거 + 미래 확장 경로 명시 (`(url\(#id\)|href="#id"|xlink:href="#id")`) ✅

### LOW #8 viewBox parsing
- `split(/[\s,]+/)` — whitespace OR comma separator ✅
- `[minX, minY, width, height]` 4개 값 모두 사용하여 음수 min 좌표 SVG 정확 배치 ✅

## W-1 / W-2 적용 증거

### W-1 (STAGE 오버레이 in-memory only)
- STAGE 오버레이 로직은 `processedSvg` useMemo 안 `doc` 변수(in-memory DOM)에만 적용
- `svgEl.appendChild(overlayG)` — `doc.documentElement.outerHTML` string 반환 후 사용
- R2 원본 SVG 파일은 `rawSvg` state에 그대로 보존되어 fetch 응답 그대로
- D-19 (dangerouslySetInnerHTML tech debt) 호환

### W-2 (helper 별도 파일)
- `apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts` 신규 파일
- named export `prefixSvgDefsIds`로 단위 테스트 가능 (`__tests__/prefix-svg-defs-ids.test.ts` 5 케이스 GREEN)
- seat-map-viewer.tsx는 `import { prefixSvgDefsIds } from './__utils__/prefix-svg-defs-ids'`

## 테스트 결과 (vitest 136 passed / 136)

```
 Test Files  20 passed (20)
      Tests  136 passed (136)
   Duration  2.71s

 ✓ components/booking/__tests__/seat-map-viewer.test.tsx (17 tests) 217ms
 ✓ components/booking/__utils__/__tests__/prefix-svg-defs-ids.test.ts (5 tests)
 ✓ components/admin/__tests__/svg-preview.test.tsx (7 tests) 388ms
 ✓ hooks/__tests__/use-is-mobile.test.ts
 ✓ ... 그 외 16 test files 모두 GREEN
```

**seat-map-viewer.test.tsx (17 tests)**: Plan 12-00이 작성한 기존 6 회귀 + 신규 10 케이스 + 기존 7번째 error fetch 케이스 모두 GREEN:
- 케이스 1 (fill primary transition B-2-RESIDUAL-V2 Option C) ✅
- 케이스 2 (locked transition:none D-13 회귀) ✅
- 케이스 3 (data-seat-checkmark attr) ✅
- 케이스 4 (MiniMap 마운트 분기 UX-05) ✅
- 케이스 5 (initialScale 1.4 UX-06) ✅
- 케이스 6 (root data-stage STAGE 오버레이 UX-02) ✅
- 케이스 7 (data-fading-out + 160ms 제거 B-2-RESIDUAL) ✅
- 케이스 8 (rapid reselect race guard HIGH #1) ✅
- 케이스 9 (descendant data-stage HIGH #2) ✅
- 케이스 10 (selected+locked broadcast MED #4) ✅
- 기존 6 케이스 (tier color, locked gray, click available, click locked, click sold, selected stroke, error fetch) ✅

## Static checks

- `pnpm --filter @grapit/web typecheck` → exit 0 (strict TS, no any)
- `pnpm --filter @grapit/web lint` → 0 errors, 24 warnings (모두 pre-existing)

## Deviations from Plan

None — plan 12-03의 action 지침과 acceptance criteria를 정확히 구현했다.

단 편의 조정 1건:
- Task 2 변경 C-2에서 `if (isRemoving && !isSelected) { checkEl.setAttribute('data-fading-out', 'true') }` 형태로 guard를 추가 — isSelected=true일 때 fading-out attr은 의미가 없어 CSS 애니메이션 간섭을 방지. 계획서의 "해제 중에만 data-fading-out 부여" 요건과 동일.

## Self-Check: PASSED

### Created files exist
- apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts → FOUND
- .planning/phases/12-ux/12-03-SUMMARY.md → FOUND (이 파일)

### Commits exist
- 74934a9 feat(12-03): add W-2 helper + viewer imports/MiniMap/mobile initialScale → FOUND
- 015d6b1 feat(12-03): add STAGE overlay + checkmark attr + per-seat timeout race guard → FOUND
- 3c2e5fd feat(12-03): add fill transition useEffect with D-13 broadcast priority → FOUND

### Wave 4 진입 전 Plan 12-03.5 gate 준비
- seat-map-viewer.tsx에 MiniMap 마운트 + data-testid 없이도 `<div aria-label="좌석 미니맵">` 있음
- 데스크톱에서 dev server 실행하여 MiniMap smoke test 가능
- dev 서버 포트: web 3000, api 8080 (CLAUDE.md convention)

## Known Stubs

없음 — 모든 기능이 실제로 동작 (stub 아님).

## Threat Flags

없음 — Wave 3는 viewer 시각/상호작용 변경만. 새로운 trust boundary 도입 없음. admin SVG 입력 검증(T-12-01)은 Plan 12-02에서 mitigate 완료. SVG `<defs>` ID 충돌은 prefixSvgDefsIds 헬퍼로 MVP 범위에서 mitigate.
