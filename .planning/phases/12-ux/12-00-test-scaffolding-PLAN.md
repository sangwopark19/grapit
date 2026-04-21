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
autonomous: true
requirements: [UX-02, UX-04, UX-05, UX-06]
must_haves:
  truths:
    - "Wave 0 종료 후, svg-preview·use-is-mobile·seat-map-viewer 3개 테스트 파일이 모두 존재하며 vitest 실행 시 RED(실패) 또는 PENDING(skip) 상태로 신규 케이스가 카운트된다"
    - "기존 seat-map-viewer 6개 회귀 케이스는 신규 mock 확장(B-3 vi.hoisted 적용)에도 그대로 GREEN을 유지한다"
    - "신규 케이스의 자동화 명령(`pnpm --filter @grapit/web test -- svg-preview`, `use-is-mobile`, `seat-map-viewer`)이 후속 wave의 verify 진입점으로 작동한다"
    - "B-3: vi.mock factory가 vi.hoisted로 안전하게 모듈 top-level const(transformWrapperSpy/mockUseIsMobile/miniMapSpy)를 참조하여 ReferenceError 0건"
    - "B-4: use-is-mobile.test.ts에 getServerSnapshot named export를 직접 import해서 false 반환을 검증하는 케이스가 추가되어 SSR fallback이 unit test로 자동 검증됨"
    - "B-2: seat-map-viewer.test.tsx에 선택/해제 시 data-fading-in/data-fading-out 속성이 잠시 부여되고 150ms 후 제거되는 pendingSelections/pendingRemovals 메커니즘 검증 케이스 추가"
  artifacts:
    - path: "apps/web/components/admin/__tests__/svg-preview.test.tsx"
      provides: "UX-02 admin 업로드 검증 테스트 스캐폴딩 (정상 SVG 통과 / stage 마커 없는 SVG 거부 / R2 PUT 미발생)"
      contains: "describe('SvgPreview') + 최소 3 케이스"
    - path: "apps/web/hooks/__tests__/use-is-mobile.test.ts"
      provides: "UX-06 useIsMobile hook 단위 테스트 (모바일/데스크톱/change 이벤트/getServerSnapshot named export — B-4)"
      contains: "describe('useIsMobile') + 최소 4 케이스 (B-4: import { getServerSnapshot } 검증 1 케이스 포함)"
    - path: "apps/web/components/booking/__tests__/seat-map-viewer.test.tsx"
      provides: "UX-04/05/06 회귀 + 신규 6 케이스 (transition / data-seat-checkmark / MiniMap / initialScale / STAGE 오버레이 / B-2 pending attr fade)"
      contains: "vi.hoisted (B-3) + MiniMap mock + transformWrapperSpy + useIsMobile mock + pending attr 검증 (B-2)"
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
---

<objective>
Wave 0 — 테스트 스캐폴딩.

Phase 12의 모든 검증 가능 행위(svg-preview admin 검증 / useIsMobile hook + getServerSnapshot named export(B-4) / seat-map-viewer transition·체크마크 fade-in/out·MiniMap·initialScale·STAGE 오버레이·pending attr(B-2))에 대한 vitest 테스트 파일을 RED 상태로 먼저 만든다. 이후 Wave 1~3 구현 task가 GREEN으로 전환하는 흐름.

Purpose: 12-VALIDATION.md의 sampling rate(`pnpm --filter @grapit/web test -- seat-map-viewer use-is-mobile svg-preview`)가 Wave 1부터 의미 있게 동작하도록, 모든 검증 단위가 명령에 포착되어야 한다. Nyquist compliance를 위해 Wave 0가 선행되어야 한다.

**Revision (B-3/B-4/B-2 적용):**
- B-3: seat-map-viewer.test.tsx에서 vi.mock factory가 모듈 top-level const를 참조할 때 발생하는 ReferenceError를 vi.hoisted로 회피
- B-4: use-is-mobile.test.ts에 getServerSnapshot named export 직접 검증 케이스 추가 (SSR fallback unit test 자동화)
- B-2: seat-map-viewer.test.tsx에 pendingSelections/pendingRemovals 메커니즘(data-fading-in/data-fading-out 속성 잠시 부여 → 150ms 후 제거) 검증 케이스 추가

