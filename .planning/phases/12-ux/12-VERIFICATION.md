---
phase: 12-ux
verified: 2026-04-21T16:08:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "브라우저에서 /admin/dashboard 진입 후 카드 컴포넌트의 shadow/radius 시각 톤앤매너 확인"
    expected: "shadow-sm(0 1px 2px) + radius-lg(10px) 토큰이 shadcn Card에 전파되어 기존 대비 부드러운 elevation과 일관된 radius 톤 표시"
    why_human: "CSS 토큰 전파 결과는 시각적 톤앤매너 변화로, 자동 측정(screenshot diff)은 brittleness 높아 코드 sentinel만으로는 UX-01 '시각적으로 개선' 기준 충족 여부 확정 불가"
  - test: "실 모바일 디바이스(iOS Safari 또는 Android Chrome)에서 /booking/{performanceId} 좌석 선택 시 터치 정확도 확인"
    expected: "32px 좌석이 initialScale=1.4x로 44.8px 이상으로 확대되어 인접 좌석 오탭 0회"
    why_human: "WCAG 2.5.5 터치 타겟 44px 기준은 실 디바이스 터치 동작으로만 최종 확인 가능. jsdom은 터치 물리 측정 불가"
  - test: "dev server 첫 진입 시 브라우저 콘솔에서 Hydration warning 0건 확인"
    expected: "'Hydration failed' 또는 'Text content does not match' 콘솔 오류 없음"
    why_human: "SSR/CSR hydration mismatch는 실제 브라우저 런타임에서만 100% 확인 가능. useSyncExternalStore 구조적 보장이 있으나 브라우저 런타임 최종 확인이 이상적"
---

# Phase 12: UX 현대화 Verification Report

**Phase Goal:** 전체 디자인을 모던 트렌드에 맞게 개선하고 SVG 좌석맵 사용성을 높여 사용자 경험을 끌어올린다. shadcn UI 시스템 modernize + 좌석 선택 시각 피드백(Option C useEffect fill transition + 체크마크 fade) + 미니맵 viewport rect 동기화(react-zoom-pan-pinch 내장 MiniMap) + 모바일 WCAG 2.5.5 터치 타겟 보장. reviews revision 9 action items all closed.
**Verified:** 2026-04-21T16:08:00Z
**Status:** human_needed
**Re-verification:** No — 초기 검증

## Goal Achievement

### Observable Truths

| # | Truth (Roadmap SC) | Status | Evidence |
|---|--------------------|--------|----------|
| 1 | 전체 UI가 모던 디자인 트렌드를 반영하여 시각적으로 개선 | ✓ VERIFIED (code) / ? HUMAN (visual) | `globals.css` L74~81: `--shadow-sm`, `--shadow-md`, `--radius-sm/md/lg/xl` 6개 토큰 @theme 추가 확인. hot-section.tsx L19 / new-section.tsx L15 / genre-grid.tsx L44 `mt-10` 확인. 시각 톤앤매너 판단은 human 항목 #1로 이관 |
| 2 | SVG 좌석맵에서 스테이지 방향이 명확히 표시되고 등급별 색상 범례 + 가격이 보임 | ✓ VERIFIED | seat-map-viewer.tsx L229~300: VALID_STAGES + `doc.querySelector('[data-stage]')` unified contract + STAGE `<g>` 오버레이 생성 로직 확인. svg-preview.tsx L43~86: 동일 unified contract. seat-legend.tsx L7~29: dot+등급명+가격 렌더 확인. booking-page.tsx L440: `<SeatLegend tiers={legendTiers} />` 마운트, legendTiers는 seatConfig + priceTiers에서 실데이터 흐름 확인 |
| 3 | 좌석 선택/해제 시 자연스러운 애니메이션 전환 | ✓ VERIFIED | globals.css L113~122: `@keyframes seat-checkmark-fade-in/out` 정의. L147~162: `[data-seat-checkmark]` + `[data-fading-out="true"]` selector + `@media (prefers-reduced-motion)` 0.01ms override. seat-map-viewer.tsx L320~353: useEffect fill 150ms transition + Brand Purple 적용. vitest 136/136 GREEN (케이스 1/2/3/7/8) |
| 4 | 줌 상태에서 미니맵으로 현재 위치 파악 가능 | ✓ VERIFIED | seat-map-viewer.tsx L4: `import { ..., MiniMap } from 'react-zoom-pan-pinch'`. L495~504: `<MiniMap width={120} borderColor="#6C3CE0">` 마운트 + `prefixSvgDefsIds(processedSvg, 'mini-')` children. `!isMobile` 조건부 마운트로 데스크톱만 표시. Plan 12-03.5: 사용자 smoke test 3/3 PASS (2026-04-21) |
| 5 | 모바일에서 좌석 터치 타겟이 최소 44px로 보장되어 오탭 방지 | ✓ VERIFIED (code) / ? HUMAN (device) | seat-map-viewer.tsx L485~486: `key={isMobile ? 'mobile' : 'desktop'}` + `initialScale={isMobile ? 1.4 : 1}`. 수학적 보장: 32px × 1.4 = 44.8px ≥ 44px (WCAG 2.5.5). vitest케이스 5 GREEN. 실 디바이스 터치 확인은 human 항목 #2 |

**Score:** 5/5 truths verified (코드 레벨). 3개 human verification 항목 잔존.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/app/globals.css` | shadow/radius 토큰 + keyframes | ✓ VERIFIED | L74~81: 6개 토큰. L113~122: fade-in/out keyframe. L147~162: selector + reduced-motion override. 기존 브랜드 토큰 회귀 0 확인 |
| `apps/web/hooks/use-is-mobile.ts` | useSyncExternalStore SSR-safe hook + getServerSnapshot export | ✓ VERIFIED | 45줄, `'use client'`, `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`. getServerSnapshot named export 확인 (B-4) |
| `apps/web/components/admin/svg-preview.tsx` | DOMParser unified parsing + enum 검증 + try/catch | ✓ VERIFIED | L43~86: VALID_STAGES, `doc.querySelector('[data-stage]')`, parseerror 이중 가드, enum 검증, presignedUpload 이전에 실행. 서버측 재검증은 D-19 security debt로 공식 tracked |
| `apps/web/components/booking/seat-map-viewer.tsx` | MiniMap + STAGE overlay + fill transition + mobile initialScale | ✓ VERIFIED | L4: MiniMap import. L32: useIsMobile 호출. L229~300: STAGE overlay. L320~353: fill transition useEffect. L484~505: TransformWrapper + MiniMap 마운트 분기 |
| `apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts` | W-2 defs ID prefix helper | ✓ VERIFIED | 60줄, named export `prefixSvgDefsIds`. DOMParser + XMLSerializer 기반. graceful fallback. coverage 제한 JSDoc 명시 |
| `apps/web/components/home/hot-section.tsx` | mt-10 수직 리듬 | ✓ VERIFIED | L19: `<section className="mt-10">` |
| `apps/web/components/home/new-section.tsx` | mt-10 수직 리듬 | ✓ VERIFIED | L15: `<section className="mt-10">` |
| `apps/web/components/home/genre-grid.tsx` | mt-10 수직 리듬 | ✓ VERIFIED | L44: `<section className="mt-10 pb-12">` (pb-12 유지) |
| `apps/web/components/booking/seat-legend.tsx` | dot + 등급명 + 가격 렌더 | ✓ VERIFIED | L7~29: 완전한 구현. booking-page.tsx에서 실데이터로 마운트 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `seat-map-viewer.tsx` | `use-is-mobile.ts` | `import { useIsMobile }` + `const isMobile = useIsMobile()` | ✓ WIRED | L10 import, L32 사용, L485~486 initialScale + L494 MiniMap 분기에 실제 소비 |
| `seat-map-viewer.tsx` | `prefix-svg-defs-ids.ts` | `import { prefixSvgDefsIds }` + MiniMap children | ✓ WIRED | L11 import, L501 `prefixSvgDefsIds(processedSvg, 'mini-')` 실제 호출 |
| `seat-map-viewer.tsx` | `globals.css` keyframes | `data-seat-checkmark` / `data-fading-out` attr via DOM | ✓ WIRED | L201: `checkEl.setAttribute('data-seat-checkmark', '')`. L204: `setAttribute('data-fading-out', 'true')`. CSS selector 자동 트리거 |
| `seat-map-viewer.tsx` → fill transition | `seatStates` (broadcast) | `seatStates.get(seatId)` === locked/sold → skip | ✓ WIRED | L329~333: D-13 broadcast priority 검증 후 skip. useMemo L159: locked/sold 먼저 LOCKED_COLOR |
| `svg-preview.tsx` | unified parsing contract | `doc.querySelector('[data-stage]')` | ✓ WIRED | L67: root + descendant 탐색. admin–viewer 동일 contract 확인 |
| `booking-page.tsx` | `seat-legend.tsx` | `<SeatLegend tiers={legendTiers} />` | ✓ WIRED | L440: 마운트. legendTiers L121~135: seatConfig + priceTiers 실데이터 useMemo |
| `MiniMap` | `react-zoom-pan-pinch` | library native export | ✓ WIRED | L4: 라이브러리 직접 import. Plan 12-03.5 smoke test에서 viewport rect 동기화 런타임 확인 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `seat-legend.tsx` | `tiers` prop | booking-page.tsx `legendTiers` useMemo → seatConfig.tiers + performance.priceTiers (API) | Yes — seatConfig는 API response, priceTiers는 API response | ✓ FLOWING |
| `seat-map-viewer.tsx` | `rawSvg` | `fetch(svgUrl)` → R2 CDN → SVG string | Yes — R2 URL fetch, 에러 시 상태 표시 | ✓ FLOWING |
| `seat-map-viewer.tsx` | `seatStates` prop | booking-page.tsx → WebSocket / SSE broadcast 또는 API (Phase 3 구현) | Yes — upstream Phase 3 good standing | ✓ FLOWING |
| `use-is-mobile.ts` | `useIsMobile()` | `window.matchMedia('(max-width: 767px)')` | Yes — 브라우저 native API. SSR fallback false | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| vitest 136개 전체 GREEN | `pnpm --filter @grapit/web test --run` | 136/136 passed | ✓ PASS |
| typecheck 0 errors | `pnpm --filter @grapit/web typecheck` | exit 0 | ✓ PASS |
| lint 0 errors | `pnpm --filter @grapit/web lint` | 0 errors, 24 pre-existing warnings | ✓ PASS |
| MiniMap import in viewer | `grep "MiniMap" seat-map-viewer.tsx` | L4 import + L495 사용 | ✓ PASS |
| fill transition useEffect exists | `grep "fill 150ms"` seat-map-viewer.tsx | L339 hit | ✓ PASS |
| D-13 broadcast skip | `grep "if (state === 'locked'"` seat-map-viewer.tsx | L330 hit | ✓ PASS |
| shadow/radius tokens | globals.css sentinel | `--shadow-sm`, `--shadow-md`, `--radius-sm/md/lg/xl` 모두 hit | ✓ PASS |
| MiniMap smoke test | Plan 12-03.5 user approval | 3/3 checks PASS (2026-04-21) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| UX-01 | 12-01 | 전체 디자인 현대화 (@theme 토큰, 홈 파일럿) | ✓ SATISFIED (code) / ? human (visual) | shadow/radius 토큰 6개 + 홈 mt-10 3섹션. 시각 확인은 human_verification #1 |
| UX-02 | 12-02 Task 2 + 12-03 Task 2 | SVG 좌석맵 스테이지 방향 표시 | ✓ SATISFIED | unified `[data-stage]` contract admin+viewer. VALID_STAGES enum 검증. STAGE `<g>` 오버레이 4방향. vitest케이스 6/9 GREEN |
| UX-03 | (기존 구현 유지, D-10 검증만) | 등급별 색상 범례 + 가격 표시 | ✓ SATISFIED | seat-legend.tsx: dot+등급명+가격 렌더링. booking-page.tsx 실데이터 마운트 |
| UX-04 | 12-01 CSS + 12-03 Task 2/3 | 좌석 선택 상태 전환 애니메이션 | ✓ SATISFIED | keyframe 인프라 + useEffect fill transition + checkmark fade-in/out + D-13 broadcast priority. vitest 케이스 1/3/7/10/11 GREEN |
| UX-05 | 12-03 Task 1 + 12-03.5 smoke test | 미니맵 네비게이터 | ✓ SATISFIED | `<MiniMap width={120} borderColor="#6C3CE0">` + `prefixSvgDefsIds`. Plan 12-03.5 사용자 3/3 PASS |
| UX-06 | 12-02 Task 1 + 12-03 Task 1 | 모바일 터치 타겟 44px | ✓ SATISFIED (code) / ? human (device) | useIsMobile hook + TransformWrapper `initialScale={isMobile ? 1.4 : 1}`. 32×1.4=44.8px ≥ 44px. 실 디바이스 확인은 human_verification #2 |

모든 6개 UX 요구사항 코드 레벨 충족 확인.

### Reviews Revision Closure

| Action Item | Severity | Closed In | Evidence |
|-------------|----------|-----------|----------|
| #1 pendingRemovals race 재설계 (per-seat Map) | HIGH | 12-03 Task 2 | `timeoutsRef = useRef<Map<string, number>>` + clearTimeout on reselect. vitest rapid reselect 케이스 GREEN |
| #2 admin/viewer `[data-stage]` unified contract | HIGH | 12-02 + 12-03 | 양쪽 `doc.querySelector('[data-stage]')` 사용 확인. vitest descendant 케이스 GREEN |
| #3 data-stage enum 검증 | MED | 12-02 | VALID_STAGES tuple + `.includes()`. svgpreview Test 6 GREEN |
| #4 selected+locked broadcast 회귀 | MED | 12-03 Task 3 | useMemo locked 먼저 평가 + useEffect seatStates skip. vitest MED#4 케이스 GREEN |
| #5 MiniMap dev-server smoke test | MED | 12-03.5 | 사용자 3/3 PASS approval (2026-04-21) |
| #6 Wave 0 typecheck 전이 전략 | MED | 12-00 Task 4 | `@ts-ignore` + literal import 전략. typecheck exit 0 |
| #7 handleSvgUpload try/catch + toast | LOW | 12-02 Task 2 | DOMParser try/catch + parseerror 이중 가드. svg-preview Test 7 GREEN |
| #8 viewBox min-x/min-y 반영 | LOW | 12-03 | `split(/[\s,]+/)` + `[vbMinX, vbMinY, vbW, vbH]` 4값 모두 사용 |
| #9 D-19 admin SVG client-only tech debt 공식 기록 | LOW | 12-04 Task 3 | `.planning/PROJECT.md §Security Debt` 신설. "Phase 12 admin SVG client-side validation only" 항목 확인 |

**9/9 action items CLOSED.**

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `seat-map-viewer.tsx` | 140 | `return null` | ℹ Info | `processedSvg` useMemo에서 rawSvg null 시 null 반환 — 정상적인 조건부 렌더링, stub 아님 |
| `use-is-mobile.ts` | 8 | `return () => {}` | ℹ Info | SSR(window undefined) 시 빈 unsubscribe 반환 — 정상 SSR-safe 패턴 |

스터브 없음. TODO/FIXME/placeholder 없음.

### Human Verification Required

#### 1. Admin 대시보드 카드 시각 톤앤매너 확인

**Test:** `pnpm --filter @grapit/web dev` 실행 후 브라우저에서 `/admin/dashboard` 진입
**Expected:** shadcn Card 컴포넌트에 `--shadow-sm`(0 1px 2px) + `--radius-lg`(10px) 토큰이 전파되어 기존 대비 부드러운 elevation과 일관된 radius 톤 표시. JSX 변경 0줄로 순수 토큰 전파 결과 확인
**Why human:** CSS 토큰 전파 결과는 시각적 톤앤매너 변화로 자동 측정 어려움. screenshot diff는 brittleness 높음. "시각적으로 개선" 여부는 사람이 판단해야 함

#### 2. 모바일 실 디바이스 터치 타겟 검증

**Test:** iOS Safari 또는 Android Chrome에서 `/booking/{performanceId}` 진입 후 좌석 탭
**Expected:** 32px 좌석이 initialScale=1.4x로 44.8px 이상으로 확대되어 인접 좌석 오탭 0회. 손가락으로 여러 번 좌석 탭해도 원하는 좌석만 정확히 선택됨
**Why human:** WCAG 2.5.5 터치 타겟 44px는 실 디바이스 터치 동작으로만 최종 확인 가능. jsdom은 터치 물리적 측정 불가

#### 3. Hydration Warning 0건 런타임 확인

**Test:** `pnpm --filter @grapit/web dev` 실행 후 브라우저 콘솔 열고 `/` 또는 `/booking/{id}` 진입
**Expected:** "Hydration failed", "Text content does not match", "Warning: Prop did not match" 등 hydration 관련 콘솔 에러 0건
**Why human:** SSR/CSR hydration mismatch는 브라우저 런타임에서만 확인 가능. `useSyncExternalStore` + `getServerSnapshot` + `key={isMobile}` 3중 구조적 보장이 있으나 브라우저 런타임 최종 확인이 이상적. Plan 12-03.5 smoke test에서 개발자가 콘솔 에러 미발견한 것을 간접 증거로 활용 가능

### Gaps Summary

갭 없음. 5/5 roadmap success criteria 코드 레벨 충족, 9/9 reviews revision action items closed, vitest 136/136 GREEN, typecheck 0 errors, lint 0 errors.

잔존 human_verification 3건은 구조적 보장으로 실패 리스크 낮음:
- #1 시각 톤앤매너: CSS 토큰이 실재함. 범위 내에서 "시각적으로 개선" 기준을 사람이 최종 확인
- #2 실 디바이스 터치: 32px×1.4=44.8px 수학적 보장. 실측 확인으로 완결
- #3 Hydration: React 18+ official 패턴 + smoke test 간접 증거. 브라우저 콘솔 확인으로 완결

---

_Verified: 2026-04-21T16:08:00Z_
_Verifier: Claude (gsd-verifier)_
