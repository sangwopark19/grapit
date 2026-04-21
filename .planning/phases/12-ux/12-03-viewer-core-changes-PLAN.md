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
    - "선택 시 체크마크 opacity 0→1 fade-in 150ms + rect fill tier→primary 150ms transition이 사용자에게 시각적으로 보임 (B-2 접근 1: pendingSelections/pendingRemovals 메커니즘으로 CSS transition trigger 보장)"
    - "해제 시 체크마크 opacity 1→0 fade-out 150ms 후 DOM 제거 (UI-SPEC §Interaction 선택·해제 둘 다 fade) — `prefers-reduced-motion: reduce` 시만 즉시 제거"
    - "locked/sold/available 좌석은 `transition:none` 유지 (D-13 회귀 방지) — 실시간 broadcast 좌석 변화는 즉시 플립"
    - "선택 좌석에 삽입되는 체크마크 <text> 요소가 `data-seat-checkmark` 속성을 가지며, Plan 12-01에서 정의한 CSS @keyframes seat-checkmark-fade-in이 mount 시 150ms fade-in 자동 트리거 + 해제 시 `data-fading-out=\"true\"` 부여로 fade-out 자동 트리거"
    - "SVG에 `<text>STAGE</text>` 또는 `[data-stage]` 시각 요소가 이미 있으면 viewer no-op (idempotent), `data-stage` 속성만 있으면 viewer의 in-memory processedSvg에 viewBox 기준 변(top/right/bottom/left)에 STAGE 배지 <g> 오버레이를 추가 (R2 원본 SVG 파일은 변경하지 않음 — D-19 호환, W-1)"
    - "데스크톱(useIsMobile=false) viewer에 react-zoom-pan-pinch 내장 MiniMap 컴포넌트가 마운트 (좌상단 absolute, width 120, borderColor #6C3CE0), 모바일에서는 미마운트 (D-15/D-16). MiniMap children에 넘기는 SVG는 `<defs>` 내부 ID에 `mini-` 접두사를 부여하여 외부 admin 업로드 SVG와의 ID 충돌을 사전 방지 (W-6)"
    - "TransformWrapper에 `key={isMobile ? 'mobile' : 'desktop'}` + `initialScale={isMobile ? 1.4 : 1}` 적용 — 모바일 first paint 시 좌석 32px × 1.4 = 44.8px 보장 (WCAG 2.5.5)"
    - "Plan 12-00의 seat-map-viewer.test.tsx 신규 6 케이스(transition / data-seat-checkmark / MiniMap / initialScale / STAGE 오버레이 / B-2 pending attr fade) 모두 GREEN, 기존 6 회귀 케이스 GREEN 유지"
  artifacts:
    - path: "apps/web/components/booking/seat-map-viewer.tsx"
      provides: "UX-02 viewer STAGE 배지(in-memory) + UX-04 선택 좌석 transition + 체크마크 fade-in/out attr (B-2 pendingSelections/pendingRemovals) + UX-05 MiniMap (W-6 defs ID 접두사) + UX-06 모바일 initialScale 분기"
      contains: "MiniMap, useIsMobile, data-seat-checkmark, transition:fill 150ms, data-stage, initialScale: isMobile ? 1.4 : 1, key={isMobile, pendingSelections, pendingRemovals, data-fading-in, data-fading-out, mini-{id}"
  key_links:
    - from: "apps/web/components/booking/seat-map-viewer.tsx (체크마크 <text>)"
      to: "apps/web/app/globals.css [data-seat-checkmark] + [data-seat-checkmark][data-fading-out=\"true\"] CSS @keyframes (Plan 12-01)"
      via: "checkEl.setAttribute('data-seat-checkmark', '') (mount fade-in) + setAttribute('data-fading-out', 'true') (해제 fade-out 150ms) → 150ms 후 DOM 제거"
      pattern: "data-seat-checkmark.*data-fading-out"
    - from: "apps/web/components/booking/seat-map-viewer.tsx (TransformWrapper props)"
      to: "apps/web/hooks/use-is-mobile.ts (Plan 12-02)"
      via: "import { useIsMobile } + const isMobile = useIsMobile()"
      pattern: "import.*useIsMobile.*hooks/use-is-mobile"
    - from: "apps/web/components/booking/seat-map-viewer.tsx (MiniMap 마운트)"
      to: "react-zoom-pan-pinch 내장 MiniMap export"
      via: "import { TransformWrapper, TransformComponent, MiniMap } from 'react-zoom-pan-pinch' + miniSvg(processedSvg)로 defs ID 접두사 처리"
      pattern: "MiniMap.*from.*react-zoom-pan-pinch"
