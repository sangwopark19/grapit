---
phase: 12
plan: 03
plan_number: 3
type: execute
wave: 3
depends_on: ["12-00", "12-01", "12-02"]
files_modified:
  - apps/web/components/booking/seat-map-viewer.tsx
autonomous: true
requirements: [UX-02, UX-04, UX-05, UX-06]
must_haves:
  truths:
    - "선택 좌석 rect의 inline style에 `transition:fill 150ms ease-out,stroke 150ms ease-out`이 포함되어 사용자 본인의 좌석 선택 시 자연스러운 fill 전환"
    - "locked/sold/available 좌석은 `transition:none` 유지 (D-13 회귀 방지) — 실시간 broadcast 좌석 변화는 즉시 플립"
    - "선택 좌석에 삽입되는 체크마크 <text> 요소가 `data-seat-checkmark` 속성을 가지며, Plan 12-01에서 정의한 CSS @keyframes seat-checkmark-fade-in이 mount 시 150ms fade-in 자동 트리거"
    - "SVG에 `<text>STAGE</text>` 또는 `[data-stage]` 시각 요소가 이미 있으면 viewer no-op (idempotent), `data-stage` 속성만 있으면 viewBox 기준 변(top/right/bottom/left)에 STAGE 배지 <g> 오버레이 추가"
    - "데스크톱(useIsMobile=false) viewer에 react-zoom-pan-pinch 내장 MiniMap 컴포넌트가 마운트 (좌상단 absolute, width 120, borderColor #6C3CE0), 모바일에서는 미마운트 (D-15/D-16)"
    - "TransformWrapper에 `key={isMobile ? 'mobile' : 'desktop'}` + `initialScale={isMobile ? 1.4 : 1}` 적용 — 모바일 first paint 시 좌석 32px × 1.4 = 44.8px 보장 (WCAG 2.5.5)"
    - "Plan 12-00의 seat-map-viewer.test.tsx 신규 5 케이스(transition / data-seat-checkmark / MiniMap / initialScale / STAGE 오버레이) 모두 GREEN, 기존 6 회귀 케이스 GREEN 유지"
  artifacts:
    - path: "apps/web/components/booking/seat-map-viewer.tsx"
      provides: "UX-02 viewer STAGE 배지 + UX-04 선택 좌석 transition + 체크마크 fade-in attr + UX-05 MiniMap + UX-06 모바일 initialScale 분기"
      contains: "MiniMap, useIsMobile, data-seat-checkmark, transition:fill 150ms, data-stage, initialScale: isMobile ? 1.4 : 1, key={isMobile"
  key_links:
    - from: "apps/web/components/booking/seat-map-viewer.tsx (체크마크 <text>)"
      to: "apps/web/app/globals.css [data-seat-checkmark] CSS @keyframes (Plan 12-01)"
      via: "checkEl.setAttribute('data-seat-checkmark', '') → mount 시 CSS animation 자동 트리거"
      pattern: "data-seat-checkmark"
    - from: "apps/web/components/booking/seat-map-viewer.tsx (TransformWrapper props)"
      to: "apps/web/hooks/use-is-mobile.ts (Plan 12-02)"
      via: "import { useIsMobile } + const isMobile = useIsMobile()"
      pattern: "import.*useIsMobile.*hooks/use-is-mobile"
    - from: "apps/web/components/booking/seat-map-viewer.tsx (MiniMap 마운트)"
      to: "react-zoom-pan-pinch 내장 MiniMap export"
      via: "import { TransformWrapper, TransformComponent, MiniMap } from 'react-zoom-pan-pinch'"
      pattern: "MiniMap.*from.*react-zoom-pan-pinch"
---

<objective>
Wave 3 — Viewer 핵심 5건 통합 변경.

`apps/web/components/booking/seat-map-viewer.tsx` 단일 파일에 UX-02(viewer STAGE 오버레이) + UX-04(선택 좌석 transition + 체크마크 fade-in attr) + UX-05(MiniMap 마운트) + UX-06(모바일 initialScale + key 분기) 변경을 모두 적용한다.

단일 파일 변경이므로 단일 task에 5건을 묶어서 동시 적용 (분리 시 file conflict로 직렬화 + 회귀 케이스 중복 실행). Plan 12-00에서 미리 작성된 회귀 케이스 6건 + 신규 5 케이스 11개 모두 GREEN으로 전환.

Purpose:
- D-07 (스테이지 방향 시각화), D-11/D-12 (선택 애니메이션), D-13 (broadcast 즉시 플립), D-14/D-15/D-16 (미니맵 위치/모바일 숨김), D-17/D-18 (모바일 자동 1.4x 줌) 한 번에 충족
- 사용자가 바로 체감하는 좌석맵 UX 개선 5건이 단일 commit/검증 단위로 atomic하게 적용

Output:
- `apps/web/components/booking/seat-map-viewer.tsx` 단일 파일에 5건 변경 (~50~70줄 추가/수정)
- Plan 12-00의 seat-map-viewer.test.tsx 신규 5 케이스 GREEN
- 기존 6 회귀 케이스 GREEN 유지
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/12-ux/12-CONTEXT.md
@.planning/phases/12-ux/12-RESEARCH.md
@.planning/phases/12-ux/12-PATTERNS.md
@.planning/phases/12-ux/12-UI-SPEC.md
@.planning/phases/12-ux/12-VALIDATION.md
@apps/web/components/booking/seat-map-viewer.tsx
@apps/web/components/booking/__tests__/seat-map-viewer.test.tsx
@apps/web/hooks/use-is-mobile.ts
@apps/web/app/globals.css
@apps/web/public/seed/sample-seat-map.svg

<interfaces>
<!-- 본 plan이 의존하는 contract — Plan 12-01/12-02에서 제공됨 -->

CSS contract (Plan 12-01 globals.css):
- `[data-seat-checkmark] { animation: seat-checkmark-fade-in 150ms ease-out forwards; }` 가 정의되어 있음
- `@media (prefers-reduced-motion: reduce) { [data-seat-checkmark] { animation: none; opacity: 1; } }` 가 정의되어 있음
- 본 plan은 체크마크 `<text>` 요소에 `data-seat-checkmark` 속성만 추가 — 별도 CSS 작성 불필요

Hook contract (Plan 12-02 use-is-mobile.ts):
- `import { useIsMobile } from '@/hooks/use-is-mobile';`
- `const isMobile = useIsMobile();` 호출 시 boolean 반환 (SSR=false, 클라이언트=matchMedia 결과)

Library contract (react-zoom-pan-pinch 3.7.0 — RESEARCH §Pattern 2):
- `import { TransformWrapper, TransformComponent, MiniMap } from 'react-zoom-pan-pinch';`
- `MiniMap` props: `{ children, width?, height?, borderColor?, ...HTMLDivElement props }`
- `TransformWrapper` `initialScale` prop은 mount 시 1회만 평가 — `key` prop으로 강제 재마운트 (RESEARCH §Pitfall 2)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: seat-map-viewer.tsx에 5건 변경 통합 적용</name>
  <files>apps/web/components/booking/seat-map-viewer.tsx</files>
  <read_first>
    - apps/web/components/booking/seat-map-viewer.tsx (전체 312줄 — 모든 변경 위치를 정확히 식별)
    - apps/web/components/booking/__tests__/seat-map-viewer.test.tsx (Plan 12-00에서 작성된 테스트 — 본 task 완료 후 GREEN 전환)
    - apps/web/hooks/use-is-mobile.ts (Plan 12-02 산출물 — import 대상)
    - apps/web/app/globals.css (Plan 12-01 산출물 — `[data-seat-checkmark]` selector + prefers-reduced-motion override 확인)
    - .planning/phases/12-ux/12-PATTERNS.md §"apps/web/components/booking/seat-map-viewer.tsx (component, event-driven)" (line 105~253)
    - .planning/phases/12-ux/12-RESEARCH.md §"Code Examples / seat-map-viewer.tsx" (line 594~789) — 특히 transition 정책(line 594~651), STAGE 오버레이(line 653~711), MiniMap+모바일 분기(line 713~789)
    - .planning/phases/12-ux/12-RESEARCH.md §"Pitfall 2: TransformWrapper initialScale prop change 무반응" (line 502~506)
    - .planning/phases/12-ux/12-RESEARCH.md §"Anti-pattern 1/2/5" (line 470~474)
    - .planning/phases/12-ux/12-CONTEXT.md D-07/D-11/D-12/D-13/D-14/D-15/D-16/D-17/D-18 (잠금 결정)
    - .planning/phases/12-ux/12-UI-SPEC.md §"Layout Contract / 좌석맵 뷰어" (line 190~217), §"Interaction & State Contract" (line 235~250)
  </read_first>
  <behavior>
    - 변경 1 (D-11): 선택 좌석 분기(라인 88)의 inline style이 `'cursor:pointer;opacity:1;transition:fill 150ms ease-out,stroke 150ms ease-out;'`로 교체. locked/sold (라인 125), available (라인 130) 분기는 `transition:none` 유지.
    - 변경 2 (D-12): 선택 좌석 체크마크 `<text>` (라인 109~119)에 `setAttribute('data-seat-checkmark', '')` 한 줄 추가. CSS @keyframes가 자동으로 mount 시 fade-in 트리거 (Plan 12-01 산출물).
    - 변경 3 (D-07): processedSvg useMemo의 viewBox 보장 직후(라인 140 직후, 라인 142 `removeAttribute('width')` 직전) STAGE 배지 오버레이 로직 추가 — `<text>STAGE</text>` 부재 + `data-stage` 속성 존재 시 viewBox 기준 해당 변에 `<g>` 오버레이 삽입.
    - 변경 4 (D-17/D-18): TransformWrapper(라인 278~285)에 `key={isMobile ? 'mobile' : 'desktop'}` + `initialScale={isMobile ? 1.4 : 1}` 적용. minScale=0.5 / maxScale=4 / centerOnInit / wheel / doubleClick은 그대로 유지.
    - 변경 5 (D-14/D-15/D-16): TransformWrapper 내부 `<SeatMapControls />` 다음에 데스크톱 전용 MiniMap 마운트. children은 동일 `processedSvg` dangerouslySetInnerHTML.
  </behavior>
  <action>
정확히 다음 6개 변경을 단일 파일에 적용한다 (모든 변경은 12-PATTERNS.md §"Pattern Assignments / seat-map-viewer.tsx" 및 12-RESEARCH.md §"Code Examples"에서 코드를 그대로 채택).

**변경 A — Imports (라인 4 + 신규 import 1줄 추가)**:

기존 라인 4:
```tsx
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
```

변경 후:
```tsx
import { TransformWrapper, TransformComponent, MiniMap } from 'react-zoom-pan-pinch';
```

기존 라인 9 직후에 신규 import 추가:
```tsx
import { SeatMapControls } from './seat-map-controls';
import { useIsMobile } from '@/hooks/use-is-mobile';
```

**변경 B — useIsMobile 호출 (컴포넌트 본문 진입부, 기존 라인 30 직전 또는 직후)**:

기존 라인 30 (containerRef 선언) 직전에 한 줄 추가:
```tsx
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
```

**변경 C — 선택 좌석 transition + 체크마크 data-seat-checkmark (라인 88 + 라인 117 직후)**:

기존 라인 88:
```tsx
        el.setAttribute('style', 'cursor:pointer;opacity:1;transition:none');
```

변경 후 (선택 좌석에만 transition 활성):
```tsx
        el.setAttribute(
          'style',
          'cursor:pointer;opacity:1;transition:fill 150ms ease-out,stroke 150ms ease-out;',
        );
```

기존 라인 117 (`checkEl.setAttribute('pointer-events', 'none');`) 직후에 한 줄 추가:
```tsx
            checkEl.setAttribute('pointer-events', 'none');
            checkEl.setAttribute('data-seat-checkmark', '');
            checkEl.textContent = '✓';
```

