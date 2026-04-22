---
phase: 12
plan: 00
plan_number: 0
type: execute
wave: 0
depends_on: []
files_modified:
  - apps/web/components/admin/__tests__/svg-preview.test.tsx
  - apps/web/hooks/__tests__/use-is-mobile.test.ts
  - apps/web/components/booking/__tests__/seat-map-viewer.test.tsx
  - apps/web/components/booking/__utils__/__tests__/prefix-svg-defs-ids.test.ts
autonomous: true
requirements: [UX-02, UX-04, UX-05, UX-06]
must_haves:
  truths:
    - "Wave 0 종료 후, svg-preview·use-is-mobile·seat-map-viewer·prefix-svg-defs-ids 4개 테스트 파일이 모두 존재하며 vitest 실행 시 RED(실패) 또는 PENDING(skip) 상태로 신규 케이스가 카운트된다"
    - "기존 seat-map-viewer 6개 회귀 케이스는 신규 mock 확장(B-3 vi.hoisted 적용)에도 그대로 GREEN을 유지한다"
    - "신규 케이스의 자동화 명령(`pnpm --filter @grapit/web test -- svg-preview`, `use-is-mobile`, `seat-map-viewer`, `prefix-svg-defs-ids`)이 후속 wave의 verify 진입점으로 작동한다"
    - "B-3: vi.mock factory가 vi.hoisted로 안전하게 모듈 top-level const(transformWrapperSpy/mockUseIsMobile/miniMapSpy)를 참조하여 ReferenceError 0건"
    - "B-4: use-is-mobile.test.ts에 getServerSnapshot named export를 직접 import해서 false 반환을 검증하는 케이스가 추가되어 SSR fallback이 unit test로 자동 검증됨"
    - "B-2-RESIDUAL-V2: seat-map-viewer.test.tsx 신규 케이스 1이 *useEffect 기반 fill 변경*을 검증 (Option C) — vitest renderer가 마운트 후 useEffect 실행 → `seatA1.style.transition`에 `fill 150ms` 포함 + `seatA1.getAttribute('fill')`이 primary로 변경됨 검증"
    - "B-2-RESIDUAL-V2 RACE GUARD (reviews revision): 빠른 해제→재선택 시퀀스에서 per-seat timeout map이 stuck `data-fading-out` 잔존을 방지함을 fakeTimers 시나리오로 검증하는 신규 케이스 8 추가"
    - "UX-02 PARSING UNIFIED (reviews revision): svg-preview 검증은 `<g data-stage>` descendant도 통과, `data-stage=\"invalid-value\"`는 거부. viewer 렌더링은 `<g data-stage=\"right\">` descendant에서도 STAGE 오버레이를 생성한다는 신규 케이스 추가"
    - "D-13 BROADCAST PRIORITY (reviews revision): 선택 좌석이 broadcast로 locked 전환될 때 fill은 locked color를 유지하고 transition이 적용되지 않음을 검증하는 회귀 케이스 추가"
    - "W-2: prefix-svg-defs-ids.test.ts 5 케이스(<defs> 없음 / ID 1개 / 다수 / 정규식 메타문자 escape / parse 실패 graceful)가 helper 단위 테스트로 작성됨 — dynamic import 방식으로 Wave 0 typecheck GREEN 보장 (12-REVIEWS.md Codex MED concern #6)"
  artifacts:
    - path: "apps/web/components/admin/__tests__/svg-preview.test.tsx"
      provides: "UX-02 admin 업로드 검증 테스트 스캐폴딩 (정상 SVG 통과 / stage 마커 없는 SVG 거부 / descendant data-stage 통과 / invalid enum 거부 / parse 실패 toast / R2 PUT 미발생)"
      contains: "describe('SvgPreview') + 최소 6 케이스"
    - path: "apps/web/hooks/__tests__/use-is-mobile.test.ts"
      provides: "UX-06 useIsMobile hook 단위 테스트 (모바일/데스크톱/change 이벤트/getServerSnapshot named export — B-4)"
      contains: "describe('useIsMobile') + 최소 4 케이스 (B-4: import { getServerSnapshot } 검증 1 케이스 포함)"
    - path: "apps/web/components/booking/__tests__/seat-map-viewer.test.tsx"
      provides: "UX-04/05/06 회귀 + 신규 9 케이스 (transition useEffect 기반 / data-seat-checkmark / MiniMap / initialScale / STAGE 오버레이 / B-2-RESIDUAL-V2 data-fading-out + DOM 잔존 + rapid reselect race guard / descendant data-stage / selected+locked broadcast 회귀)"
      contains: "vi.hoisted (B-3) + MiniMap mock + transformWrapperSpy + useIsMobile mock + Option C useEffect 검증 (style.transition + fill primary) + 빠른 재선택 race guard + descendant data-stage + selected+locked 회귀"
    - path: "apps/web/components/booking/__utils__/__tests__/prefix-svg-defs-ids.test.ts"
      provides: "W-2: prefixSvgDefsIds helper 5 케이스 (no defs / 1 id / multiple / regex meta / parse error) — dynamic import 방식"
      contains: "describe('prefixSvgDefsIds') + 5 케이스, dynamic import (await import(...)) — Wave 0 typecheck GREEN 보장"
  key_links:
    - from: "apps/web/components/booking/__tests__/seat-map-viewer.test.tsx"
      to: "react-zoom-pan-pinch (mock)"
      via: "vi.hoisted (B-3)로 transformWrapperSpy/mockUseIsMobile/miniMapSpy 안전 선언 + vi.mock factory에서 참조"
      pattern: "MiniMap:.*data-testid.*minimap"
    - from: "apps/web/components/booking/__tests__/seat-map-viewer.test.tsx"
      to: "@/hooks/use-is-mobile (mock)"
      via: "vi.mock('@/hooks/use-is-mobile') + vi.hoisted mockUseIsMobile"
      pattern: "useIsMobile.*mockUseIsMobile"
    - from: "apps/web/components/admin/__tests__/svg-preview.test.tsx"
      to: "sonner / @/hooks/use-admin / fetch (mock)"
      via: "vi.mock + vi.stubGlobal('fetch')"
      pattern: "vi.mock\\('sonner'"
    - from: "apps/web/hooks/__tests__/use-is-mobile.test.ts (B-4 신규 케이스)"
      to: "apps/web/hooks/use-is-mobile.ts (Plan 12-02 산출물 — getServerSnapshot named export)"
      via: "import { getServerSnapshot } from '@/hooks/use-is-mobile' → expect(getServerSnapshot()).toBe(false)"
      pattern: "import.*getServerSnapshot.*use-is-mobile"
    - from: "apps/web/components/booking/__utils__/__tests__/prefix-svg-defs-ids.test.ts (W-2)"
      to: "apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts (Plan 12-03 Task 1 산출물)"
      via: "dynamic import inside each it() — `const { prefixSvgDefsIds } = await import('../prefix-svg-defs-ids');` (static top-level import는 Wave 0 typecheck 실패 유발 — reviews revision)"
      pattern: "await import.*prefix-svg-defs-ids"
---

<objective>
Wave 0 — 테스트 스캐폴딩.

Phase 12의 모든 검증 가능 행위(svg-preview admin 검증 / useIsMobile hook + getServerSnapshot named export(B-4) / seat-map-viewer transition·체크마크 fade-in/out·MiniMap·initialScale·STAGE 오버레이·data-fading-out(B-2-RESIDUAL-V2 Option C + rapid reselect race guard) / prefixSvgDefsIds helper(W-2))에 대한 vitest 테스트 파일을 RED 상태로 먼저 만든다. 이후 Wave 1~3 구현 task가 GREEN으로 전환하는 흐름.

Purpose: 12-VALIDATION.md의 sampling rate(`pnpm --filter @grapit/web test -- seat-map-viewer use-is-mobile svg-preview prefix-svg-defs-ids`)가 Wave 1부터 의미 있게 동작하도록, 모든 검증 단위가 명령에 포착되어야 한다. Nyquist compliance를 위해 Wave 0가 선행되어야 한다.

**Revision history:**
- B-3: seat-map-viewer.test.tsx에서 vi.mock factory가 모듈 top-level const를 참조할 때 발생하는 ReferenceError를 vi.hoisted로 회피
- B-4: use-is-mobile.test.ts에 getServerSnapshot named export 직접 검증 케이스 추가 (SSR fallback unit test 자동화)
- B-2-RESIDUAL Option C: seat-map-viewer.test.tsx 신규 케이스 1을 *useEffect 기반 fill 변경* 검증으로 갱신
- B-2-RESIDUAL: 신규 케이스 7은 체크마크 data-fading-out + DOM 잔존 → 160ms 후 제거만 검증
- W-2: prefix-svg-defs-ids.test.ts 신규 파일 5 케이스 (helper 별도 파일 분리 후 단위 테스트)