---

<objective>
Wave 3 — Viewer 핵심 변경.

`apps/web/components/booking/seat-map-viewer.tsx` 단일 파일에 UX-05/06 (import + isMobile + TransformWrapper key/initialScale + MiniMap with defs ID 접두사) + UX-02/04 (선택 좌석 transition + pendingSelections/pendingRemovals + 체크마크 fade-in/out + STAGE 오버레이) 변경을 적용한다.

**W-2 분리:** 단일 파일이지만 변경 범위가 6건으로 넓어 GREEN 게이트 독립을 위해 2개 task로 분리:
- **Task 1 (UX-05/06):** import + isMobile hook + TransformWrapper key/initialScale + MiniMap (with W-6 defs ID 접두사) — 변경 A/B/E/F
- **Task 2 (UX-02/04):** 선택 좌석 transition + pendingSelections/pendingRemovals (B-2) + 체크마크 fade-in/out attr + STAGE 오버레이 — 변경 C/D

Task 1과 Task 2는 동일 파일을 수정하므로 직렬 실행 (Task 2는 Task 1 완료 후). 각 task는 자체 GREEN 검증 게이트 보유 — Task 1 후 MiniMap/initialScale 케이스 GREEN, Task 2 후 transition/checkmark/STAGE/B-2 케이스 GREEN.

Plan 12-00에서 미리 작성된 회귀 케이스 6건 + 신규 6 케이스 12개 모두 GREEN으로 전환.

Purpose:
- D-07 (스테이지 방향 시각화), D-11/D-12 (선택 애니메이션), D-13 (broadcast 즉시 플립), D-14/D-15/D-16 (미니맵 위치/모바일 숨김), D-17/D-18 (모바일 자동 1.4x 줌) 충족
- B-2 접근 1 (pendingSelections/pendingRemovals)로 CSS transition이 사용자에게 시각적으로 보이도록 보장
- W-6 defs ID 접두사로 외부 admin 업로드 SVG의 ID 충돌 사전 방지
- W-1 STAGE 배지가 in-memory processedSvg 변경만이며 R2 원본 SVG 파일은 불변 (D-19 호환)

Output:
- `apps/web/components/booking/seat-map-viewer.tsx` 단일 파일에 6건 변경 (~80~100줄 추가/수정)
- Plan 12-00의 seat-map-viewer.test.tsx 신규 6 케이스 GREEN
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
- `[data-seat-checkmark] { animation: seat-checkmark-fade-in 150ms ease-out forwards; }` 정의되어 있음
- `[data-seat-checkmark][data-fading-out="true"] { animation: seat-checkmark-fade-out 150ms ease-out forwards; }` 정의되어 있음 (B-1)
- `@media (prefers-reduced-motion: reduce) { [data-seat-checkmark] { animation-duration: 0.01ms; } [data-seat-checkmark][data-fading-out="true"] { animation-duration: 0.01ms; } }` 정의되어 있음
- 본 plan의 Task 2가 체크마크 `<text>` 요소에 `data-seat-checkmark` (선택 시) + `data-fading-out="true"` (해제 시) 속성 추가만 — 별도 CSS 작성 불필요

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
  <name>Task 1 (UX-05/06): imports + useIsMobile + TransformWrapper key/initialScale + MiniMap (with W-6 defs ID 접두사)</name>
  <files>apps/web/components/booking/seat-map-viewer.tsx</files>
  <read_first>
    - apps/web/components/booking/seat-map-viewer.tsx (전체 312줄 — 모든 변경 위치를 정확히 식별, 특히 라인 4 import / 라인 30 컴포넌트 본문 / 라인 276~303 TransformWrapper 구조)
    - apps/web/components/booking/__tests__/seat-map-viewer.test.tsx (Plan 12-00 mock — vi.hoisted MiniMap mock + mockUseIsMobile 패턴 확인)
    - apps/web/hooks/use-is-mobile.ts (Plan 12-02 산출물 — import 대상)
    - .planning/phases/12-ux/12-PATTERNS.md §"apps/web/components/booking/seat-map-viewer.tsx (component, event-driven)" (line 105~253)
    - .planning/phases/12-ux/12-RESEARCH.md §"Code Examples / seat-map-viewer.tsx" (line 713~789) — MiniMap+모바일 분기
    - .planning/phases/12-ux/12-RESEARCH.md §"Pitfall 2: TransformWrapper initialScale prop change 무반응" (line 502~506)
    - .planning/phases/12-ux/12-RESEARCH.md §"Open Questions Q3: <defs> ID 충돌 방어" (line 950~953) — W-6 단기 처리 권장
    - .planning/phases/12-ux/12-CONTEXT.md D-14/D-15/D-16/D-17/D-18 (잠금 결정)
    - .planning/phases/12-ux/12-UI-SPEC.md §"Layout Contract / 좌석맵 뷰어" (line 190~217)
  </read_first>
  <behavior>
    - 변경 A (imports): `MiniMap` 추가, `useIsMobile` import 추가
    - 변경 B (hook 호출): 컴포넌트 본문 진입부에 `const isMobile = useIsMobile();` 한 줄 추가
    - 변경 E (D-17/D-18): TransformWrapper에 `key={isMobile ? 'mobile' : 'desktop'}` + `initialScale={isMobile ? 1.4 : 1}` 적용. minScale=0.5 / maxScale=4 / centerOnInit / wheel / doubleClick은 그대로 유지
    - 변경 F (D-14/D-15/D-16 + W-6): `<SeatMapControls />` 다음에 데스크톱 전용 MiniMap 마운트. children SVG는 `prefixSvgDefsIds(processedSvg, 'mini-')` 헬퍼로 `<defs>` 내부 ID에 `mini-` 접두사 부여 + 동일 ID를 참조하는 `url(#...)` 문자열 일괄 치환 (W-6, 추정 10~15줄 헬퍼)
  </behavior>
  <action>
정확히 다음 4건 변경을 단일 파일에 적용한다 (변경 C/D는 Task 2에서).

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

**변경 F — MiniMap 마운트 + W-6 defs ID 접두사 헬퍼 (라인 286 `<SeatMapControls />` 직후, `<TransformComponent>` 직전)**:

먼저 컴포넌트 함수 외부 (file scope, import 직후) 또는 useMemo 직전에 헬퍼 함수 추가:

```tsx
/**
 * W-6: SVG의 <defs> 내부 ID와 url(#...) 참조에 접두사를 부여하여
 * 같은 페이지 내 두 SVG 인스턴스(메인 좌석맵 + MiniMap) 간 ID 충돌을 방지.
 *
 * - admin이 업로드한 SVG가 <defs>를 사용하는 경우 외부 호환성 확보
 * - 헬퍼는 DOMParser 기반 — 정규식 회피 (RESEARCH §Pitfall 8)
 */
function prefixSvgDefsIds(svgString: string, prefix: string): string {
  if (!svgString.includes('<defs')) return svgString;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const defs = doc.querySelector('defs');
    if (!defs) return svgString;
    const idMap = new Map<string, string>();
    Array.from(defs.querySelectorAll('[id]')).forEach((el) => {
      const oldId = el.getAttribute('id');
      if (!oldId) return;
      const newId = `${prefix}${oldId}`;
      el.setAttribute('id', newId);
      idMap.set(oldId, newId);
    });
    if (idMap.size === 0) return svgString;
    let serialized = new XMLSerializer().serializeToString(doc);
    // url(#oldId) → url(#prefix-oldId) 일괄 치환
    idMap.forEach((newId, oldId) => {
      const escaped = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      serialized = serialized.replace(
        new RegExp(`url\\(#${escaped}\\)`, 'g'),
        `url(#${newId})`,
      );
    });
    return serialized;
  } catch {
    return svgString;
  }
}
```

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
              dangerouslySetInnerHTML={{ __html: prefixSvgDefsIds(processedSvg, 'mini-') }}
              aria-label="좌석 미니맵"
            />
          </MiniMap>
        )}
        <TransformComponent
```