(textContent 라인은 기존 라인 118 그대로 유지)

**라인 121~131 (locked/sold + available 분기)는 변경 없음** — `transition:none` 유지 (D-13 회귀 방지).

**변경 D — STAGE 배지 오버레이 (라인 140 직후, 라인 142 직전)**:

기존 라인 134~146:
```tsx
    // Ensure viewBox exists (required — without it SVG disappears when width/height are removed)
    const svgEl = doc.documentElement;
    if (!svgEl.getAttribute('viewBox')) {
      const w = svgEl.getAttribute('width') || '800';
      const h = svgEl.getAttribute('height') || '600';
      svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }
    // Remove fixed dimensions and make responsive
    svgEl.removeAttribute('width');
    svgEl.removeAttribute('height');
    svgEl.setAttribute('style', 'width:100%;height:auto;display:block;');
```

변경 후 (`viewBox` 보장 직후, `removeAttribute('width')` 직전에 신규 블록 INSERT):
```tsx
    // Ensure viewBox exists (required — without it SVG disappears when width/height are removed)
    const svgEl = doc.documentElement;
    if (!svgEl.getAttribute('viewBox')) {
      const w = svgEl.getAttribute('width') || '800';
      const h = svgEl.getAttribute('height') || '600';
      svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }

    // Phase 12 (D-07): STAGE 배지 오버레이 — SVG에 시각 요소 부재 + data-stage 속성만 있을 때
    const hasStageText = Array.from(doc.querySelectorAll('text')).some(
      (t) => t.textContent?.trim() === 'STAGE',
    );
    const dataStage = svgEl.getAttribute('data-stage');
    if (!hasStageText && dataStage) {
      const viewBoxValues = (svgEl.getAttribute('viewBox') ?? '0 0 800 600')
        .split(/\s+/)
        .map(Number);
      const vbW = viewBoxValues[2] ?? 800;
      const vbH = viewBoxValues[3] ?? 600;
      const svgNs = 'http://www.w3.org/2000/svg';
      const overlayG = doc.createElementNS(svgNs, 'g');
      overlayG.setAttribute('aria-label', `무대 위치: ${dataStage}`);
      const badgeRect = doc.createElementNS(svgNs, 'rect');
      const badgeText = doc.createElementNS(svgNs, 'text');
      const badgeWidth = 120;
      const badgeHeight = 32;
      let bx = 0;
      let by = 0;
      switch (dataStage) {
        case 'top':
          bx = vbW / 2 - badgeWidth / 2;
          by = 12;
          break;
        case 'bottom':
          bx = vbW / 2 - badgeWidth / 2;
          by = vbH - badgeHeight - 12;
          break;
        case 'left':
          bx = 12;
          by = vbH / 2 - badgeHeight / 2;
          break;
        case 'right':
          bx = vbW - badgeWidth - 12;
          by = vbH / 2 - badgeHeight / 2;
          break;
        default:
          bx = vbW / 2 - badgeWidth / 2;
          by = 12;
      }
      badgeRect.setAttribute('x', String(bx));
      badgeRect.setAttribute('y', String(by));
      badgeRect.setAttribute('width', String(badgeWidth));
      badgeRect.setAttribute('height', String(badgeHeight));
      badgeRect.setAttribute('rx', '8');
      badgeRect.setAttribute('fill', '#E5E7EB');
      badgeRect.setAttribute('stroke', '#9CA3AF');
      badgeRect.setAttribute('stroke-width', '1.5');
      badgeText.setAttribute('x', String(bx + badgeWidth / 2));
      badgeText.setAttribute('y', String(by + badgeHeight / 2));
      badgeText.setAttribute('text-anchor', 'middle');
      badgeText.setAttribute('dominant-baseline', 'central');
      badgeText.setAttribute('font-size', '14');
      badgeText.setAttribute('font-weight', '600');
      badgeText.setAttribute('fill', '#6B7280');
      badgeText.textContent = 'STAGE';
      overlayG.appendChild(badgeRect);
      overlayG.appendChild(badgeText);
      svgEl.appendChild(overlayG);
    }

    // Remove fixed dimensions and make responsive
    svgEl.removeAttribute('width');
    svgEl.removeAttribute('height');
    svgEl.setAttribute('style', 'width:100%;height:auto;display:block;');
```

