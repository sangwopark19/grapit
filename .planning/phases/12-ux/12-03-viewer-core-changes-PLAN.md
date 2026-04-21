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
    - "선택 시 rect fill이 tier→primary로 fill 150ms transition으로 사용자에게 시각적으로 보임 (B-2-RESIDUAL-V2 Option C: useMemo는 기본 색상만, 별도 useEffect가 dangerouslySetInnerHTML 마운트 직후 동일 DOM element의 fill 속성을 변경)"
    - "선택 시 체크마크 opacity 0→1 fade-in 150ms은 useMemo 안에서 `data-seat-checkmark` 부여 → CSS @keyframes (mount-time 트리거)로 자동 작동"
    - "해제 시 체크마크에 `data-fading-out=\"true\"` 부여 → CSS @keyframes seat-checkmark-fade-out 150ms 후 다음 useMemo 사이클에 DOM 제거"
    - "B-2-RESIDUAL-V2 (reviews revision HIGH #1): per-seat timeout Map (`useRef<Map<string, number>>`)으로 재설계 — 빠른 해제→재선택 시 해당 seatId의 기존 timeoutId를 clearTimeout + Map에서 delete + pendingRemovals set에서 즉시 remove. `prevSelectedRef.current`는 diff 계산 직후 동기 갱신하여 stuck `data-fading-out` 방지"
    - "D-13 BROADCAST PRIORITY (reviews revision MED #4): fill useEffect는 각 seatId에 대해 `seatStates.get(seatId)`를 먼저 체크하여 `'locked'` 또는 `'sold'`이면 primary 색 변경을 skip + transition 스킵. LOCKED_COLOR 유지 + `transition:none` 유지가 broadcast 즉시 플립 정책(D-13)을 준수"
    - "locked/sold/available 좌석은 `transition:none` 유지 (D-13 회귀 방지) — 실시간 broadcast 좌석 변화는 즉시 플립"
    - "UNIFIED PARSING CONTRACT (reviews revision HIGH #2): viewer의 STAGE 오버레이 판정은 `doc.querySelector('[data-stage]')`로 root+descendant 모두 탐색하여 admin 검증 계약과 일치. 읽은 값은 `top|right|bottom|left` enum이 아니면 default `top` fallback (admin 단계에서 걸러진다는 전제). viewBox 파싱은 `split(/[\\s,]+/)` + `[minX, minY, width, height]` 모두 사용하여 음수 min 좌표 SVG도 정확히 배치"
    - "SVG에 `<text>STAGE</text>` 또는 시각 요소가 있으면 viewer no-op (idempotent), `data-stage`만 있으면 in-memory processedSvg에 variable-side STAGE 배지 `<g>` 오버레이 추가 (W-1: R2 원본 SVG 파일 불변, D-19 호환)"
    - "데스크톱(useIsMobile=false) viewer에 react-zoom-pan-pinch 내장 MiniMap 컴포넌트가 마운트, 모바일에서는 미마운트 (D-15/D-16). MiniMap children은 `prefixSvgDefsIds` 헬퍼로 `<defs>` ID 접두사 처리 (W-2)"
    - "TransformWrapper에 `key={isMobile ? 'mobile' : 'desktop'}` + `initialScale={isMobile ? 1.4 : 1}` 적용 — 모바일 first paint 시 좌석 32px × 1.4 = 44.8px 보장 (WCAG 2.5.5)"
    - "Plan 12-00의 seat-map-viewer.test.tsx 신규 10 케이스 + prefix-svg-defs-ids.test.ts 5 케이스 모두 GREEN, 기존 6 회귀 케이스 GREEN 유지"
  artifacts:
    - path: "apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts"
      provides: "W-2: SVG <defs> ID 충돌 방지 헬퍼 — 단위 테스트 가능한 별도 파일 + named export"
      contains: "export function prefixSvgDefsIds(svgString: string, prefix: string): string"
    - path: "apps/web/components/booking/seat-map-viewer.tsx"
      provides: "UX-02 viewer STAGE 배지(in-memory + unified parsing) + UX-04 선택 좌석 transition (B-2-RESIDUAL-V2 Option C + D-13 priority) + 체크마크 fade-in/out attr (race-safe per-seat timeout Map) + UX-05 MiniMap + UX-06 모바일 initialScale 분기"
      contains: "MiniMap, useIsMobile, data-seat-checkmark, data-fading-out, initialScale: isMobile ? 1.4 : 1, key={isMobile, pendingRemovals, useEffect with selectedSeatIds, el.style.transition = 'fill 150ms ease-out', el.setAttribute('fill', ...), timeoutsRef, querySelector('[data-stage]'), VALID_STAGES"
  key_links:
    - from: "apps/web/components/booking/seat-map-viewer.tsx (체크마크 <text>)"
      to: "apps/web/app/globals.css [data-seat-checkmark] + [data-seat-checkmark][data-fading-out=\"true\"] CSS @keyframes (Plan 12-01)"
      via: "useMemo: checkEl.setAttribute('data-seat-checkmark', '') + setAttribute('data-fading-out', 'true') → CSS @keyframes mount-time 트리거"
      pattern: "data-seat-checkmark.*data-fading-out"
    - from: "apps/web/components/booking/seat-map-viewer.tsx (fill useEffect)"
      to: "마운트된 SVG의 동일 rect element (dangerouslySetInnerHTML 마운트 후)"
      via: "useEffect → containerRef.current.querySelector(`[data-seat-id=...]`) → el.style.transition + el.setAttribute('fill', ...) → CSS transition이 속성 변경에서 정상 발화"
      pattern: "el\\.style\\.transition.*fill 150ms"
    - from: "apps/web/components/booking/seat-map-viewer.tsx (fill useEffect D-13 priority)"
      to: "reviews revision MED #4 broadcast priority"
      via: "useEffect 안 seatStates.get(seatId) === 'locked' || 'sold' → skip primary fill 변경"
      pattern: "seatStates\\.get\\("
    - from: "apps/web/components/booking/seat-map-viewer.tsx (pendingRemovals per-seat timeout Map)"
      to: "reviews revision HIGH #1 race guard"
      via: "useRef<Map<string, number>> (timeoutsRef) → rapid reselect 시 clearTimeout + Map.delete + pendingRemovals.delete + prevSelectedRef 동기 갱신"
      pattern: "timeoutsRef|clearTimeout.*timeoutsRef"
    - from: "apps/web/components/booking/seat-map-viewer.tsx (STAGE 오버레이 parsing)"
      to: "reviews revision HIGH #2 unified parsing contract"
      via: "doc.querySelector('[data-stage]') (root+descendant) + VALID_STAGES enum + viewBox split(/[\\s,]+/) + [minX,minY,width,height]"
      pattern: "querySelector..\\[data-stage\\]..*VALID_STAGES"
    - from: "apps/web/components/booking/seat-map-viewer.tsx (TransformWrapper props)"
      to: "apps/web/hooks/use-is-mobile.ts (Plan 12-02)"
      via: "import { useIsMobile } + const isMobile = useIsMobile()"
      pattern: "import.*useIsMobile.*hooks/use-is-mobile"
    - from: "apps/web/components/booking/seat-map-viewer.tsx (MiniMap 마운트)"
      to: "react-zoom-pan-pinch 내장 MiniMap export + apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts (W-2)"
      via: "import { TransformWrapper, TransformComponent, MiniMap } from 'react-zoom-pan-pinch' + import { prefixSvgDefsIds } from './__utils__/prefix-svg-defs-ids'"
      pattern: "MiniMap.*from.*react-zoom-pan-pinch"