주의:
- W-6 헬퍼: jsdom + 모든 evergreen 브라우저에 DOMParser/XMLSerializer 기본 제공. parse 실패 시 try/catch로 graceful — 원본 string 반환.
- W-6 정규식 escape: oldId가 정규식 메타문자를 포함할 가능성 (e.g., `gradient.1`) 대비 escape.
- W-6 단기 위험 0: sample-seat-map.svg에는 `<defs>` 없으므로 `if (!svgString.includes('<defs'))` 가드로 헬퍼는 no-op. 외부 admin SVG 업로드 시에만 작동.
- `aria-label="좌석 미니맵"`은 UI-SPEC §"Copywriting Contract" 라인 141 + §"Accessibility Contract" 라인 257 명시.
- `borderColor="#6C3CE0"`는 Brand Purple — D-03 + UI-SPEC §"Color / Accent reserved for / 1. 미니맵 viewport rect stroke" 라인 97.
- 미니맵 컨테이너 className `absolute top-3 left-3 z-40 rounded-md border border-gray-200 bg-white/90 p-1 shadow-md` — UI-SPEC §"Layout Contract / 미니맵 위치" 라인 214.
- `{!isMobile && ...}` 조건부 렌더링이 D-16(모바일 숨김) 충족.
- import 라인 변경 후 typecheck 통과 — `MiniMap` 타입은 react-zoom-pan-pinch 3.7.0 d.ts 명시.
- `useIsMobile()` 호출 위치는 컴포넌트 함수 본문 진입부 — React rules of hooks 준수.
- 본 task에서는 변경 C/D (transition + checkmark attr + STAGE 오버레이)는 적용하지 않음 — Task 2 게이트.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && grep -q "import { TransformWrapper, TransformComponent, MiniMap } from 'react-zoom-pan-pinch';" apps/web/components/booking/seat-map-viewer.tsx && grep -q "import { useIsMobile } from '@/hooks/use-is-mobile';" apps/web/components/booking/seat-map-viewer.tsx && grep -q "const isMobile = useIsMobile();" apps/web/components/booking/seat-map-viewer.tsx && grep -q "key={isMobile ? 'mobile' : 'desktop'}" apps/web/components/booking/seat-map-viewer.tsx && grep -q "initialScale={isMobile ? 1.4 : 1}" apps/web/components/booking/seat-map-viewer.tsx && grep -q "<MiniMap" apps/web/components/booking/seat-map-viewer.tsx && grep -q 'borderColor="#6C3CE0"' apps/web/components/booking/seat-map-viewer.tsx && grep -q "좌석 미니맵" apps/web/components/booking/seat-map-viewer.tsx && grep -q "prefixSvgDefsIds" apps/web/components/booking/seat-map-viewer.tsx && grep -q "'mini-'" apps/web/components/booking/seat-map-viewer.tsx && pnpm --filter @grapit/web typecheck 2>&1 | tail -5 && pnpm --filter @grapit/web lint 2>&1 | tail -5 && pnpm --filter @grapit/web test -- seat-map-viewer --run 2>&1 | tail -40</automated>
  </verify>
  <acceptance_criteria>
    - import 라인 검증:
      - `grep -q "import { TransformWrapper, TransformComponent, MiniMap } from 'react-zoom-pan-pinch';" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "import { useIsMobile } from '@/hooks/use-is-mobile';" apps/web/components/booking/seat-map-viewer.tsx`
    - hook 호출 검증:
      - `grep -q "const isMobile = useIsMobile();" apps/web/components/booking/seat-map-viewer.tsx`
    - 변경 E (TransformWrapper) 검증:
      - `grep -q "key={isMobile ? 'mobile' : 'desktop'}" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "initialScale={isMobile ? 1.4 : 1}" apps/web/components/booking/seat-map-viewer.tsx`
      - 기존 props 유지: `grep -q "minScale={0.5}" apps/web/components/booking/seat-map-viewer.tsx` + `grep -q "maxScale={4}" apps/web/components/booking/seat-map-viewer.tsx` + `grep -q "centerOnInit" apps/web/components/booking/seat-map-viewer.tsx`
    - 변경 F (MiniMap + W-6 defs ID 접두사) 검증:
      - `grep -q "{!isMobile && (" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "<MiniMap" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q 'width={120}' apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q 'borderColor="#6C3CE0"' apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "absolute top-3 left-3 z-40" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "좌석 미니맵" apps/web/components/booking/seat-map-viewer.tsx`
      - **W-6**: `grep -q "function prefixSvgDefsIds" apps/web/components/booking/seat-map-viewer.tsx`
      - **W-6**: `grep -q "prefixSvgDefsIds(processedSvg, 'mini-')" apps/web/components/booking/seat-map-viewer.tsx`
    - 회귀 가드 (기존 상수/패턴 유지):
      - `grep -q "LOCKED_COLOR = '#D1D5DB'" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "SELECTED_STROKE = '#1A1A2E'" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q 'role="grid"' apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q 'aria-label="좌석 배치도"' apps/web/components/booking/seat-map-viewer.tsx`
    - any 금지 (헬퍼 외부):
      - 헬퍼 prefixSvgDefsIds는 strict TS — 제네릭 없이 명시적 타입.
    - 정적 검사:
      - `pnpm --filter @grapit/web typecheck` exit 0
      - `pnpm --filter @grapit/web lint` exit 0
    - 테스트 GREEN (Task 1 범위 — UX-05/06 케이스):
      - `pnpm --filter @grapit/web test -- seat-map-viewer --run` exit 0 OR 일부 RED 허용 (Task 2 미완료 케이스)
      - 케이스 4 (MiniMap 마운트 분기) PASS
      - 케이스 5 (initialScale 1.4) PASS
      - 기존 6 회귀 케이스 PASS
      - **B-3 ReferenceError 0건**: `pnpm --filter @grapit/web test -- seat-map-viewer 2>&1 | grep -c "ReferenceError"` → 0
  </acceptance_criteria>
  <done>