Output:
- 신규 `apps/web/components/admin/__tests__/svg-preview.test.tsx` (4 케이스)
- 신규 `apps/web/hooks/__tests__/use-is-mobile.test.ts` (4 케이스 — B-4 getServerSnapshot 1 케이스 추가)
- 갱신 `apps/web/components/booking/__tests__/seat-map-viewer.test.tsx` (B-3 vi.hoisted 적용 mock 확장 + 6 신규 케이스 — B-2 pending attr 1 케이스 추가)
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

MODIFIED component: apps/web/components/booking/seat-map-viewer.tsx
- 신규 import: `MiniMap` from `'react-zoom-pan-pinch'`, `useIsMobile` from `'@/hooks/use-is-mobile'`
- 변경 1 (UX-04): 선택 좌석 분기(line 88)의 inline style이 `'cursor:pointer;opacity:1;transition:fill 150ms ease-out,stroke 150ms ease-out;'` 로 교체
- 변경 2 (UX-04): 선택 좌석 체크마크 `<text>`(line 109~119)에 `setAttribute('data-seat-checkmark', '')` 한 줄 추가 (mount 시 fade-in)
- 변경 2b (B-2): 선택·해제 transition을 사용자에게 보이게 하기 위해 `pendingSelections` / `pendingRemovals` Set<string> 메커니즘 도입
  - `[currentSelected - prevSelected]` 차집합 → 신규 선택 좌석 → `data-fading-in="true"` 잠시 부여 + 다음 frame에 fill을 primary로 변경
  - `[prevSelected - currentSelected]` 차집합 → 해제된 좌석 → 체크마크 `<text>`를 즉시 제거하지 않고 `data-fading-out="true"` 부여 + 150ms 후 다음 useMemo 사이클에 실제 제거
  - 구현: `prevSelectedRef` (useRef<Set<string>>), `pendingRemovals` (useState<Set<string>>), useEffect로 `setTimeout(() => setPendingRemovals(new Set()), 160)` 타이밍
- 변경 3 (UX-02): processedSvg useMemo의 viewBox 보장 직후 `data-stage` 속성 + `<text>STAGE</text>` 부재 시 viewBox 변에 STAGE 배지 `<g>` 오버레이 삽입 (in-memory만 — D-19 호환)
- 변경 4 (UX-06): TransformWrapper에 `key={isMobile ? 'mobile' : 'desktop'}` + `initialScale={isMobile ? 1.4 : 1}`
- 변경 5 (UX-05): TransformWrapper 내부 `<SeatMapControls />` 다음에 `{!isMobile && <MiniMap ...>}` 마운트

MODIFIED component: apps/web/components/admin/svg-preview.tsx
- handleSvgUpload 콜백 안 size 체크 직후, presigned URL 발급 이전에 다음 검증 prepend:
  - `await file.text()` → `new DOMParser().parseFromString(text, 'image/svg+xml')`
  - `<text>STAGE</text>` (`textContent.trim() === 'STAGE'`) 또는 `[data-stage]` 부재 시 `toast.error('스테이지 마커가 없는 SVG입니다. <text>STAGE</text> 또는 data-stage 속성을 포함해주세요.')` + early return