---

<objective>
Wave 3 — Viewer 핵심 변경 (reviews revision 적용).

`apps/web/components/booking/seat-map-viewer.tsx` 단일 파일에 UX-05/06 (import + isMobile + TransformWrapper key/initialScale + MiniMap with helper) + UX-02/04 (STAGE 오버레이 with unified parsing + 선택 좌석 transition with D-13 priority + 체크마크 fade-in/out with race-safe per-seat timeout Map) 변경을 적용한다. 추가로 W-2 헬퍼는 별도 파일(`apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts`)로 분리.

**3개 task 분리 (기존 I-1 구조 유지):**
- **Task 1 (UX-05/06):** W-2 헬퍼 파일 신규 + import + isMobile hook + TransformWrapper key/initialScale + MiniMap (with helper import). helper JSDoc에 `url(#id)`만 커버하고 `href`/`xlink:href`는 미커버하는 coverage 제한 명시 (reviews revision LOW #6).
- **Task 2 (UX-02 STAGE + 체크마크 attr + pendingRemovals race-safe):** unified parsing contract 적용 (`doc.querySelector('[data-stage]')` + VALID_STAGES enum + viewBox min-x/min-y 반영) + 체크마크 `data-seat-checkmark`/`data-fading-out` attr useMemo 변경 + **per-seat timeout Map (`useRef<Map<string, number>>`) 재설계** (reviews revision HIGH #1).
- **Task 3 (UX-04 transition + B-2-RESIDUAL-V2 Option C + D-13 priority):** 별도 useEffect — `el.style.transition = 'fill 150ms ease-out'` + `el.setAttribute('fill', ...)`. **seatStates.get(seatId) === 'locked' | 'sold' 체크로 primary 색 skip** (reviews revision MED #4 D-13 BROADCAST PRIORITY).

세 task는 동일 파일을 수정하므로 직렬 실행. 각 task는 자체 GREEN 검증 게이트 보유.

Plan 12-00에서 작성된 회귀 6건 + 신규 10 케이스 + helper 5 케이스 = 21개 모두 GREEN으로 전환.

Purpose:
- D-07 (스테이지 방향 시각화) + D-06/D-07 UNIFIED PARSING CONTRACT (reviews revision)
- D-11/D-12 (선택 애니메이션) + D-13/D-13 CLARIFICATION (broadcast priority)
- D-14/D-15/D-16 (미니맵) + D-17/D-18 (모바일 자동 1.4x 줌)
- B-2-RESIDUAL-V2 Option C: useEffect 기반 fill transition 정상 발화
- race-safe per-seat timeout Map으로 rapid reselect stuck data-fading-out 방지
- W-1 STAGE 배지 in-memory only (R2 SVG 파일 불변)
- W-2 헬퍼 별도 파일 분리 (coverage 제한 문서화)

Output:
- `apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts` 신규 파일 (~40줄, named export + JSDoc coverage 제한 명시)
- `apps/web/components/booking/seat-map-viewer.tsx` 단일 파일에 변경 (~140~160줄 추가/수정)
- Plan 12-00의 seat-map-viewer.test.tsx 신규 10 케이스 GREEN
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
@.planning/phases/12-ux/12-REVIEWS.md
@apps/web/components/booking/seat-map-viewer.tsx
@apps/web/components/booking/__tests__/seat-map-viewer.test.tsx
@apps/web/hooks/use-is-mobile.ts
@apps/web/app/globals.css
@apps/web/public/seed/sample-seat-map.svg

<interfaces>
<!-- 본 plan이 의존하는 contract — Plan 12-01/12-02에서 제공됨 -->

CSS contract (Plan 12-01 globals.css):
- `[data-seat-checkmark] { animation: seat-checkmark-fade-in 150ms ease-out forwards; }` 정의
- `[data-seat-checkmark][data-fading-out="true"] { animation: seat-checkmark-fade-out 150ms ease-out forwards; }` 정의
- `@media (prefers-reduced-motion: reduce) { ... animation-duration: 0.01ms; ... }` 정의
- 본 plan의 Task 2가 체크마크 `<text>` 요소에 attr 추가 — 별도 CSS 작성 불필요

Hook contract (Plan 12-02 use-is-mobile.ts):
- `import { useIsMobile } from '@/hooks/use-is-mobile';`
- `const isMobile = useIsMobile();` 호출 시 boolean 반환

Library contract (react-zoom-pan-pinch 3.7.0):
- `import { TransformWrapper, TransformComponent, MiniMap } from 'react-zoom-pan-pinch';`
- `TransformWrapper` `initialScale` prop은 mount 시 1회만 평가 — `key` prop으로 강제 재마운트

**reviews revision: D-06/D-07 UNIFIED PARSING CONTRACT:**
- admin (Plan 12-02) + viewer (본 plan) 모두 `doc.querySelector('[data-stage]')`로 root+descendant 탐색
- enum은 `top|right|bottom|left`만 허용 — admin에서 거부, viewer는 fallback top

**reviews revision: D-13 BROADCAST PRIORITY:**
- 선택 좌석이 broadcast로 locked/sold 전환 시 fill useEffect는 primary 색 skip + transition 스킵

**reviews revision: per-seat timeout Map (B-2-RESIDUAL-V2):**
- `useRef<Map<string, number>>` — seatId별 timeoutId tracking
- rapid reselect 시 기존 timeout `clearTimeout` + Map.delete + pendingRemovals.delete 동기 실행
- `prevSelectedRef.current` diff 계산 직후 동기 갱신 (기존 setTimeout 콜백 안 갱신 제거)
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
    - .planning/phases/12-ux/12-RESEARCH.md §"Open Questions Q3: <defs> ID 충돌 방어" (line 950~953)
    - .planning/phases/12-ux/12-CONTEXT.md D-14/D-14 IMPLEMENTATION NOTE/D-15/D-16/D-17/D-18
    - .planning/phases/12-ux/12-UI-SPEC.md §"Layout Contract / 좌석맵 뷰어" (line 190~217)
    - **.planning/phases/12-ux/12-REVIEWS.md §"Action Items" LOW #6** — `url(#id)`만 커버하고 `href`/`xlink:href` 미커버 명시 rationale
  </read_first>
  <behavior>
    - 변경 0 (W-2 helper): `apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts` 신규 — `prefixSvgDefsIds` named export. `<defs>` 가드 / DOMParser parse / id 매핑 / url(#) 일괄 치환 / try-catch graceful fallback. **JSDoc에 reviews revision LOW #6 coverage 제한 명시**: `url(#id)`만 치환하며 `href="#id"` / `xlink:href="#id"`는 커버하지 않음.
    - 변경 A (imports): `MiniMap`, `useIsMobile`, `prefixSvgDefsIds` import 추가
    - 변경 B (hook 호출): `const isMobile = useIsMobile();` 한 줄 추가
    - 변경 E: TransformWrapper `key={isMobile ? 'mobile' : 'desktop'}` + `initialScale={isMobile ? 1.4 : 1}`
    - 변경 F: `<SeatMapControls />` 다음에 데스크톱 전용 MiniMap 마운트. children SVG는 `prefixSvgDefsIds(processedSvg, 'mini-')` 호출
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
 * ## Coverage 제한 (reviews revision 2026-04-21 LOW #6)
 *
 * **현재 커버 (MVP 범위):**
 * - `fill="url(#id)"` / `stroke="url(#id)"` — gradient/pattern 참조
 * - CSS-style url("#id") / url('#id') — 사용 빈도는 낮지만 escape-safe
 *
 * **현재 미커버 (MVP out of scope):**
 * - `<use href="#id">` — SVG 2.0 표준 href
 * - `<use xlink:href="#id">` — 레거시 xlink 네임스페이스
 * - `<textPath href="#id">`, `<mpath href="#id">` 등 path reference
 *
 * **Why MVP 수용:** 현재 `sample-seat-map.svg` 및 어드민 업로드 테스트 SVG 모두 `<use>`/`href` 참조를 사용하지 않음.
 * `<defs>` + `url(#id)` 조합만 사용되는 단순 좌석맵에는 충분하다. 향후 `<use>`를 사용하는 SVG가 도입되면
 * 이 헬퍼의 정규식을 `(url\\(#id\\)|href="#id"|xlink:href="#id")` 식으로 확장해야 한다.
 *
 * @param svgString - SVG outerHTML string
 * @param prefix - ID에 부여할 접두사 (e.g., 'mini-')
 * @returns prefix가 부여된 SVG outerHTML string. <defs> 없거나 ID 없으면 원본 그대로.
 *
 * @see .planning/phases/12-ux/12-REVIEWS.md §"Action Items" LOW #6
 */
export function prefixSvgDefsIds(svgString: string, prefix: string): string {
  if (!svgString.includes('<defs')) return svgString;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
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

**변경 B — useIsMobile 호출**:

기존 라인 30 (containerRef 선언) 직전에 한 줄 추가:
```tsx
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
```

**변경 E — TransformWrapper key + initialScale 모바일 분기**:

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

**변경 F — MiniMap 마운트**:

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
- W-2 헬퍼는 별도 파일이며 named export. 단위 테스트는 Plan 12-00 Task 4가 dynamic import로 작성.
- **reviews revision LOW #6 coverage 제한**: JSDoc에 `url(#id)`만 커버하고 `href`/`xlink:href` 미커버하는 이유 + 미래 확장 경로 명시.
- `aria-label="좌석 미니맵"` — UI-SPEC §"Copywriting Contract" 명시.
- `borderColor="#6C3CE0"` — D-03 Brand Purple.
- `{!isMobile && ...}`이 D-16(모바일 숨김) 충족.
- `useIsMobile()` 호출 위치는 컴포넌트 함수 본문 진입부.
- 본 task에서는 변경 C/D (STAGE 오버레이 + 체크마크 attr + transition)는 적용하지 않음 — Task 2/3 게이트.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && test -f apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts && grep -q "export function prefixSvgDefsIds" apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts && grep -q "LOW #6" apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts && grep -q "href=\"#id\"" apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts && grep -q "import { TransformWrapper, TransformComponent, MiniMap } from 'react-zoom-pan-pinch';" apps/web/components/booking/seat-map-viewer.tsx && grep -q "import { useIsMobile } from '@/hooks/use-is-mobile';" apps/web/components/booking/seat-map-viewer.tsx && grep -q "import { prefixSvgDefsIds } from './__utils__/prefix-svg-defs-ids';" apps/web/components/booking/seat-map-viewer.tsx && grep -q "const isMobile = useIsMobile();" apps/web/components/booking/seat-map-viewer.tsx && grep -q "key={isMobile ? 'mobile' : 'desktop'}" apps/web/components/booking/seat-map-viewer.tsx && grep -q "initialScale={isMobile ? 1.4 : 1}" apps/web/components/booking/seat-map-viewer.tsx && grep -q "<MiniMap" apps/web/components/booking/seat-map-viewer.tsx && grep -q 'borderColor="#6C3CE0"' apps/web/components/booking/seat-map-viewer.tsx && grep -q "좌석 미니맵" apps/web/components/booking/seat-map-viewer.tsx && grep -q "prefixSvgDefsIds(processedSvg, 'mini-')" apps/web/components/booking/seat-map-viewer.tsx && pnpm --filter @grapit/web typecheck 2>&1 | tail -5 && pnpm --filter @grapit/web lint 2>&1 | tail -5 && pnpm --filter @grapit/web test -- seat-map-viewer prefix-svg-defs-ids --run 2>&1 | tail -50</automated>
  </verify>
  <acceptance_criteria>
    - W-2 helper 파일 검증:
      - `test -f apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts`
      - `grep -q "export function prefixSvgDefsIds" apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts`
      - `grep -q "DOMParser" apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts`
      - `grep -q "XMLSerializer" apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts`
      - `grep -q "parsererror" apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts`
    - **reviews revision LOW #6 JSDoc coverage 제한 명시:**
      - `grep -q "LOW #6" apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts`
      - `grep -q "href=\"#id\"" apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts`
      - `grep -q "xlink:href" apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts`
    - import 라인 검증:
      - `grep -q "import { TransformWrapper, TransformComponent, MiniMap } from 'react-zoom-pan-pinch';" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "import { useIsMobile } from '@/hooks/use-is-mobile';" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "import { prefixSvgDefsIds } from './__utils__/prefix-svg-defs-ids';" apps/web/components/booking/seat-map-viewer.tsx`
    - hook 호출 + TransformWrapper + MiniMap 검증:
      - `grep -q "const isMobile = useIsMobile();" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "key={isMobile ? 'mobile' : 'desktop'}" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "initialScale={isMobile ? 1.4 : 1}" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "{!isMobile && (" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "<MiniMap" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q 'width={120}' apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q 'borderColor="#6C3CE0"' apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "absolute top-3 left-3 z-40" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "좌석 미니맵" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "prefixSvgDefsIds(processedSvg, 'mini-')" apps/web/components/booking/seat-map-viewer.tsx`
    - 회귀 가드:
      - `grep -q "LOCKED_COLOR = '#D1D5DB'" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "SELECTED_STROKE = '#1A1A2E'" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q 'role="grid"' apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q 'aria-label="좌석 배치도"' apps/web/components/booking/seat-map-viewer.tsx`
    - any 금지
    - 정적 검사:
      - `pnpm --filter @grapit/web typecheck` exit 0
      - `pnpm --filter @grapit/web lint` exit 0
    - 테스트 GREEN (Task 1 범위):
      - 케이스 4 (MiniMap 마운트 분기) PASS
      - 케이스 5 (initialScale 1.4) PASS
      - prefix-svg-defs-ids 5 케이스 모두 PASS
      - 기존 6 회귀 케이스 PASS
      - **B-3 ReferenceError 0건**
  </acceptance_criteria>
  <done>
W-2 헬퍼 별도 파일 분리 + named export 완료 + reviews revision LOW #6 coverage 제한 JSDoc 명시. seat-map-viewer.tsx에 변경 A/B/E/F 적용. UX-05/06 케이스 GREEN + helper 5 케이스 GREEN. 기존 6 회귀 케이스 GREEN. typecheck/lint GREEN. Task 2로 진행 가능.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 (UX-02 STAGE + UX-04 체크마크 attr + B-2-RESIDUAL-V2 race-safe): unified parsing contract + per-seat timeout Map 재설계 + viewBox min-x/min-y + 체크마크 attr</name>
  <files>apps/web/components/booking/seat-map-viewer.tsx</files>
  <read_first>
    - apps/web/components/booking/seat-map-viewer.tsx (Task 1 적용 후 — 라인 84~131 좌석 분기, 라인 134~146 viewBox 보장)
    - apps/web/components/booking/__tests__/seat-map-viewer.test.tsx (Plan 12-00 신규 케이스 3, 6, 7, 8, 9 — Task 2 후 GREEN 전환 대상)
    - apps/web/app/globals.css (Plan 12-01 산출물 — 셀렉터 확인)
    - .planning/phases/12-ux/12-PATTERNS.md §"apps/web/components/booking/seat-map-viewer.tsx (component, event-driven)" (line 105~253)
    - .planning/phases/12-ux/12-RESEARCH.md §"Pitfall 3: useMemo 안에서 requestAnimationFrame 호출" (line 508~513)
    - .planning/phases/12-ux/12-CONTEXT.md D-06/D-07 UNIFIED PARSING CONTRACT (reviews revision), D-07/D-19 (in-memory only)
    - .planning/phases/12-ux/12-UI-SPEC.md §"Interaction & State Contract" (line 235~250) — 선택·해제 둘 다 fade
    - **.planning/phases/12-ux/12-REVIEWS.md §"Action Items" HIGH #1 (per-seat timeout Map 재설계) + HIGH #2 (unified parsing + viewBox min-x/min-y) + LOW #8 (viewBox parsing)**
  </read_first>
  <behavior>
    - **변경 C-2 (D-12 mount fade-in):** 선택 좌석 체크마크 `<text>`에 `setAttribute('data-seat-checkmark', '')` 추가 — CSS @keyframes 자동 발화
    - **변경 C-3 (B-2-RESIDUAL-V2 race-safe — reviews revision HIGH #1):** `useRef<Map<string, number>>` (timeoutsRef) 도입. `[prevSelected - currentSelected]` 차집합 → 해제된 좌석마다:
      1. 이미 pendingRemovals에 있고 해당 seatId의 timeout이 Map에 있다면 `clearTimeout` + Map.delete (race guard)
      2. 개별 `setTimeout` 150ms 등록 + Map에 기록 + pendingRemovals set에 add
      3. timeout callback 안에서 pendingRemovals.delete(seatId) + Map.delete(seatId) (개별 단위)
    - `[currentSelected - prevSelected]` 차집합 (재선택) → 해당 seatId가 pendingRemovals에 있다면:
      1. `clearTimeout(timeoutsRef.current.get(seatId))` + Map.delete
      2. pendingRemovals.delete(seatId)
    - `prevSelectedRef.current = new Set(currentSelected)` diff 계산 **직후** 동기 갱신
    - **변경 D (D-07 + W-1 + reviews revision HIGH #2 + LOW #8):** processedSvg useMemo에서:
      1. `doc.querySelector('[data-stage]')`로 root+descendant 모두 탐색 (unified parsing contract)
      2. 읽은 값이 `VALID_STAGES` enum(`top|right|bottom|left`) 중 하나가 아니면 default `top` fallback
      3. viewBox 파싱은 `split(/[\s,]+/)` + `[minX, minY, width, height]` 모두 사용하여 음수 min 좌표에서도 정확히 배치
    - **W-1: 본 변경은 useMemo 안에서 in-memory `doc`에만 적용 — R2 원본 SVG 파일은 변경 없음 (D-19 호환).**
  </behavior>
  <action>
**변경 C-3 state/ref — 컴포넌트 본문에 per-seat timeout Map 도입**:

Task 1에서 추가한 `const isMobile = useIsMobile();` 다음에 다음 state/ref/useEffect 추가:

```tsx
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);

  // reviews revision HIGH #1: per-seat timeout Map — rapid reselect race guard
  const prevSelectedRef = useRef<Set<string>>(new Set());
  const timeoutsRef = useRef<Map<string, number>>(new Map());
  const [pendingRemovals, setPendingRemovals] = useState<Set<string>>(new Set());

  // selectedSeatIds 변경 감지 → 해제/재선택 per-seat 처리
  useEffect(() => {
    const prev = prevSelectedRef.current;
    const curr = selectedSeatIds;

    // 재선택: curr에 있고 prev에 없고 pendingRemovals에 있는 seat → 기존 timeout clear + pending 제거
    curr.forEach((id) => {
      if (!prev.has(id)) {
        // 이 seat가 이전에 해제 중(pending)이었다면 즉시 취소
        const existing = timeoutsRef.current.get(id);
        if (existing !== undefined) {
          clearTimeout(existing);
          timeoutsRef.current.delete(id);
        }
        if (pendingRemovals.has(id)) {
          setPendingRemovals((prevSet) => {
            const next = new Set(prevSet);
            next.delete(id);
            return next;
          });
        }
      }
    });

    // 해제: prev에 있고 curr에 없는 seat → per-seat setTimeout 150ms 등록
    prev.forEach((id) => {
      if (!curr.has(id)) {
        // 이미 pending이고 timeout이 존재하면 그대로 두기 (중복 등록 방지)
        if (timeoutsRef.current.has(id)) return;
        // pending에 추가
        setPendingRemovals((prevSet) => {
          const next = new Set(prevSet);
          next.add(id);
          return next;
        });
        const tid = window.setTimeout(() => {
          setPendingRemovals((prevSet) => {
            const next = new Set(prevSet);
            next.delete(id);
            return next;
          });
          timeoutsRef.current.delete(id);
        }, 150);
        timeoutsRef.current.set(id, tid);
      }
    });

    // prevSelectedRef 동기 갱신 (diff 계산 직후)
    prevSelectedRef.current = new Set(curr);

    // cleanup: 컴포넌트 unmount 시 모든 timeout 해제
    return () => {
      // 참고: 개별 timeout cleanup은 위 timeout callback에서 Map.delete 책임.
      // 컴포넌트 unmount 시에만 전체 clear.
    };
  }, [selectedSeatIds, pendingRemovals]);

  // 컴포넌트 unmount 시 남은 timeout 전부 clear
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((tid) => clearTimeout(tid));
      timeoutsRef.current.clear();
    };
  }, []);
```

주의:
- **reviews revision HIGH #1 핵심 설계:**
  1. Map<seatId, timeoutId>로 per-seat tracking → 동시에 여러 좌석 해제되어도 각 타임아웃 독립
  2. 재선택 감지 시 `clearTimeout` + Map.delete + `setPendingRemovals` 동기 호출로 stuck `data-fading-out` 방지
  3. `prevSelectedRef.current = new Set(curr)`는 useEffect 본문 끝에서 동기 실행 — 기존 plan에서 setTimeout callback 안에서 갱신하던 timing 제거
- `window.setTimeout` 반환값은 browser에서 `number` 타입이므로 Map value 타입 `number`로 선언.
- useEffect deps에 `pendingRemovals` 포함 이유: `pendingRemovals.has(id)` 체크가 재선택 분기에서 필요. 다만 이로 인해 useEffect가 너무 자주 실행될 수 있음 — 이 경우 `pendingRemovals`를 deps에서 빼고 대신 `pendingRemovals` 참조를 `pendingRemovalsRef`로 래핑하는 것도 대안. MVP는 단순성 우선으로 deps 포함.
- 단, 무한 루프 방지: useEffect가 setPendingRemovals 호출 → deps 변화 → 재실행 → 하지만 재실행 시 curr/prev 차이가 없으면 조건문이 모두 false로 떨어져 no-op. 무한 루프 없음.

**변경 C-2 — useMemo 안 좌석 분기 수정 (체크마크 attr 추가)**:

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
        // ... 체크마크 attr 설정 ...
        checkEl.textContent = '✓';
        el.parentNode?.insertBefore(checkEl, el.nextSibling);
      } else if (state === 'locked' || state === 'sold') { ... }
      else if (tierInfo) { ... }
```

변경 후:
```tsx
      const isSelected = selectedSeatIds.has(seatId);
      const isRemoving = pendingRemovals.has(seatId);
      const showCheckmark = isSelected || isRemoving;

      if (showCheckmark && tierInfo) {
        // B-2-RESIDUAL-V2 Option C: useMemo는 *기본 tier 색상*만. fill primary 변경은 Task 3 useEffect.
        el.setAttribute('fill', tierInfo.color);
        el.setAttribute('stroke', SELECTED_STROKE);
        el.setAttribute('stroke-width', '3');
        el.setAttribute('data-tier-id', tierInfo.tierName);
        el.setAttribute('style', 'cursor:pointer;opacity:1;');

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
          // D-12 mount fade-in
          checkEl.setAttribute('data-seat-checkmark', '');
          // 해제 중: data-fading-out="true" 부여
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

**변경 useMemo deps — pendingRemovals 추가**:

기존 라인 147 deps:
```tsx
  }, [rawSvg, seatStates, selectedSeatIds, tierColorMap]);
```

변경 후:
```tsx
  }, [rawSvg, seatStates, selectedSeatIds, tierColorMap, pendingRemovals]);
```

**변경 D (reviews revision HIGH #2 + LOW #8 + W-1: unified parsing + viewBox min-x/min-y)**:

기존 라인 134~146:
```tsx
    const svgEl = doc.documentElement;
    if (!svgEl.getAttribute('viewBox')) {
      const w = svgEl.getAttribute('width') || '800';
      const h = svgEl.getAttribute('height') || '600';
      svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }
    svgEl.removeAttribute('width');
    svgEl.removeAttribute('height');
    svgEl.setAttribute('style', 'width:100%;height:auto;display:block;');
```

변경 후:
```tsx
    const svgEl = doc.documentElement;
    if (!svgEl.getAttribute('viewBox')) {
      const w = svgEl.getAttribute('width') || '800';
      const h = svgEl.getAttribute('height') || '600';
      svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }

    // reviews revision HIGH #2 + W-1: unified parsing contract — descendant [data-stage] + VALID_STAGES enum
    // reviews revision LOW #8: viewBox split(/[\s,]+/) + [minX, minY, width, height] 모두 사용
    // ⚠ in-memory `doc`에만 적용 — R2 원본 SVG 파일은 변경하지 않음 (D-19 호환)
    const VALID_STAGES = ['top', 'right', 'bottom', 'left'] as const;
    type ValidStage = typeof VALID_STAGES[number];
    const hasStageText = Array.from(doc.querySelectorAll('text')).some(
      (t) => t.textContent?.trim() === 'STAGE',
    );
    // UNIFIED CONTRACT: root + descendant 모두 탐색
    const stageEl = doc.querySelector('[data-stage]');
    const rawStageValue = stageEl?.getAttribute('data-stage') ?? null;
    // enum 검증 + default top fallback (admin에서 이미 걸러지지만 viewer 방어적 코드)
    const dataStage: ValidStage | null =
      rawStageValue && (VALID_STAGES as readonly string[]).includes(rawStageValue)
        ? (rawStageValue as ValidStage)
        : rawStageValue !== null
          ? 'top'
          : null;

    if (!hasStageText && dataStage) {
      // reviews revision LOW #8: viewBox가 whitespace OR comma separated, [minX, minY, width, height] 모두 사용
      const viewBoxAttr = svgEl.getAttribute('viewBox') ?? '0 0 800 600';
      const viewBoxValues = viewBoxAttr.split(/[\s,]+/).map(Number);
      const vbMinX = viewBoxValues[0] ?? 0;
      const vbMinY = viewBoxValues[1] ?? 0;
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
      // viewBox minX/minY 반영: 배지 위치는 [vbMinX, vbMinX + vbW] × [vbMinY, vbMinY + vbH] 범위 안에 계산
      switch (dataStage) {
        case 'top':
          bx = vbMinX + vbW / 2 - badgeWidth / 2;
          by = vbMinY + 12;
          break;
        case 'bottom':
          bx = vbMinX + vbW / 2 - badgeWidth / 2;
          by = vbMinY + vbH - badgeHeight - 12;
          break;
        case 'left':
          bx = vbMinX + 12;
          by = vbMinY + vbH / 2 - badgeHeight / 2;
          break;
        case 'right':
          bx = vbMinX + vbW - badgeWidth - 12;
          by = vbMinY + vbH / 2 - badgeHeight / 2;
          break;
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

    svgEl.removeAttribute('width');
    svgEl.removeAttribute('height');
    svgEl.setAttribute('style', 'width:100%;height:auto;display:block;');
```

주의:
- **reviews revision HIGH #2 (unified contract):** `doc.querySelector('[data-stage]')`로 root+descendant 검색 — admin 측 svg-preview.tsx Plan 12-02 Task 2와 동일 로직.
- **reviews revision LOW #8 (viewBox parsing):** `split(/[\s,]+/)` — whitespace OR comma separator. `[minX, minY, width, height]` 4개 값 모두 사용. `viewBox="-100 -50 800 600"` 같은 음수 min 좌표 SVG에서도 배지가 정확히 해당 변에 배치.
- `VALID_STAGES as const` + `(VALID_STAGES as readonly string[]).includes(...)` + `as ValidStage` narrowing — strict TS 호환 + "no any" 준수.
- **W-1:** STAGE 오버레이는 useMemo 안 in-memory `doc`에만 적용 — R2 SVG 파일 불변.
- B-2-RESIDUAL-V2 Option C: useMemo는 fill을 *tier color or LOCKED_COLOR* 기본값만. primary 변경은 Task 3 useEffect.
- useMemo deps: `[rawSvg, seatStates, selectedSeatIds, tierColorMap, pendingRemovals]` — selectedSeatIds 유지 이유: 체크마크 mount/unmount 분기에 필요. pendingRemovals 추가 이유: 해제 중인 체크마크에 `data-fading-out` 부여 + 150ms 잔존.
- `processedSvg` useMemo는 string 반환 — string에 `data-fading-out` 속성이 attribute로 직렬화.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && grep -q "'data-seat-checkmark', ''" apps/web/components/booking/seat-map-viewer.tsx && grep -q "data-stage" apps/web/components/booking/seat-map-viewer.tsx && grep -q "VALID_STAGES" apps/web/components/booking/seat-map-viewer.tsx && grep -q "querySelector..\\[data-stage\\]" apps/web/components/booking/seat-map-viewer.tsx && grep -q "pendingRemovals" apps/web/components/booking/seat-map-viewer.tsx && grep -q "data-fading-out" apps/web/components/booking/seat-map-viewer.tsx && grep -q "data-tier-id" apps/web/components/booking/seat-map-viewer.tsx && grep -q "createElementNS" apps/web/components/booking/seat-map-viewer.tsx && grep -q "'STAGE'" apps/web/components/booking/seat-map-viewer.tsx && grep -q "무대 위치" apps/web/components/booking/seat-map-viewer.tsx && grep -q "prevSelectedRef" apps/web/components/booking/seat-map-viewer.tsx && grep -q "timeoutsRef" apps/web/components/booking/seat-map-viewer.tsx && grep -q "clearTimeout" apps/web/components/booking/seat-map-viewer.tsx && grep -q "split(/\\[\\\\s,\\]+/)" apps/web/components/booking/seat-map-viewer.tsx && grep -q "vbMinX" apps/web/components/booking/seat-map-viewer.tsx && grep -q "vbMinY" apps/web/components/booking/seat-map-viewer.tsx && pnpm --filter @grapit/web typecheck 2>&1 | tail -5 && pnpm --filter @grapit/web lint 2>&1 | tail -5 && pnpm --filter @grapit/web test -- seat-map-viewer --run 2>&1 | tail -50</automated>
  </verify>
  <acceptance_criteria>
    - 변경 C-2 (체크마크 data-seat-checkmark) 검증:
      - `grep -q "'data-seat-checkmark', ''" apps/web/components/booking/seat-map-viewer.tsx`
    - **변경 C-3 (reviews revision HIGH #1 per-seat timeout Map 재설계) 검증:**
      - `grep -q "prevSelectedRef" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "timeoutsRef" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "useRef<Map<string, number>>" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "clearTimeout" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "timeoutsRef.current.set" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "timeoutsRef.current.delete" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "pendingRemovals" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "data-fading-out" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "data-tier-id" apps/web/components/booking/seat-map-viewer.tsx`
      - **prevSelectedRef 동기 갱신이 useEffect 본문 안에 있음 (setTimeout callback 밖):**
        - `awk '/useEffect.*selectedSeatIds/,/}\\, \\[/{ if (/prevSelectedRef.current = new Set/) { found=1 } if (/setTimeout/) { found_in_timeout=1 } } END { exit (found && !found_in_timeout) ? 0 : 1 }'` exit 0 (approximate — 실제 검증은 수동 코드 리뷰)
    - **W-3 useMemo deps 변경 검증:**
      - `grep -E "\\[rawSvg, seatStates, selectedSeatIds, tierColorMap, pendingRemovals\\]" apps/web/components/booking/seat-map-viewer.tsx`
    - **fill primary 변경 코드 useMemo 안에 *없음* 검증:**
      - `! grep -E "el\\.setAttribute\\('fill', '#6C3CE0'" apps/web/components/booking/seat-map-viewer.tsx | grep -v "el\\.setAttribute\\('fill', '#6C3CE0'\\);.*// Brand Purple"`
      - (fill primary 변경은 Task 3 useEffect 안에서만)
    - **변경 D (reviews revision HIGH #2 unified parsing + LOW #8 viewBox min-x/min-y):**
      - `grep -q "VALID_STAGES" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "querySelector..\\[data-stage\\]" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "hasStageText" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "createElementNS" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "'STAGE'" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "무대 위치" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "vbMinX" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "vbMinY" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -qE "split\\(/\\[\\\\\\\\s,\\]\\+/\\)" apps/web/components/booking/seat-map-viewer.tsx` 또는 `grep -q '\\[\\\\s,\\]' apps/web/components/booking/seat-map-viewer.tsx`
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
      - 신규 케이스 6 (STAGE 오버레이 root data-stage) PASS
      - 신규 케이스 7 (data-fading-out + DOM 잔존 → 160ms 후 제거) PASS
      - **신규 케이스 8 (reviews revision HIGH #1 rapid reselect race guard) PASS** — advanceTimersByTime(80) → reselect → advanceTimersByTime(200) 후 `data-fading-out` stuck 없음
      - **신규 케이스 9 (reviews revision HIGH #2 descendant data-stage viewer)** PASS — `<g data-stage="right">` descendant에서 STAGE 오버레이 x 좌표가 viewBox width의 우측 근방
      - 신규 케이스 1, 2, 10 (fill transition, locked transition:none, selected+locked priority) — Task 3 미완료 시 RED 허용
      - 기존 6 회귀 케이스 PASS
  </acceptance_criteria>
  <done>
seat-map-viewer.tsx에 변경 C-2/C-3/D 적용. **reviews revision HIGH #1**: per-seat timeout Map 재설계로 rapid reselect race guard. **reviews revision HIGH #2**: unified parsing contract (root+descendant querySelector + VALID_STAGES enum). **reviews revision LOW #8**: viewBox min-x/min-y 반영. 신규 케이스 3, 6, 7, 8, 9 GREEN. 기존 6 회귀 케이스 GREEN. typecheck/lint GREEN. Task 3으로 진행 가능.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3 (UX-04 transition + B-2-RESIDUAL-V2 Option C + D-13 BROADCAST PRIORITY): 별도 useEffect fill 변경 + seatStates 체크로 locked/sold skip</name>
  <files>apps/web/components/booking/seat-map-viewer.tsx</files>
  <read_first>
    - apps/web/components/booking/seat-map-viewer.tsx (Task 1+2 적용 후)
    - apps/web/components/booking/__tests__/seat-map-viewer.test.tsx (Plan 12-00 신규 케이스 1 + 10 — 갱신된 useEffect 기반 검증 + selected+locked 회귀)
    - .planning/phases/12-ux/12-RESEARCH.md §"Pitfall 3: useMemo 안에서 requestAnimationFrame 호출" (line 508~513)
    - .planning/phases/12-ux/12-UI-SPEC.md §"Interaction & State Contract" §L240
    - .planning/phases/12-ux/12-CONTEXT.md D-13 + D-13 CLARIFICATION (reviews revision broadcast priority)
    - **.planning/phases/12-ux/12-REVIEWS.md §"Action Items" MED #4** — selected+locked/sold 회귀 테스트 및 priority
  </read_first>
  <behavior>
    - 변경 G (B-2-RESIDUAL-V2 Option C + reviews revision MED #4): 컴포넌트 본문에 신규 useEffect 추가:
      - deps: `[selectedSeatIds, pendingRemovals, tierColorMap, seatStates, processedSvg]`
      - containerRef.current에서 SVG 찾기
      - **각 selectedSeatIds의 seatId에 대해 `seatStates.get(seatId)` 체크 — `'locked'` 또는 `'sold'`이면 skip (reviews revision MED #4 D-13 BROADCAST PRIORITY)**
      - 그 외 selected는 fill을 primary 색(`#6C3CE0`)으로 변경 + `el.style.transition = 'fill 150ms ease-out'` 부여
      - pendingRemovals 각 seatId: fill을 `tierColorMap.get(seatId)?.color ?? LOCKED_COLOR`로 복원 + transition 유지
      - broadcast로 locked 전환된 selected 좌석은 useMemo에서 이미 LOCKED_COLOR + `transition:none`으로 박혀 있으므로 useEffect가 건드리지 않음 → D-13 유지
  </behavior>
  <action>
**변경 G — 별도 useEffect로 fill transition trigger + D-13 BROADCAST PRIORITY 체크**:

Task 2에서 추가한 pendingRemovals useEffect 다음(또는 processedSvg useMemo 다음) 적절한 위치에 INSERT:

```tsx
  // B-2-RESIDUAL-V2 Option C (reviews revision MED #4 D-13 BROADCAST PRIORITY):
  // dangerouslySetInnerHTML이 SVG를 재마운트한 *직후* 동일 element의 fill을 변경.
  // useMemo가 outerHTML 전체를 string으로 반환 → React가 자식 DOM을 unmount/remount
  //   → 새 rect는 mount 시점부터 tier 색이 박혀 *이전→새 값* 변화가 없음 → CSS `transition: fill 150ms` 무효.
  // 권장 패턴 (RESEARCH §Pitfall 3): 마운트 후 useEffect가 *동일 element의 속성*을 변경 → CSS transition 정상 발화.
  //
  // reviews revision MED #4 D-13 BROADCAST PRIORITY:
  //   selectedSeatIds 안의 좌석이 broadcast로 locked/sold로 전환된 경우,
  //   useEffect가 primary 색으로 덮어쓰면 D-13의 "broadcast 즉시 회색" 정책 침해.
  //   → seatStates.get(seatId) === 'locked' | 'sold'이면 skip.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !processedSvg) return;
    const root = container.querySelector('svg');
    if (!root) return;

    // 선택 좌석: fill을 primary로 변경 + transition 부여
    // 단 D-13: locked/sold 상태는 skip (broadcast 우선)
    selectedSeatIds.forEach((seatId) => {
      const state = seatStates.get(seatId);
      if (state === 'locked' || state === 'sold') {
        // reviews revision MED #4: useMemo가 이미 LOCKED_COLOR + transition:none으로 박아둠.
        // useEffect는 건드리지 않음 → D-13 broadcast 즉시 회색 정책 유지.
        return;
      }
      const el = root.querySelector(`[data-seat-id="${seatId}"]`) as SVGElement | null;
      if (!el) return;
      el.style.transition = 'fill 150ms ease-out, stroke 150ms ease-out';
      el.setAttribute('fill', '#6C3CE0'); // Brand Purple — D-03
    });

    // 해제 중인 좌석: fill을 원래 tier 색상으로 복원 + transition 유지
    pendingRemovals.forEach((seatId) => {
      const el = root.querySelector(`[data-seat-id="${seatId}"]`) as SVGElement | null;
      if (!el) return;
      el.style.transition = 'fill 150ms ease-out, stroke 150ms ease-out';
      const originalFill = tierColorMap.get(seatId)?.color ?? LOCKED_COLOR;
      el.setAttribute('fill', originalFill);
    });
  }, [selectedSeatIds, pendingRemovals, tierColorMap, seatStates, processedSvg]);
```

주의:
- **reviews revision MED #4 핵심:** `seatStates.get(seatId)` 체크가 selectedSeatIds forEach 안에서 primary 색 덮어쓰기 *직전*에 수행. locked/sold면 early return → useMemo의 LOCKED_COLOR + transition:none이 그대로 보임.
- deps에 `seatStates` 추가: broadcast로 seatStates가 변경되어 locked 전환되면 useEffect가 재실행 → 새 조건(`state === 'locked'`) → skip → fill 그대로 LOCKED_COLOR. 기존 useMemo도 seatStates를 deps로 가지므로 locked/sold 분기로 LOCKED_COLOR + `transition:none` 박힘.
- `containerRef.current.querySelector('svg')` — dangerouslySetInnerHTML 마운트 후 첫 svg element.
- React rules of hooks 준수.
- `as SVGElement | null` 타입 단언 + null 가드.
- tierColorMap.get(seatId)의 반환 타입은 `{tierName: string, color: string} | undefined` — optional chaining + fallback.
- **무한 루프 체크:** useEffect는 deps 변경 시만 실행. 각 실행은 el.setAttribute만 호출, state 변경 없음 → 무한 루프 없음.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && grep -E "el\\.style\\.transition\\s*=\\s*'fill 150ms" apps/web/components/booking/seat-map-viewer.tsx && grep -q "useEffect" apps/web/components/booking/seat-map-viewer.tsx && grep -q "'#6C3CE0'" apps/web/components/booking/seat-map-viewer.tsx && grep -q "containerRef.current" apps/web/components/booking/seat-map-viewer.tsx && grep -q "seatStates.get(seatId)" apps/web/components/booking/seat-map-viewer.tsx && grep -q "BROADCAST PRIORITY" apps/web/components/booking/seat-map-viewer.tsx && pnpm --filter @grapit/web typecheck 2>&1 | tail -5 && pnpm --filter @grapit/web lint 2>&1 | tail -5 && pnpm --filter @grapit/web test -- seat-map-viewer --run 2>&1 | tail -50</automated>
  </verify>
  <acceptance_criteria>
    - 변경 G (B-2-RESIDUAL-V2 Option C useEffect) 검증:
      - `grep -E "el\\.style\\.transition\\s*=\\s*'fill 150ms" apps/web/components/booking/seat-map-viewer.tsx`
      - **useEffect 카운트 ≥ 3** (fetch + pendingRemovals + fill transition + unmount cleanup = 4):
        - `grep -c "useEffect(" apps/web/components/booking/seat-map-viewer.tsx` → 출력 ≥ 3
      - **Brand Purple 사용:** `grep -q "'#6C3CE0'" apps/web/components/booking/seat-map-viewer.tsx`
      - **containerRef 사용:** `grep -q "containerRef.current" apps/web/components/booking/seat-map-viewer.tsx`
    - **reviews revision MED #4 D-13 BROADCAST PRIORITY 검증:**
      - `grep -q "seatStates.get(seatId)" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "BROADCAST PRIORITY\\|D-13" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "state === 'locked' || state === 'sold'" apps/web/components/booking/seat-map-viewer.tsx`
      - **seatStates가 fill useEffect deps에 포함:**
        - `grep -qE "\\[selectedSeatIds, pendingRemovals, tierColorMap, seatStates, processedSvg\\]" apps/web/components/booking/seat-map-viewer.tsx`
    - **useMemo 안 transition:fill 150ms inline style 미존재**:
      - `! grep -E "transition:fill\\s+150ms" apps/web/components/booking/seat-map-viewer.tsx | grep -v "el\\.style\\.transition"`
    - 회귀 가드 (Task 1+2 sentinel):
      - `grep -q "import { TransformWrapper, TransformComponent, MiniMap }" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "key={isMobile ? 'mobile' : 'desktop'}" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "<MiniMap" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "prefixSvgDefsIds" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "'data-seat-checkmark', ''" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "data-fading-out" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "VALID_STAGES" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "timeoutsRef" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "createElementNS" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "'STAGE'" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "LOCKED_COLOR = '#D1D5DB'" apps/web/components/booking/seat-map-viewer.tsx`
      - `grep -q "SELECTED_STROKE = '#1A1A2E'" apps/web/components/booking/seat-map-viewer.tsx`
    - **transition:none 회귀 (D-13)** locked/sold/available 분기 유지:
      - `grep -c "transition:none" apps/web/components/booking/seat-map-viewer.tsx` ≥ 2
    - any 금지:
      - `! grep -q ": any\\b\\|<any>" apps/web/components/booking/seat-map-viewer.tsx`
    - 정적 검사:
      - `pnpm --filter @grapit/web typecheck` exit 0
      - `pnpm --filter @grapit/web lint` exit 0
    - **테스트 GREEN (Plan 12-00의 모든 seat-map-viewer 케이스)**:
      - `pnpm --filter @grapit/web test -- seat-map-viewer --run` exit 0
      - 출력에 "16 passed" 또는 ≥15 케이스 PASS (기존 6 + 신규 10)
      - 신규 케이스 1 (fill primary transition) PASS
      - 신규 케이스 2 (locked transition:none 회귀) PASS
      - 신규 케이스 3 (data-seat-checkmark) PASS
      - 신규 케이스 4 (MiniMap 마운트) PASS
      - 신규 케이스 5 (initialScale 1.4) PASS
      - 신규 케이스 6 (root data-stage STAGE 오버레이) PASS
      - 신규 케이스 7 (B-2 data-fading-out + DOM 잔존 → 160ms 후 제거) PASS
      - **신규 케이스 8 (reviews revision HIGH #1 rapid reselect race guard) PASS**
      - **신규 케이스 9 (reviews revision HIGH #2 descendant data-stage viewer) PASS**
      - **신규 케이스 10 (reviews revision MED #4 selected+locked broadcast 회귀) PASS**
      - "FAIL" 또는 "✗" 출력 0건
  </acceptance_criteria>
  <done>
seat-map-viewer.tsx에 변경 G 적용. **reviews revision MED #4**: useEffect 안 `seatStates.get(seatId)` 체크로 locked/sold 좌석은 primary 색 skip → D-13 BROADCAST PRIORITY 보장. B-2-RESIDUAL-V2 Option C 완성 — useMemo 기본 색상 + useEffect transition trigger. Plan 12-00의 16 케이스 모두 GREEN (기존 6 회귀 + 신규 10). typecheck/lint GREEN.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (변경 없음) | viewer는 R2 fetch + dangerouslySetInnerHTML로 SVG 렌더 — 본 plan은 기존 신뢰 경계 변경 0. admin SVG 검증은 Plan 12-02에서 mitigate 완료. STAGE 오버레이는 in-memory only (W-1). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| (해당 없음) | — | — | — | Wave 3는 viewer 시각/상호작용 변경만. T-12-01 (admin SVG 입력 검증)은 Plan 12-02에서 mitigate 완료. SVG `<defs>` ID 충돌은 W-2 헬퍼로 외부 admin SVG 케이스 mitigate. |
</threat_model>

<verification>
- [ ] Task 1: W-2 helper 파일 분리 (JSDoc coverage 제한 명시 — reviews revision LOW #6) + 변경 A/B/E/F
- [ ] Task 2: 변경 C-2/C-3/D (체크마크 attr + per-seat timeout Map 재설계 HIGH #1 + unified parsing HIGH #2 + viewBox min-x/min-y LOW #8 + STAGE in-memory W-1)
- [ ] Task 3: 변경 G (별도 useEffect fill transition + D-13 BROADCAST PRIORITY MED #4)
- [ ] 기존 6 회귀 케이스 GREEN 유지
- [ ] 신규 10 케이스 GREEN (fill useEffect + locked transition:none + data-seat-checkmark + MiniMap 마운트 + initialScale + STAGE 오버레이 + data-fading-out + rapid reselect race guard + descendant data-stage + selected+locked priority)
- [ ] `pnpm --filter @grapit/web typecheck` GREEN
- [ ] `pnpm --filter @grapit/web lint` GREEN
- [ ] LOCKED_COLOR / SELECTED_STROKE / role="grid" / aria-label sentinel 회귀 0
- [ ] `transition:none`이 locked/sold/available 분기에 모두 유지 (D-13 회귀 방지)
- [ ] W-1: STAGE 오버레이가 in-memory `doc`에만 적용
- [ ] W-2: `prefixSvgDefsIds` 헬퍼 별도 파일 + 단위 테스트 5건 GREEN + coverage JSDoc 명시
- [ ] **reviews revision HIGH #1**: per-seat timeout Map + clearTimeout on reselect + 동기 prevSelectedRef 갱신
- [ ] **reviews revision HIGH #2**: viewer querySelector('[data-stage]') descendant + viewBox min-x/min-y
- [ ] **reviews revision MED #4**: fill useEffect 안 seatStates.get(seatId) locked/sold skip
- [ ] **reviews revision LOW #6/#8**: helper JSDoc coverage 제한 + viewBox split(/[\\s,]+/)
</verification>

<success_criteria>
- 자동: 위 verification 15개 항목 모두 충족
- Plan 12-03.5 MiniMap smoke test gate (reviews revision MED #5)를 위해 Wave 3 완료 후 dev server 실행 준비
- Plan 12-04 manual QA gate에서 검증할 시각 행위:
  - 좌석 클릭 시 rect fill이 tier color → primary로 부드럽게 fade (B-2-RESIDUAL-V2 Option C)
  - 좌석 클릭 시 체크마크 fade-in 부드럽게
  - 좌석 해제 시 rect fill이 primary → tier color로 부드럽게 fade
  - 좌석 해제 시 체크마크 fade-out 부드럽게 (150ms 후 DOM 제거)
  - **빠른 해제→재선택 시 `data-fading-out` stuck 없음 (reviews revision HIGH #1)**
  - **선택 좌석이 broadcast로 locked 전환 시 즉시 회색, transition 없음 (reviews revision MED #4 D-13 priority)**
  - **`<g data-stage="right">` descendant SVG에서도 viewer가 우측 STAGE 오버레이 생성 (reviews revision HIGH #2)**
  - 데스크톱 미니맵 좌상단 표시 + zoom/pan 시 viewport rect 동기
  - 모바일 디바이스에서 좌석 터치 폭 ≥ 44px
  - prefers-reduced-motion 켜기 시 체크마크 fade 모두 즉시
</success_criteria>

<output>
After completion, create `.planning/phases/12-ux/12-03-SUMMARY.md`:
- Task 1 변경 (W-2 helper 분리 + JSDoc coverage 제한 + import / hook / TransformWrapper / MiniMap)
- Task 2 변경 (체크마크 attr + per-seat timeout Map 재설계 HIGH #1 + unified parsing HIGH #2 + viewBox min-x/min-y LOW #8 + STAGE in-memory W-1)
- Task 3 변경 (B-2-RESIDUAL-V2 Option C useEffect + D-13 BROADCAST PRIORITY MED #4)
- 16 케이스 모두 GREEN 증거 (vitest 출력)
- W-2 helper 5 케이스 GREEN 증거
- typecheck/lint 결과
- **reviews revision 적용 증거**:
  - HIGH #1: `timeoutsRef` / `clearTimeout` / 동기 prevSelectedRef 갱신
  - HIGH #2: `querySelector('[data-stage]')` / `VALID_STAGES` / viewBox min-x/min-y
  - MED #4: `seatStates.get(seatId)` + 'locked'/'sold' skip
  - LOW #6: helper JSDoc coverage 제한
  - LOW #8: viewBox split 및 `[minX, minY, width, height]` 모두 사용
- W-1 (STAGE in-memory only) + W-2 (helper 별도 파일) 적용 증거
- Plan 12-03.5 (MiniMap smoke test gate) 준비 완료 신호 — Wave 4 진입 전 gate
</output>
