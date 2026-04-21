---
phase: 12
plan: 03
plan_number: 3
type: execute
wave: 3
depends_on: ["12-00", "12-01", "12-02"]
files_modified:
  - apps/web/components/booking/seat-map-viewer.tsx
  - apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts
autonomous: true
requirements: [UX-02, UX-04, UX-05, UX-06]
must_haves:
  truths:
    - "선택 시 rect fill이 tier→primary로 fill 150ms transition으로 사용자에게 시각적으로 보임 (B-2-RESIDUAL Option C: useMemo는 기본 색상만, 별도 useEffect가 dangerouslySetInnerHTML 마운트 직후 동일 DOM element의 fill 속성을 변경 → CSS transition 정상 발화)"
    - "선택 시 체크마크 opacity 0→1 fade-in 150ms은 useMemo 안에서 `data-seat-checkmark` 부여 → CSS @keyframes (mount-time 트리거)로 자동 작동 (dangerouslySetInnerHTML 재생성과 호환)"
    - "해제 시 체크마크에 `data-fading-out=\"true\"` 부여 → CSS @keyframes seat-checkmark-fade-out 150ms 후 다음 useMemo 사이클에 DOM 제거 (UI-SPEC §Interaction §L240~243 충족)"
    - "locked/sold/available 좌석은 `transition:none` 유지 (D-13 회귀 방지) — 실시간 broadcast 좌석 변화는 즉시 플립"
    - "useMemo deps에 `pendingRemovals`만 포함 (selectedSeatIds 제거) — useMemo는 *기본 색상 + 체크마크 mount/unmount/data-fading-out*만 결정, *fill 변경은 useEffect가 담당*"
    - "별도 useEffect가 selectedSeatIds + pendingRemovals + tierColorMap에 의존하여 마운트된 SVG의 동일 rect element에 직접 `fill` 속성 변경 + `el.style.transition = 'fill 150ms ease-out'` 부여 → CSS transition이 *속성 변경*에서 정상 발화"
    - "SVG에 `<text>STAGE</text>` 또는 `[data-stage]` 시각 요소가 이미 있으면 viewer no-op (idempotent), `data-stage` 속성만 있으면 viewer의 in-memory processedSvg에 viewBox 기준 변(top/right/bottom/left)에 STAGE 배지 <g> 오버레이 추가 (R2 원본 SVG 파일은 변경하지 않음 — D-19 호환, W-1)"
    - "데스크톱(useIsMobile=false) viewer에 react-zoom-pan-pinch 내장 MiniMap 컴포넌트가 마운트, 모바일에서는 미마운트 (D-15/D-16). MiniMap children에 넘기는 SVG는 별도 파일 `apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts`로 분리한 `prefixSvgDefsIds` named export 헬퍼로 `<defs>` 내부 ID에 `mini-` 접두사 부여 (W-2 helper 분리)"
    - "TransformWrapper에 `key={isMobile ? 'mobile' : 'desktop'}` + `initialScale={isMobile ? 1.4 : 1}` 적용 — 모바일 first paint 시 좌석 32px × 1.4 = 44.8px 보장 (WCAG 2.5.5)"
    - "Plan 12-00의 seat-map-viewer.test.tsx 신규 6 케이스(transition / data-seat-checkmark / MiniMap / initialScale / STAGE 오버레이 / B-2 useEffect fill change) + prefix-svg-defs-ids.test.ts 5 케이스 모두 GREEN, 기존 6 회귀 케이스 GREEN 유지"
  artifacts:
    - path: "apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts"
      provides: "W-2: SVG <defs> ID 충돌 방지 헬퍼 — 단위 테스트 가능한 별도 파일 + named export"
      contains: "export function prefixSvgDefsIds(svgString: string, prefix: string): string"
    - path: "apps/web/components/booking/seat-map-viewer.tsx"
      provides: "UX-02 viewer STAGE 배지(in-memory) + UX-04 선택 좌석 transition (B-2-RESIDUAL Option C: useEffect 직접 DOM 조작) + 체크마크 fade-in/out attr + UX-05 MiniMap (W-2 helper import) + UX-06 모바일 initialScale 분기"
      contains: "MiniMap, useIsMobile, data-seat-checkmark, data-fading-out, initialScale: isMobile ? 1.4 : 1, key={isMobile, pendingRemovals, useEffect with selectedSeatIds, el.style.transition = 'fill 150ms ease-out', el.setAttribute('fill', ...)"
  key_links:
    - from: "apps/web/components/booking/seat-map-viewer.tsx (체크마크 <text>)"
      to: "apps/web/app/globals.css [data-seat-checkmark] + [data-seat-checkmark][data-fading-out=\"true\"] CSS @keyframes (Plan 12-01)"
      via: "useMemo: checkEl.setAttribute('data-seat-checkmark', '') (mount fade-in) + setAttribute('data-fading-out', 'true') (해제 fade-out) → CSS @keyframes mount-time 트리거"
      pattern: "data-seat-checkmark.*data-fading-out"
    - from: "apps/web/components/booking/seat-map-viewer.tsx (별도 useEffect)"
      to: "마운트된 SVG의 동일 rect element (dangerouslySetInnerHTML 마운트 후)"
      via: "useEffect → containerRef.current.querySelector(`[data-seat-id=...]`) → el.style.transition + el.setAttribute('fill', ...) → CSS transition이 속성 변경에서 정상 발화 (B-2-RESIDUAL Option C)"
      pattern: "el\\.style\\.transition.*fill 150ms"
    - from: "apps/web/components/booking/seat-map-viewer.tsx (TransformWrapper props)"
      to: "apps/web/hooks/use-is-mobile.ts (Plan 12-02)"
      via: "import { useIsMobile } + const isMobile = useIsMobile()"
      pattern: "import.*useIsMobile.*hooks/use-is-mobile"
    - from: "apps/web/components/booking/seat-map-viewer.tsx (MiniMap 마운트)"
      to: "react-zoom-pan-pinch 내장 MiniMap export + apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts (W-2)"
      via: "import { TransformWrapper, TransformComponent, MiniMap } from 'react-zoom-pan-pinch' + import { prefixSvgDefsIds } from './__utils__/prefix-svg-defs-ids' + miniSvg(processedSvg)로 defs ID 접두사 처리"
      pattern: "MiniMap.*from.*react-zoom-pan-pinch"
---

<objective>
Wave 3 — Viewer 핵심 변경.

`apps/web/components/booking/seat-map-viewer.tsx` 단일 파일에 UX-05/06 (import + isMobile + TransformWrapper key/initialScale + MiniMap with helper) + UX-02/04 (STAGE 오버레이 + 선택 좌석 transition + 체크마크 fade-in/out) 변경을 적용한다. 추가로 W-2 헬퍼는 별도 파일(`apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts`)로 분리하여 단위 테스트 가능하게 한다.