**Reviews revision (2026-04-21 — 12-REVIEWS.md Codex review):**
- **HIGH #1 (race condition):** 신규 케이스 8 추가 — 빠른 unselect→reselect 시퀀스 (80ms 진행 후 reselect → 200ms 진행)에서 `data-fading-out` 속성이 stuck되지 않음을 검증. Plan 12-03 Task 2의 per-seat timeout Map 재설계 GREEN 전환 대상.
- **HIGH #2 (parsing contract unified):** svg-preview 신규 케이스 5 추가 — `<g data-stage="top">` descendant SVG 통과. svg-preview 신규 케이스 6 추가 — `data-stage="invalid-value"`는 enum 위반으로 거부. seat-map-viewer 신규 케이스 8 추가 — `<g data-stage="right">` descendant SVG에서 viewer가 우측 STAGE 오버레이 생성.
- **MED #4 (D-13 priority):** seat-map-viewer 신규 케이스 9 추가 — 선택 좌석이 broadcast로 locked 전환 시 fill은 LOCKED_COLOR 유지 + inline style에 `transition:none` 유지. Plan 12-03 Task 3의 useEffect가 seatStates 체크로 skip하도록 GREEN 전환 대상.
- **MED #6 (Wave 0 typecheck gate):** prefix-svg-defs-ids.test.ts를 **Option B (dynamic import)** 로 전환. 정적 top-level `import { prefixSvgDefsIds }` 제거, 각 it() 안에서 `await import('../prefix-svg-defs-ids')` — Plan 12-03 Task 1 구현 전 typecheck exit 0 보장. seat-map-viewer.test.tsx는 기존대로 static import 유지 (Plan 12-03 Task 1이 helper 먼저 작성하므로 viewer 변경 시점에는 helper 존재함).
- **LOW #7 (handleSvgUpload try/catch):** svg-preview 신규 케이스 7 추가 — 파싱 실패(잘못된 XML) 시 `toast.error('SVG 형식이 올바르지 않습니다. 다시 확인 후 업로드하세요.')` 호출 + R2 PUT 미발생.

Output:
- 신규 `apps/web/components/admin/__tests__/svg-preview.test.tsx` (7 케이스 — reviews revision: descendant data-stage + invalid enum + parse 실패 + 기본 4)
- 신규 `apps/web/hooks/__tests__/use-is-mobile.test.ts` (4 케이스 — B-4 getServerSnapshot 1 케이스 포함)
- 갱신 `apps/web/components/booking/__tests__/seat-map-viewer.test.tsx` (B-3 vi.hoisted 적용 mock 확장 + 9 신규 케이스 — B-2-RESIDUAL-V2 Option C rapid reselect race guard + descendant data-stage + selected+locked broadcast 회귀 포함)
- 신규 `apps/web/components/booking/__utils__/__tests__/prefix-svg-defs-ids.test.ts` (W-2: 5 케이스 — dynamic import 방식)
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
@.planning/phases/12-ux/12-VALIDATION.md
@.planning/phases/12-ux/12-UI-SPEC.md
@.planning/phases/12-ux/12-REVIEWS.md
@apps/web/components/booking/seat-map-viewer.tsx
@apps/web/components/admin/svg-preview.tsx
@apps/web/components/booking/__tests__/seat-map-viewer.test.tsx
@apps/web/hooks/use-countdown.ts
@apps/web/hooks/__tests__/use-countdown.test.ts
@apps/web/app/auth/reset-password/__tests__/reset-password.test.tsx

<interfaces>
<!-- 후속 Wave가 구현할 contract — Wave 0 테스트는 이 contract를 가정하고 작성한다. -->

NEW hook: apps/web/hooks/use-is-mobile.ts
```ts
'use client';
export function useIsMobile(): boolean;
export function getServerSnapshot(): boolean;  // B-4: named export로 노출 (SSR fallback 자동 검증용)
```
- 의존: `react`의 `useSyncExternalStore`
- matchMedia query: `'(max-width: 767px)'`
- SSR fallback: `false` (desktop)
- getServerSnapshot은 named export — Wave 0 unit test가 직접 import해서 검증 (B-4)