주의: `dataStage` switch는 D-06 명시 4 값(top/right/bottom/left) — default는 top fallback (방어적 코드).

**변경 E — TransformWrapper key + initialScale 모바일 분기 (라인 278~285)**:

기존 라인 278~285:
```tsx
      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={4}
        centerOnInit
        wheel={{ step: 0.1 }}
        doubleClick={{ disabled: true }}
      >
```

변경 후:
```tsx
      <TransformWrapper
        key={isMobile ? 'mobile' : 'desktop'}
        initialScale={isMobile ? 1.4 : 1}
        minScale={0.5}
        maxScale={4}
        centerOnInit
        wheel={{ step: 0.1 }}
        doubleClick={{ disabled: true }}
      >
```

**변경 F — MiniMap 마운트 (라인 286 `<SeatMapControls />` 직후, `<TransformComponent>` 직전)**:

기존 라인 286~287:
```tsx
        <SeatMapControls />
        <TransformComponent
```

변경 후:
```tsx
        <SeatMapControls />
        {!isMobile && (
          <MiniMap
            width={120}
            borderColor="#6C3CE0"
            className="absolute top-3 left-3 z-40 rounded-md border border-gray-200 bg-white/90 p-1 shadow-md"
          >
            <div
              dangerouslySetInnerHTML={{ __html: processedSvg }}
              aria-label="좌석 미니맵"
            />
          </MiniMap>
        )}
        <TransformComponent
```

주의:
- MiniMap children에 `dangerouslySetInnerHTML={{ __html: processedSvg }}` 사용 — RESEARCH §Pitfall 6에 따르면 sample-seat-map.svg에는 `<defs>` 없음 + ID 충돌 위험 0 (즉시 위험은 0). 외부 admin 업로드 SVG가 `<defs>`를 사용하는 경우는 별도 phase에서 ID 접두사 처리 도입 (deferred).
- `aria-label="좌석 미니맵"`은 UI-SPEC §"Copywriting Contract" 라인 141 + §"Accessibility Contract" 라인 257 명시.
- `borderColor="#6C3CE0"`는 Brand Purple — D-03 + UI-SPEC §"Color / Accent reserved for / 1. 미니맵 viewport rect stroke" 라인 97.
- 미니맵 컨테이너 className `absolute top-3 left-3 z-40 rounded-md border border-gray-200 bg-white/90 p-1 shadow-md` — UI-SPEC §"Layout Contract / 미니맵 위치" 라인 214.
- `{!isMobile && ...}` 조건부 렌더링이 D-16(모바일 숨김) 충족. CSS `hidden md:block` 클래스도 동등 효과지만 React 조건부가 mock test (Plan 12-00 케이스 4)에서 `querySelector('[data-testid="mini-map"]')` 부재 검증을 정확히 통과시키므로 권장.