**I-1 분리 (Option C 적용 후 변경 폭 100줄 초과):** 단일 파일이지만 변경 범위가 크고 책임이 다른 3가지 영역(import/Mini분기, STAGE 오버레이, fill transition useEffect)에 걸쳐 있어 GREEN 게이트 독립을 위해 3개 task로 분리:
- **Task 1 (UX-05/06):** W-2 헬퍼 파일 신규 + import + isMobile hook + TransformWrapper key/initialScale + MiniMap (with helper import)
- **Task 2 (UX-02 STAGE):** STAGE 오버레이 in-memory only (W-1) + 체크마크 `data-seat-checkmark`/`data-fading-out` attr useMemo 변경 + useMemo deps에서 selectedSeatIds 제거 + pendingRemovals state/setTimeout 도입
- **Task 3 (UX-04 transition + B-2-RESIDUAL Option C):** rect fill transition을 별도 useEffect에서 직접 DOM 조작 — `el.style.transition = 'fill 150ms ease-out'` + `el.setAttribute('fill', ...)`. dangerouslySetInnerHTML이 SVG를 재마운트한 *직후* useEffect가 실행되어 *동일 element의 속성 변경*에서 CSS transition 정상 발화

세 task는 동일 파일(seat-map-viewer.tsx)을 수정하므로 직렬 실행. 각 task는 자체 GREEN 검증 게이트 보유 — Task 1 후 MiniMap/initialScale 케이스 GREEN, Task 2 후 STAGE/checkmark 케이스 GREEN, Task 3 후 transition + fill 변경 케이스 GREEN.

Plan 12-00에서 미리 작성된 회귀 케이스 6건 + 신규 6 케이스 + helper 5 케이스 = 17개 모두 GREEN으로 전환.

Purpose:
- D-07 (스테이지 방향 시각화), D-11/D-12 (선택 애니메이션), D-13 (broadcast 즉시 플립), D-14/D-15/D-16 (미니맵 위치/모바일 숨김), D-17/D-18 (모바일 자동 1.4x 줌) 충족
- B-2-RESIDUAL Option C로 *useEffect가 동일 DOM element의 속성을 변경* → CSS `transition: fill 150ms`가 정상 발화 (RESEARCH §Pitfall 3 권장 패턴 — useMemo의 dangerouslySetInnerHTML 재생성과 호환)
- W-2 헬퍼 별도 파일 분리로 5 케이스 단위 테스트 가능
- W-1 STAGE 배지가 in-memory processedSvg 변경만이며 R2 원본 SVG 파일은 불변 (D-19 호환)

Output:
- `apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts` 신규 파일 (~30~40줄, named export)
- `apps/web/components/booking/seat-map-viewer.tsx` 단일 파일에 변경 (~120~140줄 추가/수정)
- Plan 12-00의 seat-map-viewer.test.tsx 신규 6 케이스 GREEN
- Plan 12-00의 prefix-svg-defs-ids.test.ts 5 케이스 GREEN
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
- `[data-seat-checkmark][data-fading-out="true"] { animation: seat-checkmark-fade-out 150ms ease-out forwards; }` 정의되어 있음
- `@media (prefers-reduced-motion: reduce) { [data-seat-checkmark] { animation-duration: 0.01ms; } [data-seat-checkmark][data-fading-out="true"] { animation-duration: 0.01ms; } }` 정의되어 있음
- 본 plan의 Task 2가 체크마크 `<text>` 요소에 `data-seat-checkmark` (선택 시) + `data-fading-out="true"` (해제 시) 속성 추가만 — 별도 CSS 작성 불필요 (CSS @keyframes는 mount-time 트리거이므로 dangerouslySetInnerHTML 재생성과 호환)

Hook contract (Plan 12-02 use-is-mobile.ts):
- `import { useIsMobile } from '@/hooks/use-is-mobile';`
- `const isMobile = useIsMobile();` 호출 시 boolean 반환 (SSR=false, 클라이언트=matchMedia 결과)

Library contract (react-zoom-pan-pinch 3.7.0 — RESEARCH §Pattern 2):
- `import { TransformWrapper, TransformComponent, MiniMap } from 'react-zoom-pan-pinch';`
- `MiniMap` props: `{ children, width?, height?, borderColor?, ...HTMLDivElement props }`
- `TransformWrapper` `initialScale` prop은 mount 시 1회만 평가 — `key` prop으로 강제 재마운트 (RESEARCH §Pitfall 2)