MODIFIED globals.css (Wave 1):
- `@theme` 블록 안: `--shadow-sm`, `--shadow-md`, `--radius-sm/md/lg/xl`, `@keyframes seat-checkmark-fade-in`, `@keyframes seat-checkmark-fade-out` (B-1: fade-out 추가)
- `@theme` 블록 밖: `[data-seat-checkmark] { animation: seat-checkmark-fade-in 150ms ease-out forwards; }`
- `@theme` 블록 밖: `[data-seat-checkmark][data-fading-out="true"] { animation: seat-checkmark-fade-out 150ms ease-out forwards; }` (B-1)
- `@theme` 블록 밖: `@media (prefers-reduced-motion: reduce) { [data-seat-checkmark] { animation-duration: 0.01ms; } [data-seat-checkmark][data-fading-out="true"] { animation-duration: 0.01ms; } }` (B-1)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: svg-preview admin 검증 테스트 신규 작성</name>
  <files>apps/web/components/admin/__tests__/svg-preview.test.tsx</files>
  <read_first>
    - apps/web/components/admin/svg-preview.tsx (현재 handleSvgUpload 구조 — line 31~62 흐름)
    - apps/web/app/auth/reset-password/__tests__/reset-password.test.tsx (sonner toast mock + apiClient mock + fetch stub 패턴 참조)
    - .planning/phases/12-ux/12-PATTERNS.md §"apps/web/components/admin/__tests__/svg-preview.test.tsx (test) — NEW" (line 456~539)
    - .planning/phases/12-ux/12-RESEARCH.md §"Code Examples / svg-preview.tsx" (line 791~861)
    - .planning/phases/12-ux/12-CONTEXT.md D-06, D-08 (스테이지 마커 검증 정책)
  </read_first>
  <behavior>
    - Test 1 ("정상 SVG 통과"): `<text>STAGE</text>`를 포함한 SVG 업로드 시 toast.error 미호출 + presignedUpload.mutateAsync 호출됨 + fetch (R2 PUT) 호출됨
    - Test 2 ("data-stage 속성만 있는 SVG 통과"): `data-stage="top"` 속성을 가진 SVG 업로드 시 동일하게 통과
    - Test 3 ("stage 마커 없는 SVG 거부"): stage 마커 없는 SVG 업로드 시 `toast.error` 가 `expect.stringContaining('스테이지 마커')`로 호출됨 + presignedUpload.mutateAsync 미호출 + fetch 미호출
    - (선택) Test 4 ("size 초과 거부 회귀"): 10MB 초과 파일은 기존대로 size 에러 toast 호출 + 검증 진입 자체 안 됨
  </behavior>
  <action>
실제 파일 내용:

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

const SVG_WITH_DATA_STAGE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" data-stage="top"><rect data-seat-id="A-1" x="10" y="10" width="32" height="32"/></svg>';

const SVG_WITHOUT_STAGE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><rect data-seat-id="A-1" x="10" y="10" width="32" height="32"/></svg>';

function makeFile(content: string, name = 'test.svg'): File {
  return new File([content], name, { type: 'image/svg+xml' });
}