**최종 점검 (사후)**:
- import 라인 변경 후 typecheck 통과 — `MiniMap` 타입은 react-zoom-pan-pinch 3.7.0 d.ts 명시 (RESEARCH §Pattern 2 line 271).
- `processedSvg`는 string — `dangerouslySetInnerHTML`에 안전하게 전달 가능 (DOMParser로 sanitize된 도메인 출력).
- `useIsMobile()` 호출 위치는 컴포넌트 함수 본문 진입부 (다른 hook들 ~ useRef/useState 직전 또는 직후) — React rules of hooks 준수.
- `processedSvg` useMemo deps는 변경 없음 — `[rawSvg, seatStates, selectedSeatIds, tierColorMap]` 그대로. STAGE 오버레이 + 체크마크 data-attr 모두 rawSvg + selectedSeatIds 기반이므로 신규 deps 불필요 (PATTERNS.md §S7).
- `isMobile`은 hook이지 useMemo 의존이 아님 — TransformWrapper의 `key` + `initialScale` prop으로만 사용.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && grep -q "import { TransformWrapper, TransformComponent, MiniMap } from 'react-zoom-pan-pinch';" apps/web/components/booking/seat-map-viewer.tsx && grep -q "import { useIsMobile } from '@/hooks/use-is-mobile';" apps/web/components/booking/seat-map-viewer.tsx && grep -q "const isMobile = useIsMobile();" apps/web/components/booking/seat-map-viewer.tsx && grep -q "transition:fill 150ms ease-out" apps/web/components/booking/seat-map-viewer.tsx && grep -q "'data-seat-checkmark', ''" apps/web/components/booking/seat-map-viewer.tsx && grep -q "data-stage" apps/web/components/booking/seat-map-viewer.tsx && grep -q "key={isMobile ? 'mobile' : 'desktop'}" apps/web/components/booking/seat-map-viewer.tsx && grep -q "initialScale={isMobile ? 1.4 : 1}" apps/web/components/booking/seat-map-viewer.tsx && grep -q "<MiniMap" apps/web/components/booking/seat-map-viewer.tsx && grep -q 'borderColor="#6C3CE0"' apps/web/components/booking/seat-map-viewer.tsx && grep -q "좌석 미니맵" apps/web/components/booking/seat-map-viewer.tsx && pnpm --filter @grapit/web typecheck 2>&1 | tail -5 && pnpm --filter @grapit/web lint 2>&1 | tail -5 && pnpm --filter @grapit/web test -- seat-map-viewer --run 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - import 라인 검증:
      - `grep -q "import { TransformWrapper, TransformComponent, MiniMap } from 'react-zoom-pan-pinch';" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "import { useIsMobile } from '@/hooks/use-is-mobile';" apps/web/components/booking/seat-map-viewer.tsx`
    - hook 호출 검증:
      - `grep -q "const isMobile = useIsMobile();" apps/web/components/booking/seat-map-viewer.tsx`
    - 변경 C (선택 좌석 transition + data-seat-checkmark) 검증:
      - `grep -q "transition:fill 150ms ease-out" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "'data-seat-checkmark', ''" apps/web/components/booking/seat-map-viewer.tsx`
      - locked/sold/available 분기 transition:none 유지: `grep -c "transition:none" apps/web/components/booking/seat-map-viewer.tsx` ≥ 2 (locked/sold + available)
    - 변경 D (STAGE 오버레이) 검증:
      - `grep -q "data-stage" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "hasStageText" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "createElementNS" apps/web/components/booking/seat-map-viewer.tsx` (SVG 네임스페이스 사용)
      - `grep -q "'STAGE'" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "무대 위치" apps/web/components/booking/seat-map-viewer.tsx` (aria-label)
    - 변경 E (TransformWrapper) 검증:
      - `grep -q "key={isMobile ? 'mobile' : 'desktop'}" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "initialScale={isMobile ? 1.4 : 1}" apps/web/components/booking/seat-map-viewer.tsx`
      - 기존 props 유지: `grep -q "minScale={0.5}" apps/web/components/booking/seat-map-viewer.tsx` + `grep -q "maxScale={4}" apps/web/components/booking/seat-map-viewer.tsx` + `grep -q "centerOnInit" apps/web/components/booking/seat-map-viewer.tsx`
    - 변경 F (MiniMap) 검증:
      - `grep -q "{!isMobile && (" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "<MiniMap" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q 'width={120}' apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q 'borderColor="#6C3CE0"' apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "absolute top-3 left-3 z-40" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "좌석 미니맵" apps/web/components/booking/seat-map-viewer.tsx`
    - 회귀 가드 (기존 상수/패턴 유지):
      - `grep -q "LOCKED_COLOR = '#D1D5DB'" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "SELECTED_STROKE = '#1A1A2E'" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q 'role="grid"' apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q 'aria-label="좌석 배치도"' apps/web/components/booking/seat-map-viewer.tsx`
    - any 금지:
      - `! grep -q ": any\\b\\|<any>" apps/web/components/booking/seat-map-viewer.tsx`
    - 정적 검사:
      - `pnpm --filter @grapit/web typecheck` exit 0
      - `pnpm --filter @grapit/web lint` exit 0
    - 테스트 GREEN (Plan 12-00의 11 케이스 모두):
      - `pnpm --filter @grapit/web test -- seat-map-viewer --run` exit 0
      - 출력에 "11 passed" 또는 ≥10 케이스 PASS 표시 (기존 6 + 신규 5)
      - "FAIL" 또는 "✗" 출력 0건
  </acceptance_criteria>
  <done>