seat-map-viewer.tsx에 변경 A/B/E/F 적용 (import + isMobile + TransformWrapper key/initialScale + MiniMap with W-6 defs ID 접두사). UX-05/06 케이스 GREEN. 기존 6 회귀 케이스 GREEN. typecheck/lint GREEN. Task 2 (변경 C/D)로 진행 가능.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 (UX-02/04): 선택 좌석 transition + pendingSelections/pendingRemovals (B-2) + 체크마크 fade-in/out + STAGE 오버레이 (W-1)</name>
  <files>apps/web/components/booking/seat-map-viewer.tsx</files>
  <read_first>
    - apps/web/components/booking/seat-map-viewer.tsx (Task 1 적용 후 — 변경 C/D 위치 정확히 식별. 라인 84~131 좌석 분기, 라인 134~146 viewBox 보장 + width/height 제거)
    - apps/web/components/booking/__tests__/seat-map-viewer.test.tsx (Plan 12-00 신규 케이스 1/2/3/6/7 — Task 2 후 GREEN 전환 대상)
    - apps/web/app/globals.css (Plan 12-01 산출물 — `[data-seat-checkmark]` selector + `[data-seat-checkmark][data-fading-out="true"]` selector + prefers-reduced-motion override 확인)
    - .planning/phases/12-ux/12-PATTERNS.md §"apps/web/components/booking/seat-map-viewer.tsx (component, event-driven)" (line 105~253)
    - .planning/phases/12-ux/12-RESEARCH.md §"Code Examples / seat-map-viewer.tsx" (line 594~711) — transition 정책 + STAGE 오버레이
    - .planning/phases/12-ux/12-CONTEXT.md D-07/D-11/D-12/D-13 + D-19 (SVG 파일 변경 없음 — W-1)
    - .planning/phases/12-ux/12-UI-SPEC.md §"Interaction & State Contract" (line 235~250) — 선택·해제 둘 다 fade
  </read_first>
  <behavior>
    - 변경 C-1 (D-11): 선택 좌석 분기(라인 88)의 inline style이 `'cursor:pointer;opacity:1;transition:fill 150ms ease-out,stroke 150ms ease-out;'`로 교체. locked/sold (라인 125), available (라인 130) 분기는 `transition:none` 유지.
    - 변경 C-2 (D-12 mount fade-in): 선택 좌석 체크마크 `<text>` (라인 109~119)에 `setAttribute('data-seat-checkmark', '')` 한 줄 추가.
    - 변경 C-3 (B-2 pendingSelections/pendingRemovals): 컴포넌트 본문에 `prevSelectedRef = useRef<Set<string>>(new Set())`, `pendingRemovals = useState<Set<string>>(new Set())`, `pendingSelections = useState<Set<string>>(new Set())` 도입. processedSvg useMemo가:
      - `[currentSelected - prevSelected]` 차집합 → 신규 선택 → rect에 `data-fading-in="true"` 부여 + 체크마크 mount(이미 data-seat-checkmark 자동 fade-in)
      - `[prevSelected - currentSelected]` 차집합 → 해제 → 해당 좌석의 체크마크를 즉시 제거하지 않고 `data-fading-out="true"` 부여 + rect에 `data-fading-out="true"` 부여 (fill 전 색상으로 transition)
      - useEffect로 `setTimeout(() => { setPendingRemovals(new Set()); setPendingSelections(new Set()); prevSelectedRef.current = new Set(currentSelected); }, 160)` 타이밍
    - 변경 D (D-07 + W-1): processedSvg useMemo의 viewBox 보장 직후, `removeAttribute('width')` 직전에 STAGE 배지 오버레이 로직 추가 — `<text>STAGE</text>` 부재 + `data-stage` 속성 존재 시 viewBox 변에 `<g>` 오버레이 in-memory 삽입. **중요(W-1): 본 변경은 useMemo 안에서 in-memory `doc`에만 적용 — R2 원본 SVG 파일은 변경 없음 (D-19 호환).**
  </behavior>
  <action>
정확히 다음 4건 변경을 단일 파일에 적용한다 (변경 A/B/E/F는 Task 1에서 이미 완료).