**B-2-RESIDUAL Option C 재설계 (RESEARCH §Pitfall 3):**
- useMemo가 outerHTML을 string으로 반환 → dangerouslySetInnerHTML로 마운트 시 React가 자식 DOM을 unmount/remount → 새 rect는 mount 시점부터 fill이 박혀 *이전→새 값* 변화가 없음 → CSS `transition: fill 150ms` (속성 변경 트리거) 무효
- 체크마크 fade-in/fade-out은 CSS @keyframes (mount-time 트리거) → dangerouslySetInnerHTML 재생성과 호환 ✓
- rect fill만 transition이라 깨짐 → **별도 useEffect로 마운트 직후 동일 element의 속성을 변경** → CSS transition 정상 발화 ✓
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1 (UX-05/06): W-2 헬퍼 파일 분리 + imports + useIsMobile + TransformWrapper key/initialScale + MiniMap</name>
  <files>apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts, apps/web/components/booking/seat-map-viewer.tsx</files>
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
    - 변경 0 (W-2 helper 분리): `apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts` 신규 파일 — `prefixSvgDefsIds` named export. `<defs>` 가드 / DOMParser parse / id 매핑 / url(#) 일괄 치환 / try-catch graceful fallback.
    - 변경 A (imports): `MiniMap` 추가, `useIsMobile` import 추가, `prefixSvgDefsIds` import 추가
    - 변경 B (hook 호출): 컴포넌트 본문 진입부에 `const isMobile = useIsMobile();` 한 줄 추가
    - 변경 E (D-17/D-18): TransformWrapper에 `key={isMobile ? 'mobile' : 'desktop'}` + `initialScale={isMobile ? 1.4 : 1}` 적용. minScale=0.5 / maxScale=4 / centerOnInit / wheel / doubleClick은 그대로 유지
    - 변경 F (D-14/D-15/D-16 + W-2): `<SeatMapControls />` 다음에 데스크톱 전용 MiniMap 마운트. children SVG는 `prefixSvgDefsIds(processedSvg, 'mini-')` 호출
  </behavior>
  <action>
**변경 0 — W-2 helper 별도 파일 분리** (`apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts` 신규):

```ts
/**
 * W-2: SVG의 <defs> 내부 ID와 url(#...) 참조에 접두사를 부여하여
 * 같은 페이지 내 두 SVG 인스턴스(메인 좌석맵 + MiniMap) 간 ID 충돌을 방지.
 *
 * - admin이 업로드한 SVG가 <defs>를 사용하는 경우 외부 호환성 확보
 * - DOMParser 기반 — 정규식 회피 (RESEARCH §Pitfall 8)
 * - parse 실패 시 graceful — 원본 string 반환
 *
 * @param svgString - SVG outerHTML string
 * @param prefix - ID에 부여할 접두사 (e.g., 'mini-')
 * @returns prefix가 부여된 SVG outerHTML string. <defs> 없거나 ID 없으면 원본 그대로.
 */
export function prefixSvgDefsIds(svgString: string, prefix: string): string {
  if (!svgString.includes('<defs')) return svgString;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    // parseerror 가드: invalid XML이면 documentElement.tagName이 'parsererror'
    if (doc.documentElement.tagName === 'parsererror') return svgString;
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
    // url(#oldId) → url(#prefix-oldId) 일괄 치환 (정규식 메타문자 escape)
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

**변경 A — Imports (라인 4 + 신규 import 2줄 추가)**:

기존 라인 4:
```tsx
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
```

변경 후:
```tsx
import { TransformWrapper, TransformComponent, MiniMap } from 'react-zoom-pan-pinch';
```

기존 라인 9 직후에 신규 import 2개 추가:
```tsx
import { SeatMapControls } from './seat-map-controls';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { prefixSvgDefsIds } from './__utils__/prefix-svg-defs-ids';
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

**변경 F — MiniMap 마운트 + W-2 helper 호출 (라인 286 `<SeatMapControls />` 직후, `<TransformComponent>` 직전)**:

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
- W-2 헬퍼는 별도 파일이며 named export. 단위 테스트는 Plan 12-00 Task 4가 작성 (5 케이스). vitest가 `apps/web/components/booking/__utils__/__tests__/prefix-svg-defs-ids.test.ts`에서 직접 import.
- jsdom + 모든 evergreen 브라우저에 DOMParser/XMLSerializer 기본 제공. parse 실패 시 try/catch + parsererror tagName 가드로 graceful — 원본 string 반환.
- 정규식 escape: oldId가 정규식 메타문자를 포함할 가능성 (e.g., `gradient.1`) 대비 escape.
- 단기 위험 0: sample-seat-map.svg에는 `<defs>` 없으므로 `if (!svgString.includes('<defs'))` 가드로 헬퍼는 no-op. 외부 admin SVG 업로드 시에만 작동.
- `aria-label="좌석 미니맵"`은 UI-SPEC §"Copywriting Contract" 라인 141 + §"Accessibility Contract" 라인 257 명시.
- `borderColor="#6C3CE0"`는 Brand Purple — D-03 + UI-SPEC §"Color / Accent reserved for / 1. 미니맵 viewport rect stroke" 라인 97.
- 미니맵 컨테이너 className `absolute top-3 left-3 z-40 rounded-md border border-gray-200 bg-white/90 p-1 shadow-md` — UI-SPEC §"Layout Contract / 미니맵 위치" 라인 214.
- `{!isMobile && ...}` 조건부 렌더링이 D-16(모바일 숨김) 충족.
- import 라인 변경 후 typecheck 통과 — `MiniMap` 타입은 react-zoom-pan-pinch 3.7.0 d.ts 명시.
- `useIsMobile()` 호출 위치는 컴포넌트 함수 본문 진입부 — React rules of hooks 준수.
- 본 task에서는 변경 C/D (transition + checkmark attr + STAGE 오버레이)는 적용하지 않음 — Task 2/3 게이트.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && test -f apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts && grep -q "export function prefixSvgDefsIds" apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts && grep -q "import { TransformWrapper, TransformComponent, MiniMap } from 'react-zoom-pan-pinch';" apps/web/components/booking/seat-map-viewer.tsx && grep -q "import { useIsMobile } from '@/hooks/use-is-mobile';" apps/web/components/booking/seat-map-viewer.tsx && grep -q "import { prefixSvgDefsIds } from './__utils__/prefix-svg-defs-ids';" apps/web/components/booking/seat-map-viewer.tsx && grep -q "const isMobile = useIsMobile();" apps/web/components/booking/seat-map-viewer.tsx && grep -q "key={isMobile ? 'mobile' : 'desktop'}" apps/web/components/booking/seat-map-viewer.tsx && grep -q "initialScale={isMobile ? 1.4 : 1}" apps/web/components/booking/seat-map-viewer.tsx && grep -q "<MiniMap" apps/web/components/booking/seat-map-viewer.tsx && grep -q 'borderColor="#6C3CE0"' apps/web/components/booking/seat-map-viewer.tsx && grep -q "좌석 미니맵" apps/web/components/booking/seat-map-viewer.tsx && grep -q "prefixSvgDefsIds(processedSvg, 'mini-')" apps/web/components/booking/seat-map-viewer.tsx && pnpm --filter @grapit/web typecheck 2>&1 | tail -5 && pnpm --filter @grapit/web lint 2>&1 | tail -5 && pnpm --filter @grapit/web test -- seat-map-viewer prefix-svg-defs-ids --run 2>&1 | tail -50</automated>
  </verify>
  <acceptance_criteria>
    - W-2 helper 파일 검증:
      - `test -f apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts`
      - `grep -q "export function prefixSvgDefsIds" apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts`
      - `grep -q "DOMParser" apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts`
      - `grep -q "XMLSerializer" apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts`
      - `grep -q "parsererror" apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts` (graceful 가드)
    - import 라인 검증:
      - `grep -q "import { TransformWrapper, TransformComponent, MiniMap } from 'react-zoom-pan-pinch';" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "import { useIsMobile } from '@/hooks/use-is-mobile';" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "import { prefixSvgDefsIds } from './__utils__/prefix-svg-defs-ids';" apps/web/components/booking/seat-map-viewer.tsx`
    - hook 호출 검증:
      - `grep -q "const isMobile = useIsMobile();" apps/web/components/booking/seat-map-viewer.tsx`
    - 변경 E (TransformWrapper) 검증:
      - `grep -q "key={isMobile ? 'mobile' : 'desktop'}" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "initialScale={isMobile ? 1.4 : 1}" apps/web/components/booking/seat-map-viewer.tsx`
      - 기존 props 유지: `grep -q "minScale={0.5}" apps/web/components/booking/seat-map-viewer.tsx` + `grep -q "maxScale={4}" apps/web/components/booking/seat-map-viewer.tsx` + `grep -q "centerOnInit" apps/web/components/booking/seat-map-viewer.tsx`
    - 변경 F (MiniMap + W-2 helper 호출) 검증:
      - `grep -q "{!isMobile && (" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "<MiniMap" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q 'width={120}' apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q 'borderColor="#6C3CE0"' apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "absolute top-3 left-3 z-40" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "좌석 미니맵" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "prefixSvgDefsIds(processedSvg, 'mini-')" apps/web/components/booking/seat-map-viewer.tsx`
    - 회귀 가드 (기존 상수/패턴 유지):
      - `grep -q "LOCKED_COLOR = '#D1D5DB'" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "SELECTED_STROKE = '#1A1A2E'" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q 'role="grid"' apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q 'aria-label="좌석 배치도"' apps/web/components/booking/seat-map-viewer.tsx`
    - any 금지: helper와 viewer 모두 strict TS — 명시적 타입.
    - 정적 검사:
      - `pnpm --filter @grapit/web typecheck` exit 0
      - `pnpm --filter @grapit/web lint` exit 0
    - 테스트 GREEN (Task 1 범위 — UX-05/06 케이스 + W-2 helper 5 케이스):
      - `pnpm --filter @grapit/web test -- seat-map-viewer prefix-svg-defs-ids --run` exit 0 OR 일부 RED 허용 (Task 2/3 미완료 케이스)
      - 케이스 4 (MiniMap 마운트 분기) PASS
      - 케이스 5 (initialScale 1.4) PASS
      - prefix-svg-defs-ids 5 케이스 모두 PASS (helper는 본 task에서 완성됨)
      - 기존 6 회귀 케이스 PASS
      - **B-3 ReferenceError 0건**: `pnpm --filter @grapit/web test -- seat-map-viewer 2>&1 | grep -c "ReferenceError"` → 0
  </acceptance_criteria>
  <done>
W-2 헬퍼 별도 파일 분리 + named export 완료. seat-map-viewer.tsx에 변경 A/B/E/F 적용 (import + isMobile + TransformWrapper key/initialScale + MiniMap with helper). UX-05/06 케이스 GREEN + helper 5 케이스 GREEN. 기존 6 회귀 케이스 GREEN. typecheck/lint GREEN. Task 2 (STAGE 오버레이 + checkmark attr)로 진행 가능.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 (UX-02 STAGE + UX-04 체크마크 attr): STAGE 오버레이 in-memory (W-1) + 체크마크 data-seat-checkmark/data-fading-out attr useMemo 변경 + pendingRemovals state</name>
  <files>apps/web/components/booking/seat-map-viewer.tsx</files>
  <read_first>
    - apps/web/components/booking/seat-map-viewer.tsx (Task 1 적용 후 — 변경 위치 정확히 식별. 라인 84~131 좌석 분기, 라인 134~146 viewBox 보장 + width/height 제거)
    - apps/web/components/booking/__tests__/seat-map-viewer.test.tsx (Plan 12-00 신규 케이스 3, 6, 7 — Task 2 후 GREEN 전환 대상)
    - apps/web/app/globals.css (Plan 12-01 산출물 — `[data-seat-checkmark]` selector + `[data-seat-checkmark][data-fading-out="true"]` selector + prefers-reduced-motion override 확인)
    - .planning/phases/12-ux/12-PATTERNS.md §"apps/web/components/booking/seat-map-viewer.tsx (component, event-driven)" (line 105~253)
    - .planning/phases/12-ux/12-RESEARCH.md §"Pitfall 3: useMemo 안에서 requestAnimationFrame 호출" (line 508~513) — CSS @keyframes는 mount-time 트리거이므로 dangerouslySetInnerHTML 재생성과 호환
    - .planning/phases/12-ux/12-CONTEXT.md D-07/D-19 (SVG 파일 변경 없음 — W-1)
    - .planning/phases/12-ux/12-UI-SPEC.md §"Interaction & State Contract" (line 235~250) — 선택·해제 둘 다 fade
  </read_first>
  <behavior>
    - 변경 C-2 (D-12 mount fade-in): 선택 좌석 체크마크 `<text>` (라인 109~119)에 `setAttribute('data-seat-checkmark', '')` 한 줄 추가 — CSS @keyframes (mount-time 트리거) 자동 발화
    - 변경 C-3 (B-2-RESIDUAL Option C: 체크마크 fade-out + DOM 잔존 처리): pendingRemovals state 도입. useMemo가 selectedSeatIds 또는 pendingRemovals에 포함된 좌석에 체크마크를 마운트 (selected는 그대로, pendingRemovals는 `data-fading-out="true"` 부여 + fill은 *원래 tier 색*으로 복원하여 transition trigger 준비). 별도 useEffect (selectedSeatIds 변경 감지)가 차집합 계산 → setPendingRemovals + setTimeout 160ms 후 reset.
    - 변경 C-4 (useMemo deps 변경): deps에서 `selectedSeatIds` 제거. 단 *체크마크 mount 위치 결정*에 selectedSeatIds가 필요하므로 selectedSeatIds + pendingRemovals 합집합으로 대체. **결정:** deps는 `[rawSvg, seatStates, tierColorMap, selectedSeatIds, pendingRemovals]`로 유지하되, useMemo 안에서 *fill은 *기본 색상(tier color or LOCKED_COLOR)*만 박아둠* — 즉 isSelected 분기에서도 fill을 primary로 변경하지 않음. fill 변경은 Task 3의 useEffect가 담당.
    - 변경 D (D-07 + W-1): processedSvg useMemo의 viewBox 보장 직후, `removeAttribute('width')` 직전에 STAGE 배지 오버레이 로직 추가 — `<text>STAGE</text>` 부재 + `data-stage` 속성 존재 시 viewBox 변에 `<g>` 오버레이 in-memory 삽입. **중요(W-1): 본 변경은 useMemo 안에서 in-memory `doc`에만 적용 — R2 원본 SVG 파일은 변경 없음 (D-19 호환).**
  </behavior>
  <action>
정확히 다음 변경을 단일 파일에 적용한다 (변경 A/B/E/F는 Task 1에서, 변경 C-1 fill transition useEffect는 Task 3에서).

**변경 C-3 state — 컴포넌트 본문에 pendingRemovals state + useEffect (Task 1에서 추가한 `const isMobile = useIsMobile();` 다음에 추가)**:

```tsx
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);

  // B-2-RESIDUAL Option C: 해제 중인 좌석 추적 — 체크마크 fade-out 150ms 동안 DOM에 잔존
  const prevSelectedRef = useRef<Set<string>>(new Set());
  const [pendingRemovals, setPendingRemovals] = useState<Set<string>>(new Set());

  // selectedSeatIds 변경 감지 → 해제된 좌석 추적 → 160ms 후 reset
  useEffect(() => {
    const prev = prevSelectedRef.current;
    const curr = selectedSeatIds;
    const newlyRemoved = new Set<string>();
    prev.forEach((id) => {
      if (!curr.has(id)) newlyRemoved.add(id);
    });
    if (newlyRemoved.size === 0) {
      prevSelectedRef.current = new Set(curr);
      return;
    }
    setPendingRemovals(newlyRemoved);
    const t = setTimeout(() => {
      setPendingRemovals(new Set());
      prevSelectedRef.current = new Set(curr);
    }, 160);
    return () => clearTimeout(t);
  }, [selectedSeatIds]);
```

**변경 C-2 + 체크마크 attr 변경 — useMemo 좌석 분기 수정**:

기존 라인 82~131 (selected 분기 — 수정 전 코드):
```tsx
      const isSelected = selectedSeatIds.has(seatId);

      if (isSelected && tierInfo) {
        el.setAttribute('fill', tierInfo.color);
        el.setAttribute('stroke', SELECTED_STROKE);
        el.setAttribute('stroke-width', '3');
        el.setAttribute('style', 'cursor:pointer;opacity:1;transition:none');

        // Inject white checkmark centered on seat
        const svgNs = 'http://www.w3.org/2000/svg';
        const checkEl = doc.createElementNS(svgNs, 'text');
        let cx: number | null = null;
        let cy: number | null = null;
        const tagName = el.tagName.toLowerCase();

        if (tagName === 'rect') {
          const rx = parseFloat(el.getAttribute('x') ?? '0');
          const ry = parseFloat(el.getAttribute('y') ?? '0');
          const rw = parseFloat(el.getAttribute('width') ?? '0');
          const rh = parseFloat(el.getAttribute('height') ?? '0');
          cx = rx + rw / 2;
          cy = ry + rh / 2;
        } else if (tagName === 'circle') {
          cx = parseFloat(el.getAttribute('cx') ?? '0');
          cy = parseFloat(el.getAttribute('cy') ?? '0');
        }

        if (cx !== null && cy !== null) {
          checkEl.setAttribute('x', String(cx));
          checkEl.setAttribute('y', String(cy));
          checkEl.setAttribute('text-anchor', 'middle');
          checkEl.setAttribute('dominant-baseline', 'central');
          checkEl.setAttribute('fill', 'white');
          checkEl.setAttribute('font-size', '12');
          checkEl.setAttribute('font-weight', 'bold');
          checkEl.setAttribute('pointer-events', 'none');
          checkEl.textContent = '✓';
          el.parentNode?.insertBefore(checkEl, el.nextSibling);
        }
      } else if (state === 'locked' || state === 'sold') {
        el.setAttribute('fill', LOCKED_COLOR);
        el.removeAttribute('stroke');
        el.setAttribute('stroke-width', '0');
        el.setAttribute('style', 'cursor:not-allowed;opacity:0.6;transition:none');
      } else if (tierInfo) {
        el.setAttribute('fill', tierInfo.color);
        el.removeAttribute('stroke');
        el.setAttribute('stroke-width', '0');
        el.setAttribute('style', 'cursor:pointer;opacity:1;transition:none');
      }
```

변경 후 (수정 후 코드 — Option C 적용: useMemo는 *기본 색상*만 박아두고 fill 변경은 useEffect 위임. 체크마크는 selected OR pendingRemovals에 마운트, pendingRemovals는 `data-fading-out="true"` 부여):
```tsx
      const isSelected = selectedSeatIds.has(seatId);
      const isRemoving = pendingRemovals.has(seatId);
      const showCheckmark = isSelected || isRemoving;

      if (showCheckmark && tierInfo) {
        // B-2-RESIDUAL Option C: useMemo는 *기본 tier 색상*만 박아둠. fill을 primary로 변경하는 것은
        // 별도 useEffect가 담당 (마운트된 동일 element의 속성 변경 → CSS transition 정상 발화).
        // tier 색을 그대로 두면 useEffect가 fill을 primary로 변경할 때 색상 변화가 transition으로 보임.
        // 해제(isRemoving) 시에는 useEffect가 fill을 tier 색으로 복원하는 것이 transition으로 보임.
        el.setAttribute('fill', tierInfo.color);
        el.setAttribute('stroke', SELECTED_STROKE);
        el.setAttribute('stroke-width', '3');
        el.setAttribute('data-tier-id', tierInfo.tierName);
        // transition style은 useEffect가 직접 el.style.transition으로 적용 (Task 3)
        el.setAttribute('style', 'cursor:pointer;opacity:1;');

        // Inject white checkmark centered on seat
        const svgNs = 'http://www.w3.org/2000/svg';
        const checkEl = doc.createElementNS(svgNs, 'text');
        let cx: number | null = null;
        let cy: number | null = null;
        const tagName = el.tagName.toLowerCase();

        if (tagName === 'rect') {
          const rx = parseFloat(el.getAttribute('x') ?? '0');
          const ry = parseFloat(el.getAttribute('y') ?? '0');
          const rw = parseFloat(el.getAttribute('width') ?? '0');
          const rh = parseFloat(el.getAttribute('height') ?? '0');
          cx = rx + rw / 2;
          cy = ry + rh / 2;
        } else if (tagName === 'circle') {
          cx = parseFloat(el.getAttribute('cx') ?? '0');
          cy = parseFloat(el.getAttribute('cy') ?? '0');
        }

        if (cx !== null && cy !== null) {
          checkEl.setAttribute('x', String(cx));
          checkEl.setAttribute('y', String(cy));
          checkEl.setAttribute('text-anchor', 'middle');
          checkEl.setAttribute('dominant-baseline', 'central');
          checkEl.setAttribute('fill', 'white');
          checkEl.setAttribute('font-size', '12');
          checkEl.setAttribute('font-weight', 'bold');
          checkEl.setAttribute('pointer-events', 'none');
          // D-12 mount fade-in: CSS @keyframes (mount-time 트리거)는 dangerouslySetInnerHTML 재생성과 호환
          checkEl.setAttribute('data-seat-checkmark', '');
          // 해제 중: data-fading-out="true" 부여 → CSS @keyframes seat-checkmark-fade-out 자동 발화
          if (isRemoving) {
            checkEl.setAttribute('data-fading-out', 'true');
          }
          checkEl.textContent = '✓';
          el.parentNode?.insertBefore(checkEl, el.nextSibling);
        }
      } else if (state === 'locked' || state === 'sold') {
        el.setAttribute('fill', LOCKED_COLOR);
        el.removeAttribute('stroke');
        el.setAttribute('stroke-width', '0');
        el.setAttribute('style', 'cursor:not-allowed;opacity:0.6;transition:none');
      } else if (tierInfo) {
        el.setAttribute('fill', tierInfo.color);
        el.setAttribute('data-tier-id', tierInfo.tierName);
        el.removeAttribute('stroke');
        el.setAttribute('stroke-width', '0');
        el.setAttribute('style', 'cursor:pointer;opacity:1;transition:none');
      }
```

**변경 useMemo deps — selectedSeatIds 유지 (체크마크 mount 위치 결정에 필요), pendingRemovals 추가**:

기존 라인 147 deps:
```tsx
  }, [rawSvg, seatStates, selectedSeatIds, tierColorMap]);
```

변경 후 (pendingRemovals 추가):
```tsx
  }, [rawSvg, seatStates, selectedSeatIds, tierColorMap, pendingRemovals]);
```

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
- B-2-RESIDUAL Option C 핵심: useMemo는 fill을 *tier color or LOCKED_COLOR* 기본값만 박아둠. selected/isRemoving은 *체크마크 mount* + *data-fading-out 부여* + *style에서 transition 제거 (useEffect가 별도 지정)*만 결정. fill을 primary로 변경하는 것은 *Task 3의 useEffect*가 담당 — 동일 element의 속성 변경이므로 CSS transition 정상 발화.
- **`data-tier-id` 속성**은 Task 3의 useEffect가 fill 복원 시 원본 tier 색상을 알아내기 위한 hint (tierColorMap을 다시 lookup하지 않고도 attribute에서 얻을 수 있음).
- useMemo deps: `[rawSvg, seatStates, selectedSeatIds, tierColorMap, pendingRemovals]` — selectedSeatIds 유지 이유: 체크마크 mount/unmount 분기에 필요. pendingRemovals 추가 이유: 해제 중인 체크마크에 `data-fading-out` 부여 + 150ms 잔존.
- B-2-RESIDUAL setTimeout cleanup: useEffect의 return으로 `clearTimeout(t)` 보장 — 빠른 연속 클릭 시 race condition 방지.
- `processedSvg` useMemo는 string 반환 — string에 `data-fading-out` 속성이 attribute로 직렬화됨. dangerouslySetInnerHTML로 마운트되면 CSS selector 즉시 매칭.
- `useEffect`/`useState` import는 이미 라인 3에 있음 — 별도 추가 불필요.
- 본 task 완료 후: 신규 케이스 3 (data-seat-checkmark), 6 (STAGE 오버레이), 7 (B-2 data-fading-out attr) GREEN 전환. 신규 케이스 1 (transition fill 변경)은 Task 3 후에 GREEN.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && grep -q "'data-seat-checkmark', ''" apps/web/components/booking/seat-map-viewer.tsx && grep -q "data-stage" apps/web/components/booking/seat-map-viewer.tsx && grep -q "pendingRemovals" apps/web/components/booking/seat-map-viewer.tsx && grep -q "data-fading-out" apps/web/components/booking/seat-map-viewer.tsx && grep -q "data-tier-id" apps/web/components/booking/seat-map-viewer.tsx && grep -q "createElementNS" apps/web/components/booking/seat-map-viewer.tsx && grep -q "'STAGE'" apps/web/components/booking/seat-map-viewer.tsx && grep -q "무대 위치" apps/web/components/booking/seat-map-viewer.tsx && grep -q "prevSelectedRef" apps/web/components/booking/seat-map-viewer.tsx && grep -q "setTimeout" apps/web/components/booking/seat-map-viewer.tsx && pnpm --filter @grapit/web typecheck 2>&1 | tail -5 && pnpm --filter @grapit/web lint 2>&1 | tail -5 && pnpm --filter @grapit/web test -- seat-map-viewer --run 2>&1 | tail -50</automated>
  </verify>
  <acceptance_criteria>
    - 변경 C-2 (체크마크 data-seat-checkmark) 검증:
      - `grep -q "'data-seat-checkmark', ''" apps/web/components/booking/seat-map-viewer.tsx`
    - 변경 C-3 (B-2 pendingRemovals state + useEffect) 검증:
      - `grep -q "pendingRemovals" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "data-fading-out" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "prevSelectedRef" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "setTimeout" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "data-tier-id" apps/web/components/booking/seat-map-viewer.tsx` (Task 3 useEffect를 위한 hint)
    - **W-3 useMemo deps 변경 검증** (deps에 pendingRemovals 포함):
      - `awk` 또는 `grep -E -A 2 'rawSvg, seatStates' apps/web/components/booking/seat-map-viewer.tsx | grep -q 'pendingRemovals'`
      - 또는 단순 grep: `grep -E "\\[rawSvg, seatStates, selectedSeatIds, tierColorMap, pendingRemovals\\]" apps/web/components/booking/seat-map-viewer.tsx`
    - **W-3 fill을 primary로 변경하는 코드가 useMemo 안에 *없음* 검증** (fill 변경은 Task 3 useEffect 책임):
      - `! grep -E "el\\.setAttribute\\('fill', 'var\\(--color-primary\\)" apps/web/components/booking/seat-map-viewer.tsx`
      - `! grep -E "primary' \\)" apps/web/components/booking/seat-map-viewer.tsx`
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
    - 테스트 GREEN (Task 2 범위):
      - 신규 케이스 3 (data-seat-checkmark) PASS
      - 신규 케이스 6 (STAGE 오버레이) PASS
      - 신규 케이스 7 (B-2 data-fading-out + DOM 잔존 → 160ms 후 제거) PASS
      - 신규 케이스 1 (transition fill change), 2 (locked transition:none) — Task 3 미완료 시 RED 허용
      - 기존 6 회귀 케이스 PASS
  </acceptance_criteria>
  <done>
seat-map-viewer.tsx에 변경 C-2/C-3/D 적용 (체크마크 data-seat-checkmark + pendingRemovals state/useEffect + STAGE 오버레이 with W-1 in-memory only). useMemo는 *기본 색상 + 체크마크 mount/unmount/data-fading-out*만 결정. fill을 primary로 변경하는 코드 없음 (Task 3 useEffect 책임). 신규 케이스 3, 6, 7 GREEN. 기존 6 회귀 케이스 GREEN. typecheck/lint GREEN. R2 원본 SVG 변경 없음 보장. Task 3 (useEffect fill transition)으로 진행 가능.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3 (UX-04 transition + B-2-RESIDUAL Option C): 별도 useEffect로 마운트 직후 동일 rect element fill 변경 + el.style.transition</name>
  <files>apps/web/components/booking/seat-map-viewer.tsx</files>
  <read_first>
    - apps/web/components/booking/seat-map-viewer.tsx (Task 1+2 적용 후 — TransformComponent 마운트 위치 라인 ~287, processedSvg useMemo 결과를 dangerouslySetInnerHTML로 마운트하는 div containerRef 위치 라인 ~293~301)
    - apps/web/components/booking/__tests__/seat-map-viewer.test.tsx (Plan 12-00 신규 케이스 1 — 갱신된 useEffect 기반 검증)
    - .planning/phases/12-ux/12-RESEARCH.md §"Pitfall 3: useMemo 안에서 requestAnimationFrame 호출" (line 508~513) — 권장 패턴 = useEffect로 직접 DOM 조작
    - .planning/phases/12-ux/12-UI-SPEC.md §"Interaction & State Contract" §L240 — "선택 좌석 rect `fill` transition 150ms ease-out"
  </read_first>
  <behavior>
    - 변경 G (B-2-RESIDUAL Option C): 컴포넌트 본문 (processedSvg useMemo 다음 또는 TransformComponent 마운트 후 적절한 위치)에 신규 useEffect 추가:
      - deps: `[selectedSeatIds, pendingRemovals, tierColorMap, processedSvg]`
      - containerRef.current에서 SVG 찾기 → selectedSeatIds 각 좌석에 fill을 *primary 색* (Brand Purple `#6C3CE0`)으로 변경 + `el.style.transition = 'fill 150ms ease-out'` 부여
      - pendingRemovals 각 좌석에 fill을 *원래 tier 색상*으로 복원 (data-tier-id에서 lookup) + `el.style.transition = 'fill 150ms ease-out'` 유지
      - 마운트된 동일 element의 속성 변경 → CSS transition 정상 발화 (RESEARCH §Pitfall 3 권장 패턴)
  </behavior>
  <action>
**변경 G — 별도 useEffect로 fill transition trigger** (processedSvg useMemo 다음, 라인 147 직후 또는 적절한 위치에 INSERT):

```tsx
  // Pre-process SVG string with colors baked in — survives re-renders
  const processedSvg = useMemo(() => {
    // ... (Task 2에서 정의된 useMemo 본문) ...
  }, [rawSvg, seatStates, selectedSeatIds, tierColorMap, pendingRemovals]);

  // B-2-RESIDUAL Option C: dangerouslySetInnerHTML이 SVG를 재마운트한 *직후* 동일 element의 fill을 변경.
  // useMemo가 outerHTML 전체를 새 string으로 반환하면 React가 자식 DOM을 unmount/remount → 새 rect는 mount 시점부터
  // tier 색이 박혀 *이전→새 값* 변화가 없음 → CSS `transition: fill 150ms` 무효 (RESEARCH §Pitfall 3).
  // 권장 패턴: 마운트 후 useEffect가 *동일 element의 속성*을 변경 → CSS transition 정상 발화.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !processedSvg) return;
    const root = container.querySelector('svg');
    if (!root) return;

    // 선택 좌석: fill을 primary로 변경 + transition 부여
    selectedSeatIds.forEach((seatId) => {
      const el = root.querySelector(`[data-seat-id="${seatId}"]`) as SVGElement | null;
      if (!el) return;
      el.style.transition = 'fill 150ms ease-out, stroke 150ms ease-out';
      el.setAttribute('fill', '#6C3CE0'); // Brand Purple — D-03
    });

    // 해제 중인 좌석: fill을 원래 tier 색상으로 복원 + transition 유지 (체크마크는 이미 data-fading-out으로 fade-out 중)
    pendingRemovals.forEach((seatId) => {
      const el = root.querySelector(`[data-seat-id="${seatId}"]`) as SVGElement | null;
      if (!el) return;
      el.style.transition = 'fill 150ms ease-out, stroke 150ms ease-out';
      // data-tier-id (Task 2 useMemo가 부여) → tierColorMap lookup → 원본 tier 색
      const tierId = el.getAttribute('data-tier-id');
      const tier = tierId ? Array.from(tierColorMap.values()).find((t) => t.tierName === tierId) : null;
      const originalFill = tier?.color ?? LOCKED_COLOR;
      el.setAttribute('fill', originalFill);
    });
  }, [selectedSeatIds, pendingRemovals, tierColorMap, processedSvg]);
```

주의:
- 본 useEffect는 *마운트 후* 실행되므로 dangerouslySetInnerHTML이 새 SVG를 마운트한 직후 동일 element를 query — `el.style.transition` 부여 + `el.setAttribute('fill', ...)` 변경. 두 작업이 *동일 element*에 일어나므로 CSS transition `fill 150ms ease-out`이 정상 발화.
- deps에 `processedSvg` 포함 이유: useMemo가 새 string 반환 → dangerouslySetInnerHTML 재마운트 → useEffect 재실행 → 새 element에 fill 변경 + transition 부여. 첫 마운트 시 transition은 *직전 색 → primary*가 보이지 않을 수 있지만 (mount 시점부터 tier 색이고 직후 useEffect가 primary로 변경 → transition 발화), 사용자 입장에서 "tier → primary 150ms"가 정확히 보임.
- pendingRemovals deps 포함: 해제 시 useEffect 재실행 → 해당 element를 query → fill을 원래 tier 색으로 복원 + transition 발화 → "primary → tier 150ms" 사용자에게 보임.
- `tierColorMap`은 Map<seatId, {tierName, color}> 구조. data-tier-id에서 tierName 얻은 후 Map values를 검색하여 color 찾음. 또는 더 정확하게: useMemo에서 *tierName 대신 seatId*를 data-tier-id에 박아두면 간단. 본 task에서는 *기존 lookup 방식*을 채택 (Task 2가 tierName을 박아둠).
- 단, **단순화**: pendingRemovals 좌석의 원래 색상 복원은 *tierColorMap.get(seatId)?.color*로 직접 lookup이 더 정확. data-tier-id는 추가 hint이지만 not strictly necessary. 둘 중 *tierColorMap.get(seatId)*를 우선 시도하고 fallback으로 LOCKED_COLOR 사용:

수정된 pendingRemovals 분기 (단순화):
```tsx
    pendingRemovals.forEach((seatId) => {
      const el = root.querySelector(`[data-seat-id="${seatId}"]`) as SVGElement | null;
      if (!el) return;
      el.style.transition = 'fill 150ms ease-out, stroke 150ms ease-out';
      const originalFill = tierColorMap.get(seatId)?.color ?? LOCKED_COLOR;
      el.setAttribute('fill', originalFill);
    });
```

- `containerRef.current.querySelector('svg')` — dangerouslySetInnerHTML이 SVG를 자식으로 마운트한 후 첫 svg element 선택. jsdom + 모든 evergreen 브라우저 호환.
- React rules of hooks 준수: useEffect는 컴포넌트 함수 본문에서 호출 (조건부 X).
- `as SVGElement | null` 타입 단언: querySelector는 Element | null 반환. SVG 타입 단언 후 null 가드.
- 단순 fill 변경만으로 충분 — stroke/stroke-width는 useMemo가 이미 부여 (selected: SELECTED_STROKE/3, available: removeAttribute/0). useEffect는 fill만 책임.
- typecheck: tierColorMap.get()의 반환 타입은 `{tierName: string, color: string} | undefined` — optional chaining + fallback 사용.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && grep -E "el\\.style\\.transition\\s*=\\s*'fill 150ms" apps/web/components/booking/seat-map-viewer.tsx && grep -q "useEffect" apps/web/components/booking/seat-map-viewer.tsx && grep -E "useEffect\\(\\(\\)\\s*=>" apps/web/components/booking/seat-map-viewer.tsx | wc -l | awk '{ if ($1 >= 2) exit 0; else exit 1 }' && grep -q "'#6C3CE0'" apps/web/components/booking/seat-map-viewer.tsx && grep -q "containerRef.current" apps/web/components/booking/seat-map-viewer.tsx && pnpm --filter @grapit/web typecheck 2>&1 | tail -5 && pnpm --filter @grapit/web lint 2>&1 | tail -5 && pnpm --filter @grapit/web test -- seat-map-viewer --run 2>&1 | tail -50</automated>
  </verify>
  <acceptance_criteria>
    - 변경 G (B-2-RESIDUAL Option C useEffect) 검증:
      - **useEffect 안 직접 DOM 조작 검증:** `grep -E "el\\.style\\.transition\\s*=\\s*'fill 150ms" apps/web/components/booking/seat-map-viewer.tsx`
      - **신규 useEffect 존재 검증** (총 useEffect 카운트 ≥ 2 — fetch SVG + Task 2 selectedSeatIds 추적 + Task 3 fill transition):
        - `grep -E "useEffect\\(\\(\\)\\s*=>" apps/web/components/booking/seat-map-viewer.tsx | wc -l` → 출력 ≥ 3 (fetch + Task 2 pendingRemovals + Task 3 fill)
      - **Brand Purple 사용:** `grep -q "'#6C3CE0'" apps/web/components/booking/seat-map-viewer.tsx`
      - **containerRef 사용:** `grep -q "containerRef.current" apps/web/components/booking/seat-map-viewer.tsx`
      - **useMemo 안 *transition:fill 150ms* inline style 미존재** (Option C: transition은 useEffect로만 적용):
        - `! grep -E "transition:fill\\s+150ms" apps/web/components/booking/seat-map-viewer.tsx | grep -v "el\\.style\\.transition"`
        - 또는 단순화: `grep -c "transition:fill 150ms ease-out,stroke 150ms ease-out" apps/web/components/booking/seat-map-viewer.tsx` → 0 (이전 inline style 패턴 제거됨)
    - 회귀 가드 (Task 1+2 sentinel 모두 유지):
      - `grep -q "import { TransformWrapper, TransformComponent, MiniMap }" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "key={isMobile ? 'mobile' : 'desktop'}" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "<MiniMap" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "prefixSvgDefsIds" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "'data-seat-checkmark', ''" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "data-fading-out" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "createElementNS" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "'STAGE'" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "LOCKED_COLOR = '#D1D5DB'" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "SELECTED_STROKE = '#1A1A2E'" apps/web/components/booking/seat-map-viewer.tsx`
    - **transition:none 회귀 (D-13)** locked/sold/available 분기 유지:
      - `grep -c "transition:none" apps/web/components/booking/seat-map-viewer.tsx` ≥ 2 (locked/sold + available)
    - any 금지:
      - `! grep -q ": any\\b\\|<any>" apps/web/components/booking/seat-map-viewer.tsx`
    - 정적 검사:
      - `pnpm --filter @grapit/web typecheck` exit 0
      - `pnpm --filter @grapit/web lint` exit 0
    - 테스트 GREEN (Plan 12-00의 12 케이스 모두 — Task 1+2+3 종합):
      - `pnpm --filter @grapit/web test -- seat-map-viewer --run` exit 0
      - 출력에 "12 passed" 또는 ≥11 케이스 PASS 표시 (기존 6 + 신규 6)
      - **신규 케이스 1 (transition fill 변경 useEffect 기반)** PASS — vitest renderer가 마운트 후 useEffect 실행
      - 신규 케이스 2 (locked transition:none) PASS
      - 신규 케이스 3 (data-seat-checkmark) PASS
      - 신규 케이스 4 (MiniMap 마운트) PASS
      - 신규 케이스 5 (initialScale 1.4) PASS
      - 신규 케이스 6 (STAGE 오버레이) PASS
      - 신규 케이스 7 (B-2 data-fading-out + DOM 잔존 → 160ms 후 제거) PASS
      - "FAIL" 또는 "✗" 출력 0건
  </acceptance_criteria>
  <done>
seat-map-viewer.tsx에 변경 G 적용 (별도 useEffect로 마운트 직후 동일 rect element의 fill 변경 + el.style.transition 부여). B-2-RESIDUAL Option C 채택 — useMemo는 기본 색상만, useEffect가 fill transition trigger. RESEARCH §Pitfall 3 권장 패턴 채택. Plan 12-00의 12 케이스(기존 6 회귀 + 신규 6) 모두 GREEN. typecheck/lint GREEN. CSS transition `fill 150ms ease-out`이 정상 발화 — 사용자 시점에 "tier → primary 150ms" + "primary → tier 150ms" fade가 보임.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (변경 없음) | viewer는 R2 fetch + dangerouslySetInnerHTML로 SVG 렌더 — 본 plan은 기존 신뢰 경계 변경 0. admin SVG 검증은 Plan 12-02에서 mitigate 완료. STAGE 오버레이는 in-memory only (W-1) — R2 원본 SVG 파일에 영향 없음. useEffect 안 fill 변경은 selectedSeatIds (React state) → setAttribute로만 적용 — 사용자 입력 직접 주입 없음. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| (해당 없음) | — | — | — | Wave 3는 viewer 시각/상호작용 변경만 — 새 보안 표면 0. dangerouslySetInnerHTML로 R2 SVG 렌더는 기존 패턴이며 본 plan에서 변경 없음. T-12-01 (admin SVG 입력 검증)은 Plan 12-02에서 mitigate 완료. SVG `<defs>` ID 충돌 (RESEARCH §Pitfall 6)은 W-2의 `prefixSvgDefsIds` 헬퍼(별도 파일 분리 + 단위 테스트 5건)로 외부 admin SVG 케이스 mitigate. |
</threat_model>

<verification>
- [ ] Task 1: W-2 helper 파일 분리 + 변경 A/B/E/F 적용 — UX-05/06 케이스 GREEN + helper 5 케이스 GREEN
- [ ] Task 2: 변경 C-2/C-3/D 적용 (체크마크 attr + pendingRemovals state + STAGE 오버레이 in-memory) — 신규 케이스 3, 6, 7 GREEN
- [ ] Task 3: 변경 G 적용 (별도 useEffect로 fill transition trigger — B-2-RESIDUAL Option C) — 신규 케이스 1 GREEN
- [ ] 기존 6 회귀 케이스 GREEN 유지 (available/locked/click/sold-skip/selected stroke/error)
- [ ] 신규 6 케이스 GREEN (transition useEffect / data-seat-checkmark / MiniMap 마운트 분기 / initialScale 1.4 / STAGE 오버레이 / B-2 data-fading-out)
- [ ] `pnpm --filter @grapit/web typecheck` GREEN
- [ ] `pnpm --filter @grapit/web lint` GREEN
- [ ] LOCKED_COLOR / SELECTED_STROKE / role="grid" / aria-label="좌석 배치도" sentinel 회귀 0
- [ ] `transition:none`이 locked/sold/available 분기에 모두 유지 (D-13 회귀 방지)
- [ ] W-1: STAGE 오버레이가 in-memory `doc`에만 적용 — R2 원본 SVG 파일 변경 0
- [ ] W-2: `prefixSvgDefsIds` 헬퍼가 별도 파일 + named export + 단위 테스트 5건 GREEN
- [ ] **B-2-RESIDUAL: useMemo 안 transition:fill 150ms inline style 미존재 + useEffect 안 el.style.transition = 'fill 150ms' 존재**
</verification>

<success_criteria>
- 자동: 위 verification 12개 항목 모두 충족
- Plan 12-04 manual QA gate에서 검증할 시각 행위:
  - 좌석 클릭 시 rect fill이 tier color → primary로 부드럽게 fade (150ms) — *transition이 사용자에게 시각적으로 보임* (B-2-RESIDUAL Option C 핵심 검증)
  - 좌석 클릭 시 체크마크 fade-in 부드럽게 (150ms)
  - 좌석 해제 시 rect fill이 primary → tier color로 부드럽게 fade (150ms)
  - 좌석 해제 시 체크마크 fade-out 부드럽게 (150ms 후 DOM 제거 — UI-SPEC §Interaction)
  - 데스크톱 미니맵 좌상단 표시 + zoom/pan 시 viewport rect 동기 갱신
  - 모바일 디바이스에서 좌석 터치 폭 ≥ 44px (WCAG 2.5.5)
  - prefers-reduced-motion 켜기 시 체크마크 fade-in/fade-out 모두 즉시 (0.01ms)
  - 다른 사용자 좌석 잠금 broadcast 시 fade 없이 즉시 회색 전환 (D-13)
</success_criteria>

<output>
After completion, create `.planning/phases/12-ux/12-03-SUMMARY.md`:
- Task 1 변경 (W-2 helper 분리 + import / hook 호출 / TransformWrapper / MiniMap with helper) 파일 라인 인용
- Task 2 변경 (체크마크 attr / pendingRemovals state / STAGE 오버레이 with W-1 in-memory) 파일 라인 인용
- Task 3 변경 (B-2-RESIDUAL Option C useEffect — fill transition trigger) 파일 라인 인용
- 12 케이스 모두 GREEN 증거 (vitest 출력)
- W-2 helper 5 케이스 GREEN 증거
- typecheck/lint 결과
- B-2-RESIDUAL Option C 채택 증거 (useMemo 안 fill primary 변경 0 + useEffect 안 el.style.transition + el.setAttribute 존재)
- W-1 (STAGE in-memory only) + W-2 (helper 별도 파일) 적용 증거
- Plan 12-04 manual QA에서 검증할 시각 행위 리스트 (rect fill transition + checkmark fade-in/out)
</output>
</content>
</invoke>