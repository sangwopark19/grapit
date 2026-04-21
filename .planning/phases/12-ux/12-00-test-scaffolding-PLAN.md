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
    - "기존 seat-map-viewer 6개 회귀 케이스는 신규 mock 확장에도 그대로 GREEN을 유지한다"
    - "신규 케이스의 자동화 명령(`pnpm --filter @grapit/web test -- svg-preview`, `use-is-mobile`, `seat-map-viewer`)이 후속 wave의 verify 진입점으로 작동한다"
  artifacts:
    - path: "apps/web/components/admin/__tests__/svg-preview.test.tsx"
      provides: "UX-02 admin 업로드 검증 테스트 스캐폴딩 (정상 SVG 통과 / stage 마커 없는 SVG 거부 / R2 PUT 미발생)"
      contains: "describe('SvgPreview') + 최소 3 케이스"
    - path: "apps/web/hooks/__tests__/use-is-mobile.test.ts"
      provides: "UX-06 useIsMobile hook 단위 테스트 (모바일/데스크톱/SSR fallback)"
      contains: "describe('useIsMobile') + 최소 3 케이스"
    - path: "apps/web/components/booking/__tests__/seat-map-viewer.test.tsx"
      provides: "UX-04/05/06 회귀 + 신규 5 케이스 (transition / data-seat-checkmark / MiniMap / initialScale / STAGE 오버레이)"
      contains: "MiniMap mock + transformWrapperSpy + useIsMobile mock"
  key_links:
    - from: "apps/web/components/booking/__tests__/seat-map-viewer.test.tsx"
      to: "react-zoom-pan-pinch (mock)"
      via: "vi.mock 라인 7~22 확장 (MiniMap export 추가 + TransformWrapper spy 변환)"
      pattern: "MiniMap:.*data-testid.*mini-map"
    - from: "apps/web/components/booking/__tests__/seat-map-viewer.test.tsx"
      to: "@/hooks/use-is-mobile (mock)"
      via: "vi.mock('@/hooks/use-is-mobile')"
      pattern: "useIsMobile.*mockUseIsMobile"
    - from: "apps/web/components/admin/__tests__/svg-preview.test.tsx"
      to: "sonner / @/hooks/use-admin / fetch (mock)"
      via: "vi.mock + vi.stubGlobal('fetch')"
      pattern: "vi.mock\\('sonner'"
---

<objective>
Wave 0 — 테스트 스캐폴딩.

Phase 12의 모든 검증 가능 행위(svg-preview admin 검증 / useIsMobile hook / seat-map-viewer transition·체크마크·MiniMap·initialScale·STAGE 오버레이)에 대한 vitest 테스트 파일을 RED 상태로 먼저 만든다. 이후 Wave 1~3 구현 task가 GREEN으로 전환하는 흐름.

Purpose: 12-VALIDATION.md의 sampling rate(`pnpm --filter @grapit/web test -- seat-map-viewer use-is-mobile svg-preview`)가 Wave 1부터 의미 있게 동작하도록, 모든 검증 단위가 명령에 포착되어야 한다. Nyquist compliance를 위해 Wave 0가 선행되어야 한다.

Output:
- 신규 `apps/web/components/admin/__tests__/svg-preview.test.tsx` (3 케이스)
- 신규 `apps/web/hooks/__tests__/use-is-mobile.test.ts` (3 케이스)
- 갱신 `apps/web/components/booking/__tests__/seat-map-viewer.test.tsx` (mock 확장 + 5 신규 케이스)
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
```
- 의존: `react`의 `useSyncExternalStore`
- matchMedia query: `'(max-width: 767px)'`
- SSR fallback: `false` (desktop)

MODIFIED component: apps/web/components/booking/seat-map-viewer.tsx
- 신규 import: `MiniMap` from `'react-zoom-pan-pinch'`, `useIsMobile` from `'@/hooks/use-is-mobile'`
- 변경 1: 선택 좌석 분기(line 88)의 inline style이 `'cursor:pointer;opacity:1;transition:fill 150ms ease-out,stroke 150ms ease-out;'` 로 교체
- 변경 2: 선택 좌석 체크마크 `<text>`(line 109~119)에 `setAttribute('data-seat-checkmark', '')` 한 줄 추가
- 변경 3: processedSvg useMemo의 viewBox 보장 직후 `data-stage` 속성 + `<text>STAGE</text>` 부재 시 viewBox 변에 STAGE 배지 `<g>` 오버레이 삽입
- 변경 4: TransformWrapper에 `key={isMobile ? 'mobile' : 'desktop'}` + `initialScale={isMobile ? 1.4 : 1}`
- 변경 5: TransformWrapper 내부 `<SeatMapControls />` 다음에 `{!isMobile && <MiniMap ...>}` 마운트

MODIFIED component: apps/web/components/admin/svg-preview.tsx
- handleSvgUpload 콜백 안 size 체크 직후, presigned URL 발급 이전에 다음 검증 prepend:
  - `await file.text()` → `new DOMParser().parseFromString(text, 'image/svg+xml')`
  - `<text>STAGE</text>` (`textContent.trim() === 'STAGE'`) 또는 `[data-stage]` 부재 시 `toast.error('스테이지 마커가 없는 SVG입니다. <text>STAGE</text> 또는 data-stage 속성을 포함해주세요.')` + early return
- 검증 통과 시: `text` 변수를 try 블록 안 `file.text()` 재호출 대신 그대로 재사용 가능하나, 본 wave는 테스트만 작성하므로 구현 세부는 12-02에서 결정.

MODIFIED globals.css (Wave 1):
- `@theme` 블록 안: `--shadow-sm`, `--shadow-md`, `--radius-sm/md/lg/xl`, `@keyframes seat-checkmark-fade-in`
- `@theme` 블록 밖: `[data-seat-checkmark] { animation: seat-checkmark-fade-in 150ms ease-out forwards; }`
- `@theme` 블록 밖: `@media (prefers-reduced-motion: reduce) { [data-seat-checkmark] { animation: none; opacity: 1; } }`
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
  <name>Task 2: useIsMobile hook 테스트 신규 작성</name>
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
  </behavior>
  <action>
실제 파일 내용:

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
});
```

주의:
- 본 task는 **테스트만 작성** — 구현(`apps/web/hooks/use-is-mobile.ts`)은 Plan 12-02 Task 1에서 수행.
- `await import('../use-is-mobile')`은 Plan 12-02 완료 전에는 모듈이 없으므로 import 자체가 실패 → 모든 케이스 RED. 12-02 완료 후 GREEN.
- jsdom 환경에 `window.matchMedia`는 기본 미정의 — `Object.defineProperty(window, 'matchMedia', ...)`로 명시적 set 필요.
- SSR fallback (`getServerSnapshot`) 검증은 jsdom 환경에서 `typeof window === 'undefined'`를 흉내 낼 수 없으므로, getServerSnapshot 자체는 hook 단위 테스트가 어려움. PATTERNS.md §"SSR fallback 검증" 주석 참조 — Wave 4 manual QA에서 Next.js SSR 페이지 진입 후 hydration mismatch warning 0건으로 간접 검증.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/web test -- use-is-mobile --run 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - 파일 존재: `test -f /Users/sangwopark19/icons/grapit/apps/web/hooks/__tests__/use-is-mobile.test.ts`
    - grep 검증 (케이스 카운트 ≥ 3):
      - `grep -c "^\s*it(" /Users/sangwopark19/icons/grapit/apps/web/hooks/__tests__/use-is-mobile.test.ts` → 출력 ≥ 3
    - grep 검증 (renderHook + matchMedia mock 패턴):
      - `grep -q "renderHook" /Users/sangwopark19/icons/grapit/apps/web/hooks/__tests__/use-is-mobile.test.ts`
      - `grep -q "matchMedia" /Users/sangwopark19/icons/grapit/apps/web/hooks/__tests__/use-is-mobile.test.ts`
    - grep 검증 (max-width: 767px 쿼리 검증 포함):
      - 본 테스트가 mock 안에서 query를 직접 검증하지 않더라도, 임포트 대상 hook이 `(max-width: 767px)` 사용 — 12-02 완료 후 케이스가 통과하는 것으로 간접 검증
    - vitest 실행 (구현 전): exit code 1 (모듈 import 실패 또는 케이스 FAIL) 허용. Wave 0 게이트는 "케이스가 카운트되어 실행 시도됨"으로 충분.
    - typecheck 회귀 없음: `pnpm --filter @grapit/web typecheck` exit 0 (테스트 파일이 모듈 부재로 실패하더라도 typecheck는 ts include 범위에 있어야 함 — 테스트 디렉토리는 vitest가 자체 컴파일하므로 typecheck 영향 없음)
  </acceptance_criteria>
  <done>
use-is-mobile.test.ts가 3개 케이스로 작성되어 12-02 Task 1의 구현 검증 진입점이 마련됨.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: seat-map-viewer 테스트 mock 확장 + 5 신규 케이스 추가</name>
  <files>apps/web/components/booking/__tests__/seat-map-viewer.test.tsx</files>
  <read_first>
    - apps/web/components/booking/__tests__/seat-map-viewer.test.tsx (전체 — 라인 7~22 mock 구조, 라인 39~234 기존 케이스 6건)
    - apps/web/components/booking/seat-map-viewer.tsx (라인 84~131 좌석 분기, 라인 276~303 TransformWrapper 구조)
    - .planning/phases/12-ux/12-PATTERNS.md §"apps/web/components/booking/__tests__/seat-map-viewer.test.tsx (test) — UPDATE" (line 633~793)
    - .planning/phases/12-ux/12-RESEARCH.md §"Wave 0 Gaps" (line 1017~1023)
    - .planning/phases/12-ux/12-CONTEXT.md D-07/D-11/D-12/D-13/D-14/D-16/D-17 (검증 대상 행위)
  </read_first>
  <behavior>
    - 기존 6 케이스 유지 (available/locked/click/sold-skip/selected stroke/error)
    - 신규 5 케이스 추가:
      1. 선택 좌석 inline `style`에 `transition:fill 150ms` 포함 (UX-04)
      2. locked 좌석은 `transition:none` 유지 (D-13 회귀 방지)
      3. 선택 좌석에 `data-seat-checkmark` 속성을 가진 `<text>` 요소 존재 (UX-04)
      4. 데스크톱(`isMobile=false`) 시 MiniMap 마운트 + 모바일(`isMobile=true`) 시 MiniMap 미마운트 (UX-05) — 1 케이스 안에 양쪽 검증 가능
      5. `isMobile=true` 시 TransformWrapper에 `initialScale=1.4` prop 전달 (UX-06)
      6. SVG에 `data-stage="top"`만 있을 때 viewer가 `<text>STAGE</text>` 요소를 추가 (UX-02 viewer)
  </behavior>
  <action>
다음 변경을 적용한다 (현재 파일을 그대로 두고 mock 블록 + 신규 케이스만 패치). 실제 변경:

1) **라인 7~18 mock 확장** — `MiniMap` 추가 + `transformWrapperSpy`로 props 캡처:

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

변경 후 (파일 상단, vi.mock 블록 교체):
```tsx
const transformWrapperSpy = vi.fn();
vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: (props: {
    children: React.ReactNode;
    initialScale?: number;
    minScale?: number;
    maxScale?: number;
  }) => {
    transformWrapperSpy(props);
    return <div data-testid="transform-wrapper">{props.children}</div>;
  },
  TransformComponent: ({
    children,
  }: {
    children: React.ReactNode;
    wrapperClass?: string;
    contentClass?: string;
  }) => <div data-testid="transform-component">{children}</div>,
  MiniMap: ({
    children,
    ...rest
  }: {
    children: React.ReactNode;
    width?: number;
    borderColor?: string;
    className?: string;
  }) => (
    <div data-testid="mini-map" {...rest}>
      {children}
    </div>
  ),
}));

const mockUseIsMobile = vi.fn(() => false);
vi.mock('@/hooks/use-is-mobile', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));
```

2) **describe 블록 안 beforeEach 직후, 기존 6 케이스를 유지하고 끝부분에 신규 5 케이스 추가**:

```tsx
  // beforeEach 안에 transformWrapperSpy/mockUseIsMobile 리셋 추가
  // (기존 beforeEach는 fetch만 stub — 신규 라인을 그 안에 추가)
  // 기존:
  //   beforeEach(() => {
  //     global.fetch = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(SVG_CONTENT) });
  //   });
  // 변경 후:
  //   beforeEach(() => {
  //     transformWrapperSpy.mockReset();
  //     mockUseIsMobile.mockReturnValue(false);
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

  // 신규 케이스 3: 선택 좌석 data-seat-checkmark (UX-04)
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
      expect(container.querySelector('[data-testid="mini-map"]')).toBeTruthy();
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
    expect(mobileContainer.querySelector('[data-testid="mini-map"]')).toBeFalsy();
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
```