describe('SvgPreview — UX-02 admin 업로드 검증 (D-06/D-08)', () => {
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

  it('data-stage 속성만 있는 SVG 업로드 시 검증 통과', async () => {
    const { container } = render(<SvgPreview performanceId="perf-1" />);
    const input = container.querySelector('#svg-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile(SVG_WITH_DATA_STAGE)] } });

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
});
```

본 task는 **테스트만 작성**한다 — 구현(svg-preview.tsx 검증 로직 추가)은 Plan 12-02에서 수행. Wave 0 종료 시 위 케이스 중 stage 마커 없는 SVG 거부 케이스 등은 RED(실패) 상태가 되며, 12-02 완료 후 GREEN으로 전환.

주의:
- file.size 검증은 현재 코드에 이미 존재 → "10MB 초과 회귀" 케이스는 GREEN으로 시작 (회귀 가드).
- jsdom에 DOMParser는 기본 제공 → 구현 단계에서 별도 polyfill 불필요.
- TierEditor는 본 테스트 범위 밖이므로 stub 처리 (jsx 렌더링이 svgUrl set 후 동작하지만 검증 케이스는 svgUrl 변화 전에 검증 종료).
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/web test -- svg-preview --run 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - 파일 존재: `test -f /Users/sangwopark19/icons/grapit/apps/web/components/admin/__tests__/svg-preview.test.tsx`
    - grep 검증 (테스트 케이스 카운트 ≥ 3):
      - `grep -c "^\s*it(" /Users/sangwopark19/icons/grapit/apps/web/components/admin/__tests__/svg-preview.test.tsx` → 출력 ≥ 3
    - grep 검증 (sonner mock 패턴 존재):
      - `grep -q "vi.mock('sonner'" /Users/sangwopark19/icons/grapit/apps/web/components/admin/__tests__/svg-preview.test.tsx`
    - grep 검증 (`스테이지 마커` 카피 검증 케이스 존재):
      - `grep -q "스테이지 마커" /Users/sangwopark19/icons/grapit/apps/web/components/admin/__tests__/svg-preview.test.tsx`
    - grep 검증 (mockMutateAsync 호출 여부 assertion 존재):
      - `grep -q "mockMutateAsync" /Users/sangwopark19/icons/grapit/apps/web/components/admin/__tests__/svg-preview.test.tsx`
    - vitest 실행 시 (구현 전이므로 RED 허용): exit code 0 또는 1, "stage 마커 없는 SVG 거부" 케이스가 FAIL로 카운트되거나 (만약 구현이 이미 됐다면) PASS. 어느 쪽이든 케이스가 실행에 포함됨.
    - typecheck 회귀 없음: `pnpm --filter @grapit/web typecheck` exit 0
  </acceptance_criteria>
  <done>
svg-preview.test.tsx가 4개 케이스로 작성되어 vitest에 의해 실행되며, 12-02의 구현이 GREEN으로 전환할 검증 진입점이 마련됨.
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
    - typecheck 회귀 없음: `pnpm --filter @grapit/web typecheck` exit 0 (테스트 파일이 모듈 부재로 실패하더라도 typecheck는 ts include 범위에 있어야 함 — 테스트 디렉토리는 vitest가 자체 컴파일하므로 typecheck 영향 없음)
  </acceptance_criteria>
  <done>
use-is-mobile.test.ts가 4개 케이스(B-4 getServerSnapshot 케이스 포함)로 작성되어 12-02 Task 1의 구현 검증 진입점이 마련됨. SSR fallback 정합성 자동 검증 1단 확립.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: seat-map-viewer 테스트 mock 확장 (B-3 vi.hoisted) + 6 신규 케이스 추가 (B-2 pending attr 포함)</name>
  <files>apps/web/components/booking/__tests__/seat-map-viewer.test.tsx</files>
  <read_first>
    - apps/web/components/booking/__tests__/seat-map-viewer.test.tsx (전체 — 라인 7~22 mock 구조, 라인 39~234 기존 케이스 6건)
    - apps/web/components/booking/seat-map-viewer.tsx (라인 84~131 좌석 분기, 라인 276~303 TransformWrapper 구조)
    - .planning/phases/12-ux/12-PATTERNS.md §"apps/web/components/booking/__tests__/seat-map-viewer.test.tsx (test) — UPDATE" (line 633~793)
    - .planning/phases/12-ux/12-RESEARCH.md §"Wave 0 Gaps" (line 1017~1023)
    - .planning/phases/12-ux/12-CONTEXT.md D-07/D-11/D-12/D-13/D-14/D-16/D-17 (검증 대상 행위)
    - .planning/phases/12-ux/12-UI-SPEC.md §"Interaction & State Contract" 라인 240~241 (선택 fade-in / 해제 fade-out + setTimeout 150ms)
    - vitest docs §"vi.hoisted" — module top-level const를 mock factory에서 안전 참조하기 위한 표준 패턴 (B-3)
  </read_first>
  <behavior>
    - 기존 6 케이스 유지 (available/locked/click/sold-skip/selected stroke/error)
    - 신규 6 케이스 추가:
      1. 선택 좌석 inline `style`에 `transition:fill 150ms` 포함 (UX-04)
      2. locked 좌석은 `transition:none` 유지 (D-13 회귀 방지)
      3. 선택 좌석에 `data-seat-checkmark` 속성을 가진 `<text>` 요소 존재 (UX-04 mount fade-in)
      4. 데스크톱(`isMobile=false`) 시 MiniMap 마운트 + 모바일(`isMobile=true`) 시 MiniMap 미마운트 (UX-05) — 1 케이스 안에 양쪽 검증 가능
      5. `isMobile=true` 시 TransformWrapper에 `initialScale=1.4` prop 전달 (UX-06)
      6. SVG에 `data-stage="top"`만 있을 때 viewer가 `<text>STAGE</text>` 요소를 추가 (UX-02 viewer)
      7. **B-2: 선택 좌석에 data-fading-in 속성이 잠시 부여되고 150ms 후 제거됨 (pendingSelections), 해제 시 data-fading-out 속성이 잠시 부여되고 150ms 후 제거됨 (pendingRemovals)** — `vi.useFakeTimers()` + `vi.advanceTimersByTime(160)`로 검증
  </behavior>
  <action>
다음 변경을 적용한다 (현재 파일을 그대로 두고 mock 블록 + 신규 케이스만 패치). 실제 변경:

1) **라인 7~18 mock 확장 — B-3 vi.hoisted 적용** — 모듈 top-level const 참조 ReferenceError 회피:

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

변경 후 (파일 상단, vi.hoisted 사용 — B-3):
```tsx
// B-3: vi.hoisted로 mock factory가 참조할 const들을 hoist-safe하게 선언
// (vi.mock factory는 import보다 먼저 실행되므로 일반 const는 ReferenceError 발생)
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

주의 (B-3):
- `vi.hoisted(() => ({ ... }))`는 vitest가 vi.mock factory보다 먼저 실행을 보장 — factory에서 안전하게 참조 가능.
- `transformWrapperSpy.mockClear()`, `mockUseIsMobile.mockReset()`, `miniMapSpy.mockClear()`는 beforeEach에서 호출.
- `mockUseIsMobile.mockReturnValue(true)`로 각 케이스에서 모바일/데스크톱 분기 제어.
- `:any` 사용은 mock factory 한정 — eslint-disable 주석으로 CLAUDE.md "no any" 규칙 예외 처리. 실제 hook/컴포넌트 코드는 strict 유지.

2) **describe 블록 안 beforeEach 직후, 기존 6 케이스를 유지하고 끝부분에 신규 6 케이스 추가**:

```tsx
  // beforeEach 안에 spy/mock 리셋 추가 (B-3)
  // 기존:
  //   beforeEach(() => {
  //     global.fetch = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(SVG_CONTENT) });
  //   });
  // 변경 후:
  //   beforeEach(() => {
  //     transformWrapperSpy.mockClear();
  //     mockUseIsMobile.mockReset();
  //     mockUseIsMobile.mockReturnValue(false);
  //     miniMapSpy.mockClear();
  //     global.fetch = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(SVG_CONTENT) });
  //   });

  // ... 기존 6 케이스 그대로 ...

  // 신규 케이스 1: 선택 좌석 transition (UX-04)
  it('선택 좌석 rect의 inline style에 transition:fill 150ms이 포함된다 (UX-04)', async () => {
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
      const styleAttr = seatA1.getAttribute('style') ?? '';
      expect(styleAttr).toContain('fill 150ms');
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
    // 데스크톱
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

    // 모바일
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

  // 신규 케이스 6: STAGE 배지 오버레이 (UX-02 viewer)
  it('SVG에 data-stage 속성만 있을 때 viewer가 STAGE <text> 오버레이를 추가한다 (UX-02)', async () => {
    const SVG_WITH_DATA_STAGE_ONLY = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" data-stage="top">
  <rect data-seat-id="A-1" x="10" y="50" width="32" height="32"/>
</svg>
`;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SVG_WITH_DATA_STAGE_ONLY),
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

  // 신규 케이스 7 (B-2): pendingSelections / pendingRemovals 메커니즘 — fade-in/out 속성이 잠시 부여되고 150ms 후 제거됨
  it('B-2: 선택 시 data-fading-in 속성이 잠시 부여되고 150ms 후 제거되며, 해제 시 data-fading-out 속성이 잠시 부여되고 150ms 후 제거됨', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const seatStates = new Map<string, SeatState>([['A-1', 'available']]);

      // Phase 1: 선택 → data-fading-in 잠시 부여
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
        const seatA1 = container.querySelector('[data-seat-id="A-1"]') as SVGElement | null;
        expect(seatA1).toBeTruthy();
      });

      // 선택 직후: data-fading-in 또는 data-fading-out 중 하나가 부여된 상태
      const seatA1 = container.querySelector('[data-seat-id="A-1"]') as SVGElement;
      const checkA1 = container.querySelector('[data-seat-checkmark]');
      const fadingInRect = seatA1.getAttribute('data-fading-in');
      const fadingInCheck = checkA1?.getAttribute('data-fading-in');
      // 적어도 하나는 truthy여야 함 (rect 또는 checkmark에 data-fading-in 부여)
      expect(fadingInRect ?? fadingInCheck ?? null).toBeTruthy();

      // 160ms 진행 후 — data-fading-in 제거
      await act(async () => {
        vi.advanceTimersByTime(160);
      });
      await vi.waitFor(() => {
        const seatAfter = container.querySelector('[data-seat-id="A-1"]') as SVGElement;
        const checkAfter = container.querySelector('[data-seat-checkmark]');
        expect(seatAfter.getAttribute('data-fading-in')).toBeFalsy();
        expect(checkAfter?.getAttribute('data-fading-in') ?? null).toBeFalsy();
      });

      // Phase 2: 해제 → data-fading-out 잠시 부여 (체크마크가 즉시 사라지지 않음)
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

      // 해제 직후: 체크마크가 아직 DOM에 존재하며 data-fading-out="true" 부여됨
      await vi.waitFor(() => {
        const checkmarkDuringFadeOut = container.querySelector('[data-seat-checkmark]');
        expect(checkmarkDuringFadeOut).toBeTruthy();
        expect(checkmarkDuringFadeOut?.getAttribute('data-fading-out')).toBe('true');
      });

      // 160ms 진행 후 — 체크마크 DOM에서 제거됨
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
```

3) **mockSeatConfig 좌석 좌표 보강 (선택)**: 기존 SVG_CONTENT의 `<circle>`은 cx/cy/r이 있어 체크마크 위치 계산 가능 — 신규 케이스 3 (data-seat-checkmark)는 기존 circle 좌석으로 동작. 별도 SVG 변경 불필요.

주의:
- 본 task 완료 후 vitest 실행 시 신규 6 케이스(transition / data-seat-checkmark / MiniMap 마운트 / initialScale / STAGE 오버레이 / B-2 pending attr)는 RED. 12-03 viewer 변경 완료 후 GREEN으로 전환.
- 기존 6 케이스는 mock 확장(B-3 vi.hoisted)만으로 변동 없으므로 GREEN 유지가 acceptance criteria.
- **B-3**: vi.hoisted를 사용해 transformWrapperSpy/mockUseIsMobile/miniMapSpy를 hoist-safe하게 선언 — vi.mock factory가 import보다 먼저 실행돼도 ReferenceError 0건.
- **B-2**: data-fading-in/data-fading-out 속성 검증은 pendingSelections/pendingRemovals 메커니즘을 자동 검증하는 게이트. 12-03 viewer가 접근 1을 채택해 구현하면 GREEN 전환.
- **B-2 fakeTimers**: `vi.useFakeTimers({ shouldAdvanceTime: true })` 옵션은 microtask가 timer queue 외부에서 진행되도록 허용 — render/rerender의 setTimeout이 자연스럽게 동작.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/web test -- seat-map-viewer --run 2>&1 | tail -50 && pnpm --filter @grapit/web test -- seat-map-viewer.test.tsx 2>&1 | grep -c "ReferenceError" || echo "0"</automated>
  </verify>
  <acceptance_criteria>
    - 파일이 존재하고 변경됨: `test -f /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
    - mock 확장 grep (B-3 vi.hoisted 적용):
      - `grep -q "vi.hoisted" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "MiniMap:" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "transformWrapperSpy" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "@/hooks/use-is-mobile" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "miniMapSpy" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
    - 신규 케이스 grep (각 케이스의 식별 문자열):
      - `grep -q "transition:fill 150ms\\|fill 150ms" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "data-seat-checkmark" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "data-testid=\"minimap\"\\|data-testid=.minimap." /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "initialScale: 1.4\\|initialScale: 1.4" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "data-stage" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - **B-2**: `grep -q "data-fading-in" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - **B-2**: `grep -q "data-fading-out" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - **B-2**: `grep -q "advanceTimersByTime(160)" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
    - 케이스 카운트 ≥ 12 (기존 6 + 신규 6 — STAGE/MiniMap/B-2 케이스 포함):
      - `grep -c "^\s*it(" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx` → 출력 ≥ 11
    - **B-3 ReferenceError 검증**: 케이스가 ReferenceError 없이 import 단계 통과
      - `pnpm --filter @grapit/web test -- seat-map-viewer.test.tsx 2>&1 | grep -c "ReferenceError"` → 출력 0
    - vitest 실행 시 (Wave 0 단계 — viewer 미변경): 기존 6 케이스 PASS, 신규 6 케이스는 FAIL 또는 SKIP 상태로 카운트되어 출력에 등장. `--run` flag로 watch 미사용.
    - typecheck 회귀 없음: `pnpm --filter @grapit/web typecheck` exit 0
  </acceptance_criteria>
  <done>
seat-map-viewer.test.tsx가 mock 확장 (B-3 vi.hoisted 적용 + MiniMap + useIsMobile) + 신규 6 케이스 추가 완료 (B-2 pending attr 검증 케이스 포함). 기존 6 회귀 케이스는 GREEN 유지. ReferenceError 0건 (B-3). 12-03 구현 후 신규 케이스도 GREEN 전환 가능한 상태.
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
- [ ] 신규 파일 2개(`svg-preview.test.tsx`, `use-is-mobile.test.ts` — B-4 케이스 포함) 생성됨
- [ ] 기존 파일 1개(`seat-map-viewer.test.tsx`) B-3 vi.hoisted 적용 mock 확장 + 6 케이스 추가됨 (B-2 pending attr 케이스 포함)
- [ ] vitest `--run` 모드로 3개 파일 실행 시 출력에 신규 케이스가 모두 등장 (RED 또는 GREEN 무관)
- [ ] 기존 seat-map-viewer 6 케이스는 GREEN 유지 (회귀 0)
- [ ] B-3: ReferenceError 0건 (vi.hoisted로 mock factory 안전 참조)
- [ ] typecheck 0 에러
</verification>

<success_criteria>
- 자동: 위 verification 6개 항목 모두 충족
- Nyquist sampling: 12-VALIDATION.md §"Sampling Rate"의 quick run 명령(`pnpm --filter @grapit/web test -- seat-map-viewer use-is-mobile svg-preview --run`) 가 3개 파일 모두 실행에 포함시킴
- B-3/B-4/B-2 가드 확립: ReferenceError 0건 + getServerSnapshot SSR fallback unit test + pending attr 메커니즘 검증
</success_criteria>

<output>
After completion, create `.planning/phases/12-ux/12-00-SUMMARY.md`:
- 신규/갱신 파일 3개 + 케이스 카운트 (svg-preview 4, use-is-mobile 4, seat-map-viewer 12)
- 기존 6 회귀 케이스 GREEN 유지 증거
- 신규 케이스 RED 카운트 (12-02/12-03 GREEN 전환 대상)
- B-3 vi.hoisted 적용 증거 (ReferenceError 0건)
- B-4 getServerSnapshot named export 검증 케이스 추가 증거
- B-2 pending attr 검증 케이스 추가 증거
- typecheck 결과
</output>
</content>