**변경 C-3 (B-2 state) — 컴포넌트 본문 hook 추가**:

Task 1에서 추가한 `const isMobile = useIsMobile();` 다음에 다음 state/ref 추가:

```tsx
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);

  // B-2: pendingSelections / pendingRemovals — 선택·해제 transition을 사용자에게 시각적으로 보이게 함
  const prevSelectedRef = useRef<Set<string>>(new Set());
  const [pendingSelections, setPendingSelections] = useState<Set<string>>(new Set());
  const [pendingRemovals, setPendingRemovals] = useState<Set<string>>(new Set());

  // selectedSeatIds 변경 감지 → 차집합 계산 → state 갱신 → 160ms 후 reset
  useEffect(() => {
    const prev = prevSelectedRef.current;
    const curr = selectedSeatIds;
    const newlySelected = new Set<string>();
    const newlyRemoved = new Set<string>();
    curr.forEach((id) => {
      if (!prev.has(id)) newlySelected.add(id);
    });
    prev.forEach((id) => {
      if (!curr.has(id)) newlyRemoved.add(id);
    });
    if (newlySelected.size === 0 && newlyRemoved.size === 0) return;
    setPendingSelections(newlySelected);
    setPendingRemovals(newlyRemoved);
    const t = setTimeout(() => {
      setPendingSelections(new Set());
      setPendingRemovals(new Set());
      prevSelectedRef.current = new Set(curr);
    }, 160);
    return () => clearTimeout(t);
  }, [selectedSeatIds]);
```

**변경 C-1 + C-2 (D-11/D-12 transition + checkmark attr) + B-2 fading-in/out 부여 — processedSvg useMemo 좌석 분기 수정**:

기존 라인 88 (선택 좌석 inline style):
```tsx
        el.setAttribute('style', 'cursor:pointer;opacity:1;transition:none');
```

변경 후 (선택 좌석에만 transition 활성 + B-2 data-fading-in 분기):
```tsx
        el.setAttribute(
          'style',
          'cursor:pointer;opacity:1;transition:fill 150ms ease-out,stroke 150ms ease-out;',
        );
        if (pendingSelections.has(seatId)) {
          el.setAttribute('data-fading-in', 'true');
        }
```

**해제 분기 (B-2 pendingRemovals)** — 좌석이 selectedSeatIds에는 없지만 pendingRemovals에 있으면 selected 처리 + data-fading-out:

기존 useMemo 좌석 분기에서 `selectedSeatIds.has(seatId)` 체크 직전 또는 직후에 다음 분기 추가:

```tsx
        // B-2: 해제 중인 좌석 — 체크마크/스타일 유지하되 data-fading-out 부여
        const isRemoving = pendingRemovals.has(seatId);
        const isSelectedOrRemoving = selectedSeatIds.has(seatId) || isRemoving;
        if (isSelectedOrRemoving) {
          // 기존 선택 좌석 렌더 로직 그대로 진입
          // ... (기존 라인 88~119 그대로) ...
          if (isRemoving) {
            el.setAttribute('data-fading-out', 'true');
          }
        }
```

(정확한 패치 형태는 기존 코드 구조에 따라 약간 조정 — `if (selectedSeatIds.has(seatId))` 체크를 `if (isSelectedOrRemoving)`로 교체하고, isRemoving이면 fill을 tier 색상(이전 색)으로 유지하여 transition trigger.)

기존 라인 117 (`checkEl.setAttribute('pointer-events', 'none');`) 직후에 한 줄 추가 + 해제 시 data-fading-out:
```tsx
            checkEl.setAttribute('pointer-events', 'none');
            checkEl.setAttribute('data-seat-checkmark', '');
            if (isRemoving) {
              checkEl.setAttribute('data-fading-out', 'true');
            }
            checkEl.textContent = '✓';
```

**라인 121~131 (locked/sold + available 분기)는 변경 없음** — `transition:none` 유지 (D-13 회귀 방지).

**변경 D (D-07 + W-1: STAGE 배지 오버레이) — viewBox 보장 직후, removeAttribute('width') 직전**:

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

    // Phase 12 (D-07 + W-1): STAGE 배지 오버레이 — SVG에 시각 요소 부재 + data-stage 속성만 있을 때
    // ⚠ in-memory `doc`에만 적용 — R2 원본 SVG 파일은 변경하지 않음 (D-19 호환)
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