NEW helper: apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts (W-2)
```ts
export function prefixSvgDefsIds(svgString: string, prefix: string): string;
```
- DOMParser로 <defs> 안 ID에 prefix 부여 + url(#) 일괄 치환
- <defs> 없거나 ID 0개 → 원본 string 반환
- parse 실패 → graceful (try/catch + parsererror tagName 가드)
- **Coverage (reviews revision LOW #6):** 현재 구현은 `url(#id)` 참조만 치환. `href="#id"` / `xlink:href="#id"`는 커버하지 않음. 현재 sample-seat-map.svg 및 어드민 업로드 샘플에서 사용 없음으로 MVP 수용. 향후 `<use href>` 사용 SVG 도입 시 helper 확장 필요.

MODIFIED component: apps/web/components/booking/seat-map-viewer.tsx
- 신규 import: `MiniMap` from `'react-zoom-pan-pinch'`, `useIsMobile` from `'@/hooks/use-is-mobile'`, `prefixSvgDefsIds` from `'./__utils__/prefix-svg-defs-ids'` (W-2 helper 별도 파일)
- 변경 1 (UX-04 + B-2-RESIDUAL-V2 Option C): useMemo 안 selected 분기에서 inline `transition:fill 150ms` 부여를 *제거*. 별도 useEffect가 마운트 직후 동일 element에 `el.style.transition = 'fill 150ms ease-out'` 부여 + `el.setAttribute('fill', '#6C3CE0')` 변경 → 동일 element 속성 변경이므로 CSS transition 정상 발화.
- **변경 1b (D-13 broadcast priority — reviews revision MED #4):** fill useEffect는 `seatStates.get(seatId)`가 `'locked'` 또는 `'sold'`이면 primary 색 변경을 skip + `transition:none` 유지. useMemo의 locked/sold 분기 스타일이 우선.
- 변경 2 (UX-04): 선택 좌석 체크마크 `<text>`에 `setAttribute('data-seat-checkmark', '')` 한 줄 추가 (mount 시 fade-in — CSS @keyframes mount-time 트리거)
- **변경 2b (B-2-RESIDUAL-V2 race-safe pendingRemovals — reviews revision HIGH #1):** per-seat timeout tracking으로 재설계.
  - `useRef<Map<string, number>>` — seatId → timeoutId 매핑 (Plan 12-03 Task 2 상세)
  - `[prevSelected - currentSelected]` 차집합 → 해제된 좌석마다 개별 setTimeout 150ms 등록 + Map에 기록
  - 재선택(rapid reselect) 감지 시 해당 seatId의 기존 timeoutId를 `clearTimeout` + Map에서 delete + pendingRemovals set에서 즉시 remove
  - `prevSelectedRef.current = new Set(currentSelected)`를 diff 계산 *직후* 동기 갱신 (기존 setTimeout 콜백 안 갱신 제거)
- 변경 3 (UX-02 + reviews revision HIGH #2): processedSvg useMemo에서 stage 판정은 `doc.querySelector('[data-stage]')`로 root+descendant 모두 탐색. 읽은 값이 `top|right|bottom|left` 중 하나가 아니면 default `top` fallback. viewBox 파싱은 `split(/[\s,]+/)` + `[minX, minY, width, height]` 모두 사용하여 배지 위치 계산.
- 변경 4 (UX-06): TransformWrapper에 `key={isMobile ? 'mobile' : 'desktop'}` + `initialScale={isMobile ? 1.4 : 1}`
- 변경 5 (UX-05): TransformWrapper 내부 `<SeatMapControls />` 다음에 `{!isMobile && <MiniMap ...>}` 마운트 (with W-2 prefixSvgDefsIds helper)

MODIFIED component: apps/web/components/admin/svg-preview.tsx
- handleSvgUpload 콜백 안 size 체크 직후, presigned URL 발급 이전에 다음 검증 prepend:
  - try-catch로 `await file.text()` + `new DOMParser().parseFromString(text, 'image/svg+xml')` 감싸기 — parse 실패 시 `toast.error('SVG 형식이 올바르지 않습니다. 다시 확인 후 업로드하세요.')` + early return (reviews revision LOW #7).
  - `<text>STAGE</text>` (`textContent.trim() === 'STAGE'`) 또는 `doc.querySelector('[data-stage]')`(root or descendant) 부재 시 `toast.error('스테이지 마커가 없는 SVG입니다. <text>STAGE</text> 또는 data-stage 속성을 포함해주세요.')` + early return
  - `[data-stage]` 발견 시 enum 검증 — 값이 `top|right|bottom|left` 중 하나가 아니면 `toast.error('data-stage 속성 값은 top, right, bottom, left 중 하나여야 합니다.')` + early return (reviews revision HIGH #2)

MODIFIED globals.css (Wave 1):
- `@theme` 블록 안: `--shadow-sm`, `--shadow-md`, `--radius-sm/md/lg/xl`, `@keyframes seat-checkmark-fade-in`, `@keyframes seat-checkmark-fade-out` (B-1: fade-out 추가)
- `@theme` 블록 밖: `[data-seat-checkmark] { animation: seat-checkmark-fade-in 150ms ease-out forwards; }`
- `@theme` 블록 밖: `[data-seat-checkmark][data-fading-out="true"] { animation: seat-checkmark-fade-out 150ms ease-out forwards; }` (B-1)
- `@theme` 블록 밖: `@media (prefers-reduced-motion: reduce) { [data-seat-checkmark] { animation-duration: 0.01ms; } [data-seat-checkmark][data-fading-out="true"] { animation-duration: 0.01ms; } }` (B-1)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: svg-preview admin 검증 테스트 신규 작성 (reviews revision: descendant data-stage + invalid enum + parse 실패 케이스 추가)</name>
  <files>apps/web/components/admin/__tests__/svg-preview.test.tsx</files>
  <read_first>
    - apps/web/components/admin/svg-preview.tsx (현재 handleSvgUpload 구조 — line 31~62 흐름)
    - apps/web/app/auth/reset-password/__tests__/reset-password.test.tsx (sonner toast mock + apiClient mock + fetch stub 패턴 참조)
    - .planning/phases/12-ux/12-PATTERNS.md §"apps/web/components/admin/__tests__/svg-preview.test.tsx (test) — NEW" (line 456~539)
    - .planning/phases/12-ux/12-RESEARCH.md §"Code Examples / svg-preview.tsx" (line 791~861)
    - .planning/phases/12-ux/12-CONTEXT.md D-06, D-07 UNIFIED PARSING CONTRACT (reviews revision), D-08 (스테이지 마커 검증 정책)
    - **.planning/phases/12-ux/12-REVIEWS.md §"Action Items" HIGH #2 + LOW #7** (descendant data-stage + enum 검증 + try/catch parse 실패 toast)
  </read_first>
  <behavior>
    - Test 1 ("정상 SVG 통과"): `<text>STAGE</text>`를 포함한 SVG 업로드 시 toast.error 미호출 + presignedUpload.mutateAsync 호출됨 + fetch (R2 PUT) 호출됨
    - Test 2 ("root data-stage 속성 통과"): root `<svg data-stage="top">` SVG 업로드 시 동일하게 통과
    - Test 3 ("stage 마커 없는 SVG 거부"): stage 마커 없는 SVG 업로드 시 `toast.error` 가 `expect.stringContaining('스테이지 마커')`로 호출됨 + presignedUpload.mutateAsync 미호출 + fetch 미호출
    - Test 4 ("size 초과 거부 회귀"): 10MB 초과 파일은 기존대로 size 에러 toast 호출 + 검증 진입 자체 안 됨
    - **Test 5 (reviews revision HIGH #2 — descendant data-stage 통과):** `<svg><g data-stage="top"><rect/></g></svg>`처럼 자손 요소에 `data-stage`가 있는 SVG도 통과해야 함. toast.error 미호출 + mutateAsync 호출됨.
    - **Test 6 (reviews revision HIGH #2 — invalid enum 거부):** root `<svg data-stage="invalid-value">`는 거부해야 함. `toast.error`가 `expect.stringContaining('top, right, bottom, left')` 로 호출됨 + mutateAsync 미호출 + fetch 미호출.
    - **Test 7 (reviews revision LOW #7 — parse 실패 toast):** `<svg>unclosed tag ...` 같은 malformed XML 업로드 시 `toast.error`가 `expect.stringContaining('SVG 형식이 올바르지 않습니다')` 호출됨 + mutateAsync 미호출.
  </behavior>
  <action>
실제 파일 내용 (reviews revision 적용 — Test 5, 6, 7 추가):

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { SvgPreview } from '../svg-preview';

// sonner mock — toast.error/success 호출 추적
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// use-admin hook mock — presignedUpload.mutateAsync 호출 여부 추적
const mockMutateAsync = vi.fn();
vi.mock('@/hooks/use-admin', () => ({
  usePresignedUpload: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useSaveSeatMap: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

// TierEditor는 본 테스트 범위 밖 — 단순 stub
vi.mock('@/components/admin/tier-editor', () => ({
  TierEditor: () => <div data-testid="tier-editor" />,
}));

import { toast } from 'sonner';

const SVG_WITH_TEXT_STAGE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><text>STAGE</text><rect data-seat-id="A-1" x="10" y="10" width="32" height="32"/></svg>';

const SVG_WITH_ROOT_DATA_STAGE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" data-stage="top"><rect data-seat-id="A-1" x="10" y="10" width="32" height="32"/></svg>';

const SVG_WITH_DESCENDANT_DATA_STAGE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><g data-stage="top"><rect data-seat-id="A-1" x="10" y="10" width="32" height="32"/></g></svg>';

const SVG_WITH_INVALID_DATA_STAGE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" data-stage="invalid-value"><rect data-seat-id="A-1" x="10" y="10" width="32" height="32"/></svg>';

const SVG_WITHOUT_STAGE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><rect data-seat-id="A-1" x="10" y="10" width="32" height="32"/></svg>';

const MALFORMED_SVG = '<svg><g data-stage="top"><rect data-seat-id="A-1"';

function makeFile(content: string, name = 'test.svg'): File {
  return new File([content], name, { type: 'image/svg+xml' });
}

describe('SvgPreview — UX-02 admin 업로드 검증 (D-06/D-07 unified contract + enum + parse safety)', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockMutateAsync.mockResolvedValue({
      uploadUrl: 'https://r2.example.com/upload',
      publicUrl: 'https://cdn.example.com/seats/test.svg',
    });
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('<text>STAGE</text>를 포함한 SVG 업로드 시 검증 통과 + R2 PUT 호출', async () => {
    const { container } = render(<SvgPreview performanceId="perf-1" />);
    const input = container.querySelector('#svg-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile(SVG_WITH_TEXT_STAGE)] } });

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://r2.example.com/upload',
        expect.objectContaining({ method: 'PUT' }),
      );
    });
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
  });

  it('root data-stage 속성 SVG 업로드 시 검증 통과', async () => {
    const { container } = render(<SvgPreview performanceId="perf-1" />);
    const input = container.querySelector('#svg-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile(SVG_WITH_ROOT_DATA_STAGE)] } });

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
  });

  it('스테이지 마커 없는 SVG 업로드 시 toast.error + R2 PUT 미발생', async () => {
    const { container } = render(<SvgPreview performanceId="perf-1" />);
    const input = container.querySelector('#svg-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile(SVG_WITHOUT_STAGE)] } });

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        expect.stringContaining('스테이지 마커'),
      );
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('10MB 초과 파일은 기존 size 에러 toast가 먼저 호출되어 검증 진입 안 됨', async () => {
    const bigContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
    const { container } = render(<SvgPreview performanceId="perf-1" />);
    const input = container.querySelector('#svg-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile(bigContent, 'big.svg')] } });

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        expect.stringContaining('10MB'),
      );
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  // reviews revision HIGH #2 — unified parsing contract
  it('reviews revision HIGH #2: <g data-stage="top"> descendant SVG 업로드 시 검증 통과', async () => {
    const { container } = render(<SvgPreview performanceId="perf-1" />);
    const input = container.querySelector('#svg-input') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile(SVG_WITH_DESCENDANT_DATA_STAGE)] },
    });

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
  });

  // reviews revision HIGH #2 — enum 검증
  it('reviews revision HIGH #2: data-stage="invalid-value"는 enum 위반으로 거부 + R2 PUT 미발생', async () => {
    const { container } = render(<SvgPreview performanceId="perf-1" />);
    const input = container.querySelector('#svg-input') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile(SVG_WITH_INVALID_DATA_STAGE)] },
    });

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        expect.stringContaining('top, right, bottom, left'),
      );
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // reviews revision LOW #7 — parse 실패 try/catch
  it('reviews revision LOW #7: malformed SVG 업로드 시 parse 실패 toast + R2 PUT 미발생', async () => {
    const { container } = render(<SvgPreview performanceId="perf-1" />);
    const input = container.querySelector('#svg-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile(MALFORMED_SVG)] } });

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        expect.stringContaining('SVG 형식이 올바르지 않습니다'),
      );
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
```

본 task는 **테스트만 작성**한다 — 구현(svg-preview.tsx 검증 로직 추가)은 Plan 12-02에서 수행. Wave 0 종료 시 Test 3/5/6/7 등은 RED(실패) 상태가 되며, 12-02 완료 후 GREEN으로 전환.

주의:
- file.size 검증은 현재 코드에 이미 존재 → Test 4 "10MB 초과 회귀"는 GREEN으로 시작 (회귀 가드).
- jsdom에 DOMParser는 기본 제공 → 구현 단계에서 별도 polyfill 불필요.
- TierEditor는 본 테스트 범위 밖이므로 stub 처리.
- **Test 6의 invalid-value 에러 메시지 카피:** CONTEXT.md D-06/D-07 unified parsing contract에 따라 enum 위반은 `top, right, bottom, left` 리스트를 문자열로 포함해야 함 — Plan 12-02 Task 2가 정확한 카피를 구현.
- **Test 7 malformed SVG:** DOMParser는 invalid XML에 대해 `documentElement.tagName === 'parsererror'`를 반환하거나 throw — svg-preview 구현은 try/catch + parsererror 체크 양쪽 커버.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/web test -- svg-preview --run 2>&1 | tail -40</automated>
  </verify>
  <acceptance_criteria>
    - 파일 존재: `test -f /Users/sangwopark19/icons/grapit/apps/web/components/admin/__tests__/svg-preview.test.tsx`
    - grep 검증 (테스트 케이스 카운트 ≥ 7):
      - `grep -c "^\s*it(" /Users/sangwopark19/icons/grapit/apps/web/components/admin/__tests__/svg-preview.test.tsx` → 출력 ≥ 7
    - grep 검증 (sonner mock 패턴 존재):
      - `grep -q "vi.mock('sonner'" /Users/sangwopark19/icons/grapit/apps/web/components/admin/__tests__/svg-preview.test.tsx`
    - grep 검증 (`스테이지 마커` 카피 검증 케이스 존재):
      - `grep -q "스테이지 마커" /Users/sangwopark19/icons/grapit/apps/web/components/admin/__tests__/svg-preview.test.tsx`
    - grep 검증 (mockMutateAsync 호출 여부 assertion 존재):
      - `grep -q "mockMutateAsync" /Users/sangwopark19/icons/grapit/apps/web/components/admin/__tests__/svg-preview.test.tsx`
    - **reviews revision HIGH #2 검증:**
      - `grep -q "SVG_WITH_DESCENDANT_DATA_STAGE" /Users/sangwopark19/icons/grapit/apps/web/components/admin/__tests__/svg-preview.test.tsx`
      - `grep -q "SVG_WITH_INVALID_DATA_STAGE" /Users/sangwopark19/icons/grapit/apps/web/components/admin/__tests__/svg-preview.test.tsx`
      - `grep -q "top, right, bottom, left" /Users/sangwopark19/icons/grapit/apps/web/components/admin/__tests__/svg-preview.test.tsx`
      - `grep -q '<g data-stage="top">' /Users/sangwopark19/icons/grapit/apps/web/components/admin/__tests__/svg-preview.test.tsx`
    - **reviews revision LOW #7 검증:**
      - `grep -q "MALFORMED_SVG" /Users/sangwopark19/icons/grapit/apps/web/components/admin/__tests__/svg-preview.test.tsx`
      - `grep -q "SVG 형식이 올바르지 않습니다" /Users/sangwopark19/icons/grapit/apps/web/components/admin/__tests__/svg-preview.test.tsx`
    - vitest 실행 시 (구현 전이므로 RED 허용): exit code 0 또는 1, 신규 케이스가 FAIL로 카운트되거나 PASS. 어느 쪽이든 케이스가 실행에 포함됨.
    - typecheck 회귀 없음: `pnpm --filter @grapit/web typecheck` exit 0
  </acceptance_criteria>
  <done>
svg-preview.test.tsx가 7개 케이스로 작성되어 vitest에 의해 실행되며, 12-02의 구현이 GREEN으로 전환할 검증 진입점이 마련됨. HIGH #2 (descendant + invalid enum) + LOW #7 (parse 실패 toast) 커버.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: useIsMobile hook 테스트 신규 작성 (B-4: getServerSnapshot named export 케이스 포함)</name>
  <files>apps/web/hooks/__tests__/use-is-mobile.test.ts</files>
  <read_first>
    - apps/web/hooks/use-countdown.ts (`'use client'` + 함수형 단일 export hook 구조 참조)
    - apps/web/hooks/__tests__/use-countdown.test.ts (renderHook + vi.useFakeTimers/stubGlobal 패턴 참조)
    - .planning/phases/12-ux/12-PATTERNS.md §"apps/web/hooks/__tests__/use-is-mobile.test.ts (test) — NEW" (line 542~629)
    - .planning/phases/12-ux/12-RESEARCH.md §"Pattern 3: useSyncExternalStore" (line 313~385)
    - .planning/phases/12-ux/12-CONTEXT.md D-17 (모바일 자동 1.4x 줌 정책)
  </read_first>
  <behavior>
    - Test 1: matchMedia가 매치되지 않을 때(`matches: false`) useIsMobile이 false 반환
    - Test 2: matchMedia가 매치될 때(`matches: true`) useIsMobile이 true 반환
    - Test 3: matchMedia change 이벤트 발생 시 hook이 새 값으로 리렌더링됨 (subscribe → callback 호출 → 재구독으로 새 snapshot 반영)
    - **Test 4 (B-4): getServerSnapshot named export가 SSR fallback false를 반환** — `import { getServerSnapshot } from '@/hooks/use-is-mobile'` 직접 호출
  </behavior>
  <action>
실제 파일 내용 (B-4: Test 4 추가):

```ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Helper: matchMedia mock factory — 동적으로 matches 값 변경 가능
type ChangeListener = () => void;

interface MockMql {
  matches: boolean;
  addEventListener: (event: string, cb: ChangeListener) => void;
  removeEventListener: (event: string, cb: ChangeListener) => void;
}

function createMockMatchMedia(initialMatches: boolean): {
  matchMedia: (query: string) => MockMql;
  setMatches: (next: boolean) => void;
  triggerChange: () => void;
} {
  let currentMatches = initialMatches;
  const listeners: ChangeListener[] = [];
  const matchMedia = (_query: string): MockMql => ({
    get matches() {
      return currentMatches;
    },
    addEventListener: (_event: string, cb: ChangeListener) => {
      listeners.push(cb);
    },
    removeEventListener: (_event: string, cb: ChangeListener) => {
      const idx = listeners.indexOf(cb);
      if (idx >= 0) listeners.splice(idx, 1);
    },
  });
  return {
    matchMedia,
    setMatches: (next: boolean) => {
      currentMatches = next;
    },
    triggerChange: () => {
      listeners.forEach((cb) => cb());
    },
  };
}

describe('useIsMobile (UX-06 D-17)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('데스크톱 viewport(max-width: 767px 미일치)에서 false 반환', async () => {
    const harness = createMockMatchMedia(false);
    vi.stubGlobal('matchMedia', harness.matchMedia);
    Object.defineProperty(window, 'matchMedia', {
      value: harness.matchMedia,
      writable: true,
      configurable: true,
    });

    const { useIsMobile } = await import('../use-is-mobile');
    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it('모바일 viewport(max-width: 767px 일치)에서 true 반환', async () => {
    const harness = createMockMatchMedia(true);
    vi.stubGlobal('matchMedia', harness.matchMedia);
    Object.defineProperty(window, 'matchMedia', {
      value: harness.matchMedia,
      writable: true,
      configurable: true,
    });

    const { useIsMobile } = await import('../use-is-mobile');
    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it('matchMedia change 이벤트로 hook 결과 변경', async () => {
    const harness = createMockMatchMedia(false);
    vi.stubGlobal('matchMedia', harness.matchMedia);
    Object.defineProperty(window, 'matchMedia', {
      value: harness.matchMedia,
      writable: true,
      configurable: true,
    });

    const { useIsMobile } = await import('../use-is-mobile');
    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);

    act(() => {
      harness.setMatches(true);
      harness.triggerChange();
    });

    expect(result.current).toBe(true);
  });

  // B-4: SSR fallback 정합성 자동 검증 — getServerSnapshot named export 직접 호출
  it('getServerSnapshot returns false for SSR safety (B-4)', async () => {
    const { getServerSnapshot } = await import('../use-is-mobile');
    expect(getServerSnapshot()).toBe(false);
  });
});
```

주의:
- 본 task는 **테스트만 작성** — 구현(`apps/web/hooks/use-is-mobile.ts`)은 Plan 12-02 Task 1에서 수행 (getServerSnapshot named export 포함).
- `await import('../use-is-mobile')`은 Plan 12-02 완료 전에는 모듈이 없으므로 import 자체가 실패 → 모든 케이스 RED. 12-02 완료 후 GREEN.
- jsdom 환경에 `window.matchMedia`는 기본 미정의 — `Object.defineProperty(window, 'matchMedia', ...)`로 명시적 set 필요.
- B-4 Test 4: getServerSnapshot은 hook이 아닌 단순 함수 — renderHook 불필요. `await import` 후 직접 호출. Plan 12-02 Task 1이 `export function getServerSnapshot(): boolean` named export로 노출하면 자동 GREEN.
- **B-4가 SSR fallback 자동 검증 1단**, Wave 4 manual QA의 hydration warning 검증이 자동 검증 2단(이중 가드).
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/web test -- use-is-mobile --run 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - 파일 존재: `test -f /Users/sangwopark19/icons/grapit/apps/web/hooks/__tests__/use-is-mobile.test.ts`
    - grep 검증 (케이스 카운트 ≥ 4 — B-4 추가):
      - `grep -c "^\s*it(" /Users/sangwopark19/icons/grapit/apps/web/hooks/__tests__/use-is-mobile.test.ts` → 출력 ≥ 4
    - grep 검증 (renderHook + matchMedia mock 패턴):
      - `grep -q "renderHook" /Users/sangwopark19/icons/grapit/apps/web/hooks/__tests__/use-is-mobile.test.ts`
      - `grep -q "matchMedia" /Users/sangwopark19/icons/grapit/apps/web/hooks/__tests__/use-is-mobile.test.ts`
    - **B-4: getServerSnapshot 케이스 검증:**
      - `grep -q "getServerSnapshot" /Users/sangwopark19/icons/grapit/apps/web/hooks/__tests__/use-is-mobile.test.ts`
      - `grep -q "SSR safety" /Users/sangwopark19/icons/grapit/apps/web/hooks/__tests__/use-is-mobile.test.ts` 또는 `grep -q "B-4" /Users/sangwopark19/icons/grapit/apps/web/hooks/__tests__/use-is-mobile.test.ts`
    - vitest 실행 (구현 전): exit code 1 (모듈 import 실패 또는 케이스 FAIL) 허용. Wave 0 게이트는 "케이스가 카운트되어 실행 시도됨"으로 충분.
    - typecheck 회귀 없음: `pnpm --filter @grapit/web typecheck` exit 0
  </acceptance_criteria>
  <done>
use-is-mobile.test.ts가 4개 케이스(B-4 getServerSnapshot 케이스 포함)로 작성되어 12-02 Task 1의 구현 검증 진입점이 마련됨. SSR fallback 정합성 자동 검증 1단 확립.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: seat-map-viewer 테스트 mock 확장 (B-3 vi.hoisted) + 9 신규 케이스 추가 (reviews revision: rapid reselect race guard + descendant data-stage + selected+locked broadcast 회귀)</name>
  <files>apps/web/components/booking/__tests__/seat-map-viewer.test.tsx</files>
  <read_first>
    - apps/web/components/booking/__tests__/seat-map-viewer.test.tsx (전체 — 라인 7~22 mock 구조, 라인 39~234 기존 케이스 6건)
    - apps/web/components/booking/seat-map-viewer.tsx (라인 84~131 좌석 분기, 라인 276~303 TransformWrapper 구조)
    - .planning/phases/12-ux/12-PATTERNS.md §"apps/web/components/booking/__tests__/seat-map-viewer.test.tsx (test) — UPDATE" (line 633~793)
    - .planning/phases/12-ux/12-RESEARCH.md §"Wave 0 Gaps" (line 1017~1023)
    - .planning/phases/12-ux/12-RESEARCH.md §"Pitfall 3" (line 508~513) — useEffect 기반 fill 변경 권장
    - .planning/phases/12-ux/12-CONTEXT.md D-06/D-07 UNIFIED PARSING CONTRACT (reviews revision), D-07/D-11/D-12/D-13/D-13 CLARIFICATION/D-14/D-16/D-17 (검증 대상 행위)
    - .planning/phases/12-ux/12-UI-SPEC.md §"Interaction & State Contract" 라인 240~241 (선택 fade-in / 해제 fade-out + setTimeout 150ms)
    - **.planning/phases/12-ux/12-REVIEWS.md §"Action Items" HIGH #1 (per-seat timeout race guard) + HIGH #2 (descendant data-stage) + MED #4 (selected+locked 회귀)**
    - vitest docs §"vi.hoisted" — module top-level const를 mock factory에서 안전 참조하기 위한 표준 패턴 (B-3)
  </read_first>
  <behavior>
    - 기존 6 케이스 유지 (available/locked/click/sold-skip/selected stroke/error)
    - 신규 9 케이스 추가:
      1. **B-2-RESIDUAL-V2 Option C**: 선택 좌석에 useEffect가 적용한 `el.style.transition`에 `fill 150ms` 포함 + `getAttribute('fill')`이 primary `#6C3CE0`으로 변경됨 검증
      2. locked 좌석은 `transition:none` 유지 (D-13 회귀 방지)
      3. 선택 좌석에 `data-seat-checkmark` 속성을 가진 `<text>` 요소 존재 (UX-04 mount fade-in)
      4. 데스크톱(`isMobile=false`) 시 MiniMap 마운트 + 모바일(`isMobile=true`) 시 MiniMap 미마운트 (UX-05)
      5. `isMobile=true` 시 TransformWrapper에 `initialScale=1.4` prop 전달 (UX-06)
      6. SVG에 root `data-stage="top"`만 있을 때 viewer가 `<text>STAGE</text>` 오버레이를 추가 (UX-02 viewer)
      7. **B-2-RESIDUAL Option C**: 해제 시 체크마크에 `data-fading-out="true"` 속성이 잠시 부여되고 160ms 후 DOM에서 제거됨
      8. **reviews revision HIGH #1 (race guard)**: 선택 → 해제(80ms 진행) → 재선택(재선택 직후) → 200ms 추가 진행 시퀀스에서 해당 좌석의 체크마크 `data-fading-out` 속성이 stuck되지 않음 (`data-fading-out="true"`가 DOM에 남아있지 않아야 함) + 체크마크 element는 유지
      9. **reviews revision HIGH #2 (viewer descendant data-stage)**: `<svg><g data-stage="right">` descendant SVG에서 viewer가 STAGE 오버레이 생성 + 배지 x 좌표가 우측(viewBox width에 가까운 값)에 위치 (기본 badge width 120 + padding 12 기준으로 `vbW - 120 - 12` 근방)
      10. **reviews revision MED #4 (selected+locked broadcast 회귀)**: 좌석 A-1이 selectedSeatIds에 포함되어 있고 seatStates.get('A-1') === 'locked'인 경우, useEffect가 fill을 primary로 바꾸지 않고 LOCKED_COLOR 유지 + `transition:none` 유지 (D-13 BROADCAST PRIORITY)
  </behavior>
  <action>
다음 변경을 적용한다 (현재 파일을 그대로 두고 mock 블록 + 신규 케이스만 패치).

1) **라인 7~18 mock 확장 — B-3 vi.hoisted 적용**:

기존:
```tsx
vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="transform-wrapper">{children}</div>
  ),
  TransformComponent: ({
    children,
  }: {
    children: React.ReactNode;
    wrapperClass?: string;
    contentClass?: string;
  }) => <div data-testid="transform-component">{children}</div>,
}));
```

변경 후:
```tsx
// B-3: vi.hoisted로 mock factory가 참조할 const들을 hoist-safe하게 선언
const { transformWrapperSpy, mockUseIsMobile, miniMapSpy } = vi.hoisted(() => ({
  transformWrapperSpy: vi.fn(),
  mockUseIsMobile: vi.fn(() => false),
  miniMapSpy: vi.fn(() => null),
}));

vi.mock('@/hooks/use-is-mobile', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

vi.mock('react-zoom-pan-pinch', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TransformWrapper: (props: any) => {
    transformWrapperSpy(props);
    return (
      <div data-testid="transform-wrapper">
        {typeof props.children === 'function'
          ? props.children({
              zoomIn: vi.fn(),
              zoomOut: vi.fn(),
              resetTransform: vi.fn(),
            })
          : props.children}
      </div>
    );
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TransformComponent: ({ children }: any) => (
    <div data-testid="transform-component">{children}</div>
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  MiniMap: (props: any) => {
    miniMapSpy(props);
    return <div data-testid="minimap" />;
  },
}));
```

2) **beforeEach 리셋 로직 추가**:

```tsx
beforeEach(() => {
  transformWrapperSpy.mockClear();
  mockUseIsMobile.mockReset();
  mockUseIsMobile.mockReturnValue(false);
  miniMapSpy.mockClear();
  global.fetch = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(SVG_CONTENT) });
});
```

3) **기존 6 케이스 유지 + 신규 9 케이스 추가** (describe 블록 끝부분):

```tsx
  // 신규 케이스 1 (B-2-RESIDUAL-V2 Option C): useEffect가 fill을 primary로 변경 + transition 부여
  it('B-2-RESIDUAL-V2 Option C: 선택 좌석에 useEffect가 el.style.transition=fill 150ms 부여 + fill primary 변경 (UX-04)', async () => {
    const seatStates = new Map<string, SeatState>([['A-1', 'available']]);
    const { container } = render(
      <SeatMapViewer
        svgUrl="https://example.com/seats.svg"
        seatConfig={mockSeatConfig}
        seatStates={seatStates}
        selectedSeatIds={new Set(['A-1'])}
        onSeatClick={() => {}}
        maxSelect={4}
      />,
    );
    await waitFor(() => {
      const seatA1 = container.querySelector('[data-seat-id="A-1"]') as SVGElement;
      expect(seatA1).toBeTruthy();
      expect(seatA1.style.transition).toContain('fill 150ms');
    });
    await waitFor(() => {
      const seatA1 = container.querySelector('[data-seat-id="A-1"]') as SVGElement;
      const fill = seatA1.getAttribute('fill') ?? '';
      expect(fill.toLowerCase()).toMatch(/#6c3ce0|var\(--color-primary\)/);
    });
  });

  // 신규 케이스 2: locked 좌석 transition:none 회귀 (D-13)
  it('locked 좌석은 transition:none을 유지한다 (D-13 회귀 방지)', async () => {
    const seatStates = new Map<string, SeatState>([['A-1', 'locked']]);
    const { container } = render(
      <SeatMapViewer
        svgUrl="https://example.com/seats.svg"
        seatConfig={mockSeatConfig}
        seatStates={seatStates}
        selectedSeatIds={new Set()}
        onSeatClick={() => {}}
        maxSelect={4}
      />,
    );
    await waitFor(() => {
      const seatA1 = container.querySelector('[data-seat-id="A-1"]') as SVGElement;
      const styleAttr = seatA1.getAttribute('style') ?? '';
      expect(styleAttr).toContain('transition:none');
    });
  });

  // 신규 케이스 3: 선택 좌석 data-seat-checkmark (UX-04 mount fade-in)
  it('선택 좌석에 data-seat-checkmark 속성을 가진 <text> 요소가 삽입된다 (UX-04)', async () => {
    const seatStates = new Map<string, SeatState>([['A-1', 'available']]);
    const { container } = render(
      <SeatMapViewer
        svgUrl="https://example.com/seats.svg"
        seatConfig={mockSeatConfig}
        seatStates={seatStates}
        selectedSeatIds={new Set(['A-1'])}
        onSeatClick={() => {}}
        maxSelect={4}
      />,
    );
    await waitFor(() => {
      const checkmark = container.querySelector('[data-seat-checkmark]');
      expect(checkmark).toBeTruthy();
      expect(checkmark?.tagName.toLowerCase()).toBe('text');
    });
  });

  // 신규 케이스 4: MiniMap 마운트 분기 (UX-05)
  it('데스크톱(isMobile=false)에서 MiniMap 마운트, 모바일(true)에서 미마운트 (UX-05)', async () => {
    mockUseIsMobile.mockReturnValue(false);
    const { container, unmount } = render(
      <SeatMapViewer
        svgUrl="https://example.com/seats.svg"
        seatConfig={mockSeatConfig}
        seatStates={new Map()}
        selectedSeatIds={new Set()}
        onSeatClick={() => {}}
        maxSelect={4}
      />,
    );
    await waitFor(() => {
      expect(container.querySelector('[data-testid="minimap"]')).toBeTruthy();
    });
    unmount();

    mockUseIsMobile.mockReturnValue(true);
    const { container: mobileContainer } = render(
      <SeatMapViewer
        svgUrl="https://example.com/seats.svg"
        seatConfig={mockSeatConfig}
        seatStates={new Map()}
        selectedSeatIds={new Set()}
        onSeatClick={() => {}}
        maxSelect={4}
      />,
    );
    await waitFor(() => {
      expect(mobileContainer.querySelector('[data-testid="transform-wrapper"]')).toBeTruthy();
    });
    expect(mobileContainer.querySelector('[data-testid="minimap"]')).toBeFalsy();
  });

  // 신규 케이스 5: 모바일 initialScale=1.4 (UX-06)
  it('isMobile=true 시 TransformWrapper에 initialScale=1.4 전달 (UX-06)', async () => {
    mockUseIsMobile.mockReturnValue(true);
    render(
      <SeatMapViewer
        svgUrl="https://example.com/seats.svg"
        seatConfig={mockSeatConfig}
        seatStates={new Map()}
        selectedSeatIds={new Set()}
        onSeatClick={() => {}}
        maxSelect={4}
      />,
    );
    await waitFor(() => {
      expect(transformWrapperSpy).toHaveBeenCalledWith(
        expect.objectContaining({ initialScale: 1.4 }),
      );
    });
  });

  // 신규 케이스 6: STAGE 배지 오버레이 (UX-02 viewer — root data-stage)
  it('SVG에 root data-stage 속성만 있을 때 viewer가 STAGE <text> 오버레이를 추가한다 (UX-02)', async () => {
    const SVG_WITH_ROOT_DATA_STAGE_ONLY = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" data-stage="top">
  <rect data-seat-id="A-1" x="10" y="50" width="32" height="32"/>
</svg>
`;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SVG_WITH_ROOT_DATA_STAGE_ONLY),
    });
    const { container } = render(
      <SeatMapViewer
        svgUrl="https://example.com/data-stage.svg"
        seatConfig={mockSeatConfig}
        seatStates={new Map()}
        selectedSeatIds={new Set()}
        onSeatClick={() => {}}
        maxSelect={4}
      />,
    );
    await waitFor(() => {
      const stageText = Array.from(container.querySelectorAll('text')).find(
        (t) => t.textContent?.trim() === 'STAGE',
      );
      expect(stageText).toBeTruthy();
    });
  });

  // 신규 케이스 7 (B-2-RESIDUAL): 해제 시 체크마크 data-fading-out + 160ms 후 DOM 제거
  it('B-2-RESIDUAL: 해제 시 체크마크에 data-fading-out="true" 부여되고 160ms 후 DOM에서 제거됨', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const seatStates = new Map<string, SeatState>([['A-1', 'available']]);

      const { container, rerender } = render(
        <SeatMapViewer
          svgUrl="https://example.com/seats.svg"
          seatConfig={mockSeatConfig}
          seatStates={seatStates}
          selectedSeatIds={new Set(['A-1'])}
          onSeatClick={() => {}}
          maxSelect={4}
        />,
      );

      await vi.waitFor(() => {
        const checkmark = container.querySelector('[data-seat-checkmark]');
        expect(checkmark).toBeTruthy();
      });

      rerender(
        <SeatMapViewer
          svgUrl="https://example.com/seats.svg"
          seatConfig={mockSeatConfig}
          seatStates={seatStates}
          selectedSeatIds={new Set()}
          onSeatClick={() => {}}
          maxSelect={4}
        />,
      );

      await vi.waitFor(() => {
        const checkmarkDuringFadeOut = container.querySelector('[data-seat-checkmark]');
        expect(checkmarkDuringFadeOut).toBeTruthy();
        expect(checkmarkDuringFadeOut?.getAttribute('data-fading-out')).toBe('true');
      });

      await act(async () => {
        vi.advanceTimersByTime(160);
      });
      await vi.waitFor(() => {
        const checkmarkAfterRemoval = container.querySelector('[data-seat-checkmark]');
        expect(checkmarkAfterRemoval).toBeFalsy();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  // 신규 케이스 8 (reviews revision HIGH #1): 빠른 해제→재선택 race guard
  it('reviews revision HIGH #1: 해제(80ms) → 재선택 → 200ms 진행 시퀀스에서 data-fading-out이 stuck되지 않음', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const seatStates = new Map<string, SeatState>([['A-1', 'available']]);

      // Phase 1: A-1 선택 → 체크마크 마운트
      const { container, rerender } = render(
        <SeatMapViewer
          svgUrl="https://example.com/seats.svg"
          seatConfig={mockSeatConfig}
          seatStates={seatStates}
          selectedSeatIds={new Set(['A-1'])}
          onSeatClick={() => {}}
          maxSelect={4}
        />,
      );

      await vi.waitFor(() => {
        expect(container.querySelector('[data-seat-checkmark]')).toBeTruthy();
      });

      // Phase 2: A-1 해제 → data-fading-out="true" 부여됨
      rerender(
        <SeatMapViewer
          svgUrl="https://example.com/seats.svg"
          seatConfig={mockSeatConfig}
          seatStates={seatStates}
          selectedSeatIds={new Set()}
          onSeatClick={() => {}}
          maxSelect={4}
        />,
      );

      await vi.waitFor(() => {
        const fading = container.querySelector('[data-seat-checkmark][data-fading-out="true"]');
        expect(fading).toBeTruthy();
      });

      // Phase 3: 80ms 진행 (타이머 만료 전)
      await act(async () => {
        vi.advanceTimersByTime(80);
      });

      // Phase 4: 재선택 — 기존 timeout이 cleared 되어야 함 + data-fading-out 즉시 제거
      rerender(
        <SeatMapViewer
          svgUrl="https://example.com/seats.svg"
          seatConfig={mockSeatConfig}
          seatStates={seatStates}
          selectedSeatIds={new Set(['A-1'])}
          onSeatClick={() => {}}
          maxSelect={4}
        />,
      );

      // Phase 5: 추가 200ms 진행 — 과거 timeout이 cleared 되지 않았다면 여기서 DOM 제거 + data-fading-out stuck 발생
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // 검증: 체크마크 DOM에 존재 + data-fading-out 속성 없음 (stuck 방지)
      await vi.waitFor(() => {
        const checkmark = container.querySelector('[data-seat-checkmark]');
        expect(checkmark).toBeTruthy();
        expect(checkmark?.getAttribute('data-fading-out')).toBeNull();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  // 신규 케이스 9 (reviews revision HIGH #2): <g data-stage="right"> descendant SVG에서 viewer가 우측 STAGE 오버레이 생성
  it('reviews revision HIGH #2: <g data-stage="right"> descendant SVG에서 viewer가 우측 STAGE 오버레이 생성', async () => {
    const SVG_WITH_DESCENDANT_RIGHT = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
  <g data-stage="right">
    <rect data-seat-id="A-1" x="10" y="50" width="32" height="32"/>
  </g>
</svg>
`;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SVG_WITH_DESCENDANT_RIGHT),
    });
    const { container } = render(
      <SeatMapViewer
        svgUrl="https://example.com/descendant-right.svg"
        seatConfig={mockSeatConfig}
        seatStates={new Map()}
        selectedSeatIds={new Set()}
        onSeatClick={() => {}}
        maxSelect={4}
      />,
    );
    await waitFor(() => {
      const stageText = Array.from(container.querySelectorAll('text')).find(
        (t) => t.textContent?.trim() === 'STAGE',
      );
      expect(stageText).toBeTruthy();
    });
    // 우측 배지: x 좌표가 viewBox width (400)에 가까움 (badgeWidth=120, padding=12 기준 우측 근방)
    const stageTextEl = Array.from(container.querySelectorAll('text')).find(
      (t) => t.textContent?.trim() === 'STAGE',
    );
    const xAttr = parseFloat(stageTextEl?.getAttribute('x') ?? '0');
    // 우측에 배치 → x는 viewBox width의 절반을 초과해야 함 (400의 중앙인 200보다 커야 함)
    expect(xAttr).toBeGreaterThan(200);
  });

  // 신규 케이스 10 (reviews revision MED #4): selected + locked broadcast 회귀 — D-13 BROADCAST PRIORITY
  it('reviews revision MED #4 (D-13 BROADCAST PRIORITY): 선택 좌석이 broadcast로 locked 전환 시 fill LOCKED_COLOR 유지 + transition 없음', async () => {
    // Phase 1: A-1이 selected + available
    const { container, rerender } = render(
      <SeatMapViewer
        svgUrl="https://example.com/seats.svg"
        seatConfig={mockSeatConfig}
        seatStates={new Map<string, SeatState>([['A-1', 'available']])}
        selectedSeatIds={new Set(['A-1'])}
        onSeatClick={() => {}}
        maxSelect={4}
      />,
    );

    await waitFor(() => {
      const seatA1 = container.querySelector('[data-seat-id="A-1"]') as SVGElement;
      expect(seatA1).toBeTruthy();
    });

    // Phase 2: 같은 selectedSeatIds 유지하면서 seatStates만 broadcast로 locked 전환
    rerender(
      <SeatMapViewer
        svgUrl="https://example.com/seats.svg"
        seatConfig={mockSeatConfig}
        seatStates={new Map<string, SeatState>([['A-1', 'locked']])}
        selectedSeatIds={new Set(['A-1'])}
        onSeatClick={() => {}}
        maxSelect={4}
      />,
    );

    await waitFor(() => {
      const seatA1 = container.querySelector('[data-seat-id="A-1"]') as SVGElement;
      const fill = seatA1.getAttribute('fill') ?? '';
      // D-13: locked color (#D1D5DB)로 유지, primary 색 X
      expect(fill.toLowerCase()).toBe('#d1d5db');
      // transition이 fill 150ms로 적용되지 않아야 함 (useEffect가 skip)
      const styleAttr = seatA1.getAttribute('style') ?? '';
      expect(styleAttr).toContain('transition:none');
    });
  });
```

주의:
- 본 task 완료 후 vitest 실행 시 신규 10 케이스는 대부분 RED. 12-03 viewer 변경 완료 후 GREEN으로 전환.
- 기존 6 케이스는 mock 확장(B-3 vi.hoisted)만으로 변동 없으므로 GREEN 유지가 acceptance criteria.
- **reviews revision HIGH #1 Test 8:** Plan 12-03 Task 2의 per-seat timeout Map 재설계 후 GREEN 전환.
- **reviews revision HIGH #2 Test 9:** Plan 12-03 Task 2의 descendant querySelector + viewBox min-x/min-y 파싱 후 GREEN 전환.
- **reviews revision MED #4 Test 10:** Plan 12-03 Task 3의 useEffect가 `seatStates.get(seatId)` 체크로 primary 색 skip 후 GREEN 전환.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/web test -- seat-map-viewer --run 2>&1 | tail -60 && echo "---REF ERROR CHECK---" && pnpm --filter @grapit/web test -- seat-map-viewer.test.tsx 2>&1 | grep -c "ReferenceError" || echo "0"</automated>
  </verify>
  <acceptance_criteria>
    - 파일이 존재하고 변경됨: `test -f /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
    - mock 확장 grep (B-3 vi.hoisted 적용):
      - `grep -q "vi.hoisted" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "MiniMap:" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "transformWrapperSpy" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "@/hooks/use-is-mobile" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "miniMapSpy" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
    - 기존 신규 6 케이스 grep:
      - `grep -q "seatA1.style.transition" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "fill 150ms" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "6c3ce0\\|6C3CE0" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "data-seat-checkmark" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q 'data-testid="minimap"' /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "initialScale: 1.4" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "data-stage" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "data-fading-out" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "advanceTimersByTime(160)" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
    - **reviews revision 신규 케이스 grep:**
      - `grep -q "reviews revision HIGH #1" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "advanceTimersByTime(80)" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "advanceTimersByTime(200)" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "reviews revision HIGH #2" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q 'data-stage="right"' /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "reviews revision MED #4" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "D-13 BROADCAST PRIORITY" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "#d1d5db" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
    - 케이스 카운트 ≥ 15 (기존 6 + 신규 10 중 10):
      - `grep -c "^\s*it(" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx` → 출력 ≥ 15
    - **B-3 ReferenceError 검증**: 케이스가 ReferenceError 없이 import 단계 통과
      - `pnpm --filter @grapit/web test -- seat-map-viewer.test.tsx 2>&1 | grep -c "ReferenceError"` → 출력 0
    - vitest 실행 시 (Wave 0 단계 — viewer 미변경): 기존 6 케이스 PASS, 신규 10 케이스는 FAIL 또는 SKIP 상태로 카운트되어 출력에 등장.
    - typecheck 회귀 없음: `pnpm --filter @grapit/web typecheck` exit 0
  </acceptance_criteria>
  <done>
seat-map-viewer.test.tsx가 mock 확장 (B-3 vi.hoisted 적용 + MiniMap + useIsMobile) + 신규 10 케이스 추가 완료 (reviews revision: rapid reselect race guard + descendant data-stage + selected+locked broadcast 회귀 3건 포함). 기존 6 회귀 케이스는 GREEN 유지. ReferenceError 0건 (B-3). 12-03 구현 후 신규 케이스도 GREEN 전환 가능한 상태.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4 (W-2): prefixSvgDefsIds helper 단위 테스트 5건 신규 작성 — reviews revision: dynamic import 방식 (Option B, MED #6)</name>
  <files>apps/web/components/booking/__utils__/__tests__/prefix-svg-defs-ids.test.ts</files>
  <read_first>
    - .planning/phases/12-ux/12-RESEARCH.md §"Pitfall 6: SVG <defs> ID 충돌" (line 529~536) — 헬퍼 검증 케이스 도출
    - .planning/phases/12-ux/12-RESEARCH.md §"Open Questions Q3" (line 950~953) — W-6 단기 처리 권장
    - **.planning/phases/12-ux/12-REVIEWS.md §"Action Items" MED #6** — Wave 0 typecheck gate 보장: dynamic import vs production stub 중 Option B 채택 rationale
  </read_first>
  <behavior>
    - Test 1: `<defs>` 없는 SVG → 원본 그대로 반환
    - Test 2: `<defs>` 안 ID 1개 → ID에 'mini-' 접두사 + url(#) 동시 치환
    - Test 3: `<defs>` 안 ID 다수 → 모두 치환
    - Test 4: ID에 정규식 메타문자(`gradient.1`) → escape 동작
    - Test 5: parse 실패 (잘못된 XML) → graceful 원본 반환
    - **모든 테스트는 dynamic import 방식** (`const { prefixSvgDefsIds } = await import('../prefix-svg-defs-ids')`) — Wave 0 단계에서 모듈 부재 시 typecheck exit 0 보장 (reviews revision MED #6 Option B)
  </behavior>
  <action>
실제 파일 내용 (reviews revision: dynamic import 방식 — Option B 채택):

```ts
import { describe, it, expect } from 'vitest';

/**
 * reviews revision MED #6 Option B: dynamic import 방식.
 *
 * Wave 0 단계에서 `apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts` 모듈은
 * 아직 존재하지 않는다 (Plan 12-03 Task 1에서 생성). 정적 top-level import를 사용하면
 * TypeScript strict 설정에 따라 Wave 0 typecheck가 실패할 수 있다.
 *
 * 각 it() 안에서 `await import(...)`을 사용하면:
 *   1. typecheck 단계: dynamic import는 런타임 검사이므로 모듈 부재로 실패하지 않음
 *   2. vitest 실행 시: Wave 0에서 모듈 부재 → import 실패 → 케이스 RED (예상 동작)
 *   3. Plan 12-03 Task 1 완료 시: 모듈 존재 → 케이스 GREEN 전환
 */

describe('prefixSvgDefsIds (W-2: SVG <defs> ID 충돌 방지)', () => {
  it('<defs> 없는 SVG는 원본 그대로 반환', async () => {
    const { prefixSvgDefsIds } = await import('../prefix-svg-defs-ids');
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><rect data-seat-id="A-1" x="10" y="10" width="32" height="32"/></svg>';
    const result = prefixSvgDefsIds(svg, 'mini-');
    expect(result).toBe(svg);
  });

  it('<defs> 안 ID 1개 → ID에 prefix 부여 + url(#) 일괄 치환', async () => {
    const { prefixSvgDefsIds } = await import('../prefix-svg-defs-ids');
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">' +
      '<defs><linearGradient id="grad1"><stop offset="0%" stop-color="#fff"/></linearGradient></defs>' +
      '<rect x="0" y="0" width="100" height="100" fill="url(#grad1)"/>' +
      '</svg>';
    const result = prefixSvgDefsIds(svg, 'mini-');
    expect(result).toContain('id="mini-grad1"');
    expect(result).toContain('url(#mini-grad1)');
    expect(result).not.toContain('id="grad1"');
    expect(result).not.toContain('url(#grad1)');
  });

  it('<defs> 안 ID 다수 → 모두 치환', async () => {
    const { prefixSvgDefsIds } = await import('../prefix-svg-defs-ids');
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">' +
      '<defs>' +
      '<linearGradient id="g1"><stop offset="0%"/></linearGradient>' +
      '<linearGradient id="g2"><stop offset="100%"/></linearGradient>' +
      '<pattern id="pat1"><circle cx="5" cy="5" r="2"/></pattern>' +
      '</defs>' +
      '<rect fill="url(#g1)"/><rect fill="url(#g2)"/><rect fill="url(#pat1)"/>' +
      '</svg>';
    const result = prefixSvgDefsIds(svg, 'mini-');
    expect(result).toContain('id="mini-g1"');
    expect(result).toContain('id="mini-g2"');
    expect(result).toContain('id="mini-pat1"');
    expect(result).toContain('url(#mini-g1)');
    expect(result).toContain('url(#mini-g2)');
    expect(result).toContain('url(#mini-pat1)');
  });

  it('ID에 정규식 메타문자가 포함되어도 escape되어 정상 치환 (gradient.1)', async () => {
    const { prefixSvgDefsIds } = await import('../prefix-svg-defs-ids');
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">' +
      '<defs><linearGradient id="gradient.1"><stop offset="0%"/></linearGradient></defs>' +
      '<rect fill="url(#gradient.1)"/>' +
      '</svg>';
    const result = prefixSvgDefsIds(svg, 'mini-');
    expect(result).toContain('id="mini-gradient.1"');
    expect(result).toContain('url(#mini-gradient.1)');
  });

  it('parse 실패 (잘못된 XML)도 graceful — 원본 반환', async () => {
    const { prefixSvgDefsIds } = await import('../prefix-svg-defs-ids');
    const malformed = '<svg><defs><linearGradient id="g1"';
    const result = prefixSvgDefsIds(malformed, 'mini-');
    expect(result).toBe(malformed);
  });
});
```

주의:
- 본 task는 **테스트만 작성** — 헬퍼 구현(`apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts`)은 Plan 12-03 Task 1에서 수행.
- Wave 0 종료 시 dynamic import는 typecheck 단계에서 "Cannot find module" 오류를 발생시키지 않음 (런타임 검사) — Wave 0 acceptance의 typecheck exit 0 조건 충족.
- 런타임 vitest 실행 시에는 모듈 부재 → 모든 케이스 RED. 12-03 Task 1 완료 후 GREEN.
- jsdom DOMParser는 invalid XML 시 `documentElement.tagName === 'parsererror'`를 반환 — 헬퍼는 이 가드 + try-catch로 graceful 처리.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/web test -- prefix-svg-defs-ids --run 2>&1 | tail -30 && echo "---TYPECHECK---" && pnpm --filter @grapit/web typecheck 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - 파일 존재: `test -f /Users/sangwopark19/icons/grapit/apps/web/components/booking/__utils__/__tests__/prefix-svg-defs-ids.test.ts`
    - grep 검증 (케이스 카운트 ≥ 5):
      - `grep -c "^\s*it(" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__utils__/__tests__/prefix-svg-defs-ids.test.ts` → 출력 ≥ 5
    - **reviews revision MED #6 — dynamic import 검증 (정적 import 없음):**
      - `! grep -E "^import { prefixSvgDefsIds } from" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__utils__/__tests__/prefix-svg-defs-ids.test.ts` (정적 top-level import 부재)
      - `grep -c "await import('../prefix-svg-defs-ids')" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__utils__/__tests__/prefix-svg-defs-ids.test.ts` → 5 (각 it 안에 dynamic import)
    - 5개 케이스 식별 문자열 grep:
      - `grep -q "<defs> 없는" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__utils__/__tests__/prefix-svg-defs-ids.test.ts`
      - `grep -q "ID 1개" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__utils__/__tests__/prefix-svg-defs-ids.test.ts`
      - `grep -q "ID 다수" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__utils__/__tests__/prefix-svg-defs-ids.test.ts`
      - `grep -q "gradient.1" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__utils__/__tests__/prefix-svg-defs-ids.test.ts`
      - `grep -q "parse 실패\\|graceful" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__utils__/__tests__/prefix-svg-defs-ids.test.ts`
    - vitest 실행 (구현 전): exit code 1 (모듈 import 실패 — dynamic이라도 runtime 실패) 허용. Wave 0 게이트는 "케이스가 카운트되어 실행 시도됨"으로 충분.
    - **typecheck 회귀 없음 검증 (reviews revision MED #6 핵심 gate):** `pnpm --filter @grapit/web typecheck` exit 0 — dynamic import이므로 모듈 부재에도 typecheck 실패하지 않아야 함.
  </acceptance_criteria>
  <done>
prefix-svg-defs-ids.test.ts가 5개 케이스로 작성되어 12-03 Task 1의 helper 구현 검증 진입점이 마련됨. W-2 단위 테스트 매핑 확립. **reviews revision MED #6 Option B 적용**: 각 it() 안에서 dynamic import 사용으로 Wave 0 typecheck exit 0 보장.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (없음) | Wave 0는 테스트 파일만 추가. 외부 입력/네트워크/persistence 변경 0건. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| (해당 없음) | — | — | — | Wave 0는 vitest 단위 테스트 신규 작성/갱신만 — 새 보안 표면 0. T-12-01(admin SVG 검증)은 Plan 12-02에서 mitigate. |
</threat_model>

<verification>
- [ ] 신규 파일 3개(`svg-preview.test.tsx` — 7 케이스, `use-is-mobile.test.ts` — B-4 케이스 포함, `prefix-svg-defs-ids.test.ts` — W-2 5 케이스 dynamic import) 생성됨
- [ ] 기존 파일 1개(`seat-map-viewer.test.tsx`) B-3 vi.hoisted 적용 mock 확장 + 10 케이스 추가됨 (B-2-RESIDUAL-V2 Option C + reviews revision: rapid reselect race guard + descendant data-stage + selected+locked broadcast 회귀)
- [ ] vitest `--run` 모드로 4개 파일 실행 시 출력에 신규 케이스가 모두 등장 (RED 또는 GREEN 무관)
- [ ] 기존 seat-map-viewer 6 케이스는 GREEN 유지 (회귀 0)
- [ ] B-3: ReferenceError 0건 (vi.hoisted로 mock factory 안전 참조)
- [ ] **reviews revision MED #6: typecheck exit 0** — dynamic import 방식으로 Wave 0 typecheck gate 보장
- [ ] typecheck 0 에러
</verification>

<success_criteria>
- 자동: 위 verification 7개 항목 모두 충족
- Nyquist sampling: 12-VALIDATION.md §"Sampling Rate"의 quick run 명령(`pnpm --filter @grapit/web test -- seat-map-viewer use-is-mobile svg-preview prefix-svg-defs-ids --run`) 가 4개 파일 모두 실행에 포함시킴
- B-3/B-4/B-2-RESIDUAL-V2/W-2/reviews-revision 가드 확립: ReferenceError 0건 + getServerSnapshot SSR fallback unit test + Option C useEffect 기반 fill 검증 + data-fading-out DOM 잔존 검증 + helper 5 케이스 + rapid reselect race guard + descendant data-stage + selected+locked broadcast 회귀
</success_criteria>

<output>
After completion, create `.planning/phases/12-ux/12-00-SUMMARY.md`:
- 신규/갱신 파일 4개 + 케이스 카운트 (svg-preview 7, use-is-mobile 4, seat-map-viewer 16 = 기존 6 + 신규 10, prefix-svg-defs-ids 5)
- 기존 6 회귀 케이스 GREEN 유지 증거
- 신규 케이스 RED 카운트 (12-02/12-03 GREEN 전환 대상)
- B-3 vi.hoisted 적용 증거 (ReferenceError 0건)
- B-4 getServerSnapshot named export 검증 케이스 추가 증거
- B-2-RESIDUAL-V2 Option C: useEffect 기반 fill 검증 케이스 추가 증거 + data-fading-out DOM 잔존 검증 케이스 추가 증거
- **reviews revision HIGH #1**: rapid reselect race guard 케이스 추가 증거 (advanceTimersByTime(80)/(200) 시퀀스)
- **reviews revision HIGH #2**: descendant data-stage 통과 + invalid enum 거부 + descendant viewer 오버레이 케이스 추가 증거
- **reviews revision MED #4**: selected+locked broadcast 회귀 케이스 추가 증거
- **reviews revision MED #6**: dynamic import 방식으로 typecheck exit 0 보장 증거
- **reviews revision LOW #7**: parse 실패 toast 케이스 추가 증거
- W-2: prefixSvgDefsIds helper 단위 테스트 5건 추가 증거
- typecheck 결과
</output>