seat-map-viewer.tsx에 5건 변경(transition 정책 + data-seat-checkmark attr + STAGE 오버레이 + TransformWrapper key/initialScale + MiniMap 마운트) 모두 적용. Plan 12-00의 11 케이스(기존 6 회귀 + 신규 5) 모두 GREEN. typecheck/lint GREEN. 기존 LOCKED_COLOR/SELECTED_STROKE/role/aria-label 등 회귀 가드 sentinel 모두 유지.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (변경 없음) | viewer는 R2 fetch + dangerouslySetInnerHTML로 SVG 렌더 — 본 plan은 기존 신뢰 경계 변경 0. admin SVG 검증은 Plan 12-02에서 mitigate 완료. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| (해당 없음) | — | — | — | Wave 3는 viewer 시각/상호작용 변경만 — 새 보안 표면 0. dangerouslySetInnerHTML로 R2 SVG 렌더는 기존 패턴이며 본 plan에서 변경 없음. T-12-01 (admin SVG 입력 검증)은 Plan 12-02에서 mitigate 완료. SVG <defs> ID 충돌 (RESEARCH §Pitfall 6)은 sample SVG에서 즉시 위험 0 — 외부 SVG 케이스는 deferred. |
</threat_model>

<verification>
- [ ] 변경 5건(import + isMobile + transition + checkmark attr + STAGE 오버레이 + TransformWrapper + MiniMap) 모두 적용 — 위 acceptance_criteria의 grep 검증 모두 통과
- [ ] 기존 6 회귀 케이스 GREEN 유지 (available/locked/click/sold-skip/selected stroke/error)
- [ ] 신규 5 케이스 GREEN (transition / data-seat-checkmark / MiniMap 마운트 분기 / initialScale 1.4 / STAGE 오버레이)
- [ ] `pnpm --filter @grapit/web typecheck` GREEN
- [ ] `pnpm --filter @grapit/web lint` GREEN
- [ ] LOCKED_COLOR / SELECTED_STROKE / role="grid" / aria-label="좌석 배치도" sentinel 회귀 0
- [ ] `transition:none`이 locked/sold/available 분기에 모두 유지 (D-13 회귀 방지)
</verification>

<success_criteria>
- 자동: 위 verification 7개 항목 모두 충족
- Plan 12-04 manual QA gate에서 검증할 시각 행위:
  - 좌석 클릭 시 체크마크 fade-in 부드럽게 (150ms)
  - 데스크톱 미니맵 좌상단 표시 + zoom/pan 시 viewport rect 동기 갱신
  - 모바일 디바이스에서 좌석 터치 폭 ≥ 44px (WCAG 2.5.5)
  - prefers-reduced-motion 켜기 시 체크마크 즉시 표시
  - 다른 사용자 좌석 잠금 broadcast 시 fade 없이 즉시 회색 전환 (D-13)
</success_criteria>

<output>
After completion, create `.planning/phases/12-ux/12-03-SUMMARY.md`:
- 변경 5건 파일 라인 인용 (import / hook 호출 / transition / checkmark attr / STAGE 오버레이 / TransformWrapper / MiniMap)
- 11 케이스 모두 GREEN 증거 (vitest 출력)
- typecheck/lint 결과
- Plan 12-04 manual QA에서 검증할 시각 행위 리스트
</output>