주의:
- W-1: STAGE 오버레이는 useMemo 안 in-memory `doc`에만 적용 — `processedSvg`라는 string 변수 출력으로만 영향. R2 원본 SVG 파일에는 어떤 변경도 발생하지 않음. D-19 호환.
- `dataStage` switch는 D-06 명시 4 값(top/right/bottom/left) — default는 top fallback (방어적 코드).
- B-2 useMemo deps: 신규 deps에 `pendingSelections`, `pendingRemovals` 추가 필요. 기존 deps `[rawSvg, seatStates, selectedSeatIds, tierColorMap]`에 두 개 추가.
- B-2 setTimeout cleanup: useEffect의 return으로 `clearTimeout(t)` 보장 — 빠른 연속 클릭 시 race condition 방지.
- `processedSvg` useMemo는 string 반환 — string에 `data-fading-in`/`data-fading-out` 속성이 attribute로 직렬화됨. dangerouslySetInnerHTML로 마운트되면 CSS selector 즉시 매칭.
- `useEffect`/`useState` import 추가 (이미 있다면 skip).
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && grep -q "transition:fill 150ms ease-out" apps/web/components/booking/seat-map-viewer.tsx && grep -q "'data-seat-checkmark', ''" apps/web/components/booking/seat-map-viewer.tsx && grep -q "data-stage" apps/web/components/booking/seat-map-viewer.tsx && grep -q "pendingSelections" apps/web/components/booking/seat-map-viewer.tsx && grep -q "pendingRemovals" apps/web/components/booking/seat-map-viewer.tsx && grep -q "data-fading-in" apps/web/components/booking/seat-map-viewer.tsx && grep -q "data-fading-out" apps/web/components/booking/seat-map-viewer.tsx && grep -q "createElementNS" apps/web/components/booking/seat-map-viewer.tsx && grep -q "'STAGE'" apps/web/components/booking/seat-map-viewer.tsx && grep -q "무대 위치" apps/web/components/booking/seat-map-viewer.tsx && pnpm --filter @grapit/web typecheck 2>&1 | tail -5 && pnpm --filter @grapit/web lint 2>&1 | tail -5 && pnpm --filter @grapit/web test -- seat-map-viewer --run 2>&1 | tail -40</automated>
  </verify>
  <acceptance_criteria>
    - 변경 C-1 (선택 좌석 transition) 검증:
      - `grep -q "transition:fill 150ms ease-out" apps/web/components/booking/seat-map-viewer.tsx`
      - locked/sold/available 분기 transition:none 유지: `grep -c "transition:none" apps/web/components/booking/seat-map-viewer.tsx` ≥ 2
    - 변경 C-2 (체크마크 data-seat-checkmark) 검증:
      - `grep -q "'data-seat-checkmark', ''" apps/web/components/booking/seat-map-viewer.tsx`
    - 변경 C-3 (B-2 pendingSelections/pendingRemovals) 검증:
      - `grep -q "pendingSelections" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "pendingRemovals" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "data-fading-in" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "data-fading-out" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "prevSelectedRef" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "setTimeout" apps/web/components/booking/seat-map-viewer.tsx` (160ms 타이머)
    - 변경 D (STAGE 오버레이 + W-1) 검증:
      - `grep -q "data-stage" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "hasStageText" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "createElementNS" apps/web/components/booking/seat-map-viewer.tsx` (SVG 네임스페이스 사용)
      - `grep -q "'STAGE'" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "무대 위치" apps/web/components/booking/seat-map-viewer.tsx` (aria-label)
    - 회귀 가드 (Task 1 sentinel 유지):
      - `grep -q "import { TransformWrapper, TransformComponent, MiniMap }" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "key={isMobile ? 'mobile' : 'desktop'}" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "<MiniMap" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "prefixSvgDefsIds" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "LOCKED_COLOR = '#D1D5DB'" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "SELECTED_STROKE = '#1A1A2E'" apps/web/components/booking/seat-map-viewer.tsx`
    - any 금지:
      - `! grep -q ": any\\b\\|<any>" apps/web/components/booking/seat-map-viewer.tsx`
    - 정적 검사:
      - `pnpm --filter @grapit/web typecheck` exit 0
      - `pnpm --filter @grapit/web lint` exit 0
    - 테스트 GREEN (Plan 12-00의 12 케이스 모두):
      - `pnpm --filter @grapit/web test -- seat-map-viewer --run` exit 0
      - 출력에 "12 passed" 또는 ≥11 케이스 PASS 표시 (기존 6 + 신규 6)
      - 신규 케이스 1 (transition), 2 (locked transition:none), 3 (data-seat-checkmark), 6 (STAGE 오버레이), 7 (B-2 data-fading-in/out) 모두 PASS
      - "FAIL" 또는 "✗" 출력 0건
  </acceptance_criteria>
  <done>