3) **mockSeatConfig 좌석 좌표 보강 (선택)**: 기존 SVG_CONTENT의 `<circle>`은 cx/cy/r이 있어 체크마크 위치 계산 가능 — 신규 케이스 3 (data-seat-checkmark)는 기존 circle 좌석으로 동작. 별도 SVG 변경 불필요.

주의:
- 본 task 완료 후 vitest 실행 시 신규 5 케이스(transition / data-seat-checkmark / MiniMap 마운트 / initialScale / STAGE 오버레이)는 RED. 12-03 viewer 변경 완료 후 GREEN으로 전환.
- 기존 6 케이스는 mock 확장만으로 변동 없으므로 GREEN 유지가 acceptance criteria.
- `transformWrapperSpy`/`mockUseIsMobile`는 module top-level에 선언되어 vi.mock factory 안에서 참조됨 — vi.mock은 hoisted이므로 const 선언 전에 mock factory가 호출되지만, factory 내부에서 const를 호출하는 시점은 React render 후 → 안전.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/web test -- seat-map-viewer --run 2>&1 | tail -40</automated>
  </verify>
  <acceptance_criteria>
    - 파일이 존재하고 변경됨: `test -f /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
    - mock 확장 grep:
      - `grep -q "MiniMap:" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "transformWrapperSpy" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "@/hooks/use-is-mobile" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
    - 신규 케이스 grep (각 케이스의 식별 문자열):
      - `grep -q "transition:fill 150ms\\|fill 150ms" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "data-seat-checkmark" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "data-testid=\"mini-map\"\\|data-testid=.mini-map." /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "initialScale: 1.4\\|initialScale: 1.4" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
      - `grep -q "data-stage" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
    - 케이스 카운트 ≥ 11 (기존 6 + 신규 5 — STAGE/MiniMap 케이스 통합 시 ≥ 10):
      - `grep -c "^\s*it(" /Users/sangwopark19/icons/grapit/apps/web/components/booking/__tests__/seat-map-viewer.test.tsx` → 출력 ≥ 10
    - vitest 실행 시 (Wave 0 단계 — viewer 미변경): 기존 6 케이스 PASS, 신규 5 케이스는 FAIL 또는 SKIP 상태로 카운트되어 출력에 등장. `--run` flag로 watch 미사용.
    - typecheck 회귀 없음: `pnpm --filter @grapit/web typecheck` exit 0
  </acceptance_criteria>
  <done>
seat-map-viewer.test.tsx가 mock 확장 (MiniMap + useIsMobile) + 신규 5 케이스 추가 완료. 기존 6 회귀 케이스는 GREEN 유지. 12-03 구현 후 신규 케이스도 GREEN 전환 가능한 상태.
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
- [ ] 신규 파일 2개(`svg-preview.test.tsx`, `use-is-mobile.test.ts`) 생성됨
- [ ] 기존 파일 1개(`seat-map-viewer.test.tsx`) mock 확장 + 5 케이스 추가됨
- [ ] vitest `--run` 모드로 3개 파일 실행 시 출력에 신규 케이스가 모두 등장 (RED 또는 GREEN 무관)
- [ ] 기존 seat-map-viewer 6 케이스는 GREEN 유지 (회귀 0)
- [ ] typecheck 0 에러
</verification>

<success_criteria>
- 자동: 위 verification 4개 항목 모두 충족
- Nyquist sampling: 12-VALIDATION.md §"Sampling Rate"의 quick run 명령(`pnpm --filter @grapit/web test -- seat-map-viewer use-is-mobile svg-preview --run`) 가 3개 파일 모두 실행에 포함시킴
</success_criteria>

<output>
After completion, create `.planning/phases/12-ux/12-00-SUMMARY.md`:
- 신규/갱신 파일 3개 + 케이스 카운트
- 기존 6 회귀 케이스 GREEN 유지 증거
- 신규 케이스 RED 카운트 (12-02/12-03 GREEN 전환 대상)
- typecheck 결과
</output>