seat-map-viewer.tsx에 변경 C/D (선택 좌석 transition + 체크마크 data-seat-checkmark + B-2 pendingSelections/pendingRemovals + STAGE 오버레이 with W-1 in-memory only) 모두 적용. Plan 12-00의 12 케이스(기존 6 회귀 + 신규 6) 모두 GREEN. typecheck/lint GREEN. R2 원본 SVG 변경 없음 보장.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (변경 없음) | viewer는 R2 fetch + dangerouslySetInnerHTML로 SVG 렌더 — 본 plan은 기존 신뢰 경계 변경 0. admin SVG 검증은 Plan 12-02에서 mitigate 완료. STAGE 오버레이는 in-memory only (W-1) — R2 원본 SVG 파일에 영향 없음. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| (해당 없음) | — | — | — | Wave 3는 viewer 시각/상호작용 변경만 — 새 보안 표면 0. dangerouslySetInnerHTML로 R2 SVG 렌더는 기존 패턴이며 본 plan에서 변경 없음. T-12-01 (admin SVG 입력 검증)은 Plan 12-02에서 mitigate 완료. SVG `<defs>` ID 충돌 (RESEARCH §Pitfall 6)은 W-6의 `prefixSvgDefsIds` 헬퍼로 외부 admin SVG 케이스 mitigate. |
</threat_model>

<verification>
- [ ] Task 1: 변경 A/B/E/F 적용 (import + isMobile + TransformWrapper + MiniMap with W-6 defs ID 접두사) — UX-05/06 케이스 GREEN
- [ ] Task 2: 변경 C/D 적용 (transition + checkmark attr + B-2 pendingSelections/pendingRemovals + STAGE 오버레이 in-memory) — UX-02/04 케이스 GREEN
- [ ] 기존 6 회귀 케이스 GREEN 유지 (available/locked/click/sold-skip/selected stroke/error)
- [ ] 신규 6 케이스 GREEN (transition / data-seat-checkmark / MiniMap 마운트 분기 / initialScale 1.4 / STAGE 오버레이 / B-2 pending attr fade)
- [ ] `pnpm --filter @grapit/web typecheck` GREEN
- [ ] `pnpm --filter @grapit/web lint` GREEN
- [ ] LOCKED_COLOR / SELECTED_STROKE / role="grid" / aria-label="좌석 배치도" sentinel 회귀 0
- [ ] `transition:none`이 locked/sold/available 분기에 모두 유지 (D-13 회귀 방지)
- [ ] W-1: STAGE 오버레이가 in-memory `doc`에만 적용 — R2 원본 SVG 파일 변경 0
- [ ] W-6: `prefixSvgDefsIds` 헬퍼 존재 + `<defs>` 가드로 단기 위험 0
</verification>

<success_criteria>
- 자동: 위 verification 9개 항목 모두 충족
- Plan 12-04 manual QA gate에서 검증할 시각 행위:
  - 좌석 클릭 시 체크마크 fade-in 부드럽게 (150ms)
  - 좌석 해제 시 체크마크 fade-out 부드럽게 (150ms 후 DOM 제거 — UI-SPEC §Interaction)
  - 데스크톱 미니맵 좌상단 표시 + zoom/pan 시 viewport rect 동기 갱신
  - 모바일 디바이스에서 좌석 터치 폭 ≥ 44px (WCAG 2.5.5)
  - prefers-reduced-motion 켜기 시 체크마크 fade-in/fade-out 모두 즉시 (0.01ms)
  - 다른 사용자 좌석 잠금 broadcast 시 fade 없이 즉시 회색 전환 (D-13)
</success_criteria>

<output>
After completion, create `.planning/phases/12-ux/12-03-SUMMARY.md`:
- Task 1 변경 4건 파일 라인 인용 (import / hook 호출 / TransformWrapper / MiniMap with W-6 helper)
- Task 2 변경 4건 파일 라인 인용 (transition / checkmark attr / B-2 pending state / STAGE 오버레이 with W-1 in-memory)
- 12 케이스 모두 GREEN 증거 (vitest 출력)
- typecheck/lint 결과
- B-2 접근 1 (pendingSelections/pendingRemovals) 채택 증거
- W-1 (STAGE in-memory only) + W-6 (defs ID 접두사) 적용 증거
- Plan 12-04 manual QA에서 검증할 시각 행위 리스트 (선택·해제 둘 다 fade 포함)
</output>
</content>
