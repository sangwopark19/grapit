# Phase 12: UX 현대화 - Pattern Map

**Mapped:** 2026-04-21
**Files analyzed:** 10 (수정 6 + 신규 4)
**Analogs found:** 9 / 10 (use-is-mobile.ts는 codebase에 useSyncExternalStore 선례 없음 — RESEARCH.md §Pattern 3 의존)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/app/globals.css` | config (CSS tokens) | build-time transform | 자기 자신 — 기존 `@theme` 토큰 정의 + `@keyframes shake` | exact (in-file pattern) |
| `apps/web/components/booking/seat-map-viewer.tsx` | component (client) | event-driven + transform | 자기 자신 — 기존 `processedSvg useMemo` + ref-based handlers | exact (in-file pattern) |
| `apps/web/components/admin/svg-preview.tsx` | component (client) | request-response (presigned PUT) | 자기 자신 — 기존 `handleSvgUpload` callback + sonner toast | exact (in-file pattern) |
| `apps/web/components/home/hot-section.tsx` | component (client RSC fragment) | CRUD (read) | 자기 자신 — 기존 `<section className="mt-12">` | exact (1줄 변경) |
| `apps/web/components/home/new-section.tsx` | component | CRUD (read) | 자기 자신 | exact (1줄 변경) |
| `apps/web/components/home/genre-grid.tsx` | component (static) | static | 자기 자신 | exact (1줄 변경) |
| `apps/web/hooks/use-is-mobile.ts` | hook (client) | event-driven (matchMedia subscribe) | `apps/web/hooks/use-countdown.ts` (구조 유사: 'use client' + 단일 export 함수형 hook) | role-match (state 패턴은 다름 — 신규 useSyncExternalStore 패턴 도입) |
| `apps/web/components/admin/__tests__/svg-preview.test.tsx` | test (vitest + jsdom) | unit | `apps/web/app/auth/reset-password/__tests__/reset-password.test.tsx` (sonner toast mock + apiClient mock + fetch stub) | exact (sonner+presigned 패턴 동일) |
| `apps/web/hooks/__tests__/use-is-mobile.test.ts` | test (vitest renderHook) | unit | `apps/web/hooks/__tests__/use-countdown.test.ts` (renderHook + vi.useFakeTimers/stubGlobal) | role-match (matchMedia mock은 신규) |
| `apps/web/components/booking/__tests__/seat-map-viewer.test.tsx` | test (벌써 존재) | unit | 자기 자신 — 라인 7-18의 react-zoom-pan-pinch mock 확장 | exact (in-file extension) |

## Pattern Assignments

### `apps/web/app/globals.css` (config, build-time)

**Analog (in-file):** `apps/web/app/globals.css` 자기 자신

**기존 `@theme` 토큰 패턴 (lines 3-101) — 신규 token 추가 시 동일 형식 유지:**
```css
/* Source: globals.css lines 55-67 — spacing/typography 토큰 등록 패턴 */
@theme {
  /* ... */
  /* Spacing scale (4px base, 8-point grid) */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  /* ... */

  /* Typography scale (semantic tokens) */
  --text-display: 28px;
  --text-heading: 20px;
  --text-caption: 14px;

  /* Animation */
  --animate-in: enter 0.2s ease-out;
  --animate-out: exit 0.15s ease-in;
}
```

**기존 `@keyframes` 정의 위치 (lines 73-100) — `@theme` 블록 *내부*에 정의:**
```css
/* Source: globals.css lines 73-100 — Tailwind v4는 @theme 안의 @keyframes도 인식 */
@keyframes enter {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes exit { /* ... */ }

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  /* ... */
}
```

**신규 추가는 동일 위치에 (Phase 12 — D-12 체크마크 fade-in):**
```css
/* INSERT inside @theme block, after existing @keyframes shake */
@keyframes seat-checkmark-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

**Pitfall:** `:root { --shadow-sm: ... }`만 정의하면 Tailwind utility 자동 생성 안 됨. 반드시 `@theme {}` 블록 내부 (RESEARCH.md §Pitfall 1 + §Anti-pattern 3).

**`:root` 미러 패턴 (lines 110-116) — namespace 외 변수 노출용:**
```css
/* Source: globals.css lines 103-116 — chart palette 처럼 namespace 외 변수는 :root 별도 정의 */
:root {
  --chart-1: #6C3CE0;
  /* ... */
}
```
Phase 12 토큰(`--shadow-*`, `--radius-*`, `--animate-seat-*`)은 모두 namespace 안 → `:root` 미러 불필요.

**reduced-motion override 패턴 (코드베이스 신규 도입):**
```css
/* INSERT outside @theme block, after :root selector */
[data-seat-checkmark] {
  animation: seat-checkmark-fade-in 150ms ease-out forwards;
}

@media (prefers-reduced-motion: reduce) {
  [data-seat-checkmark] {
    animation: none;
    opacity: 1;
  }
}
```

---

### `apps/web/components/booking/seat-map-viewer.tsx` (component, event-driven)

**Analog (in-file):** `seat-map-viewer.tsx` 자기 자신 — Phase 12 변경은 모두 기존 패턴 확장

**Imports 패턴 (lines 1-9) — 신규 import 추가 시 동일 형식:**
```tsx
'use client';

import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Loader2, RefreshCw } from 'lucide-react';
import type { SeatMapConfig, SeatState } from '@grapit/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SeatMapControls } from './seat-map-controls';
```

**Phase 12 신규 import (UX-05/UX-06):**
```tsx
import { TransformWrapper, TransformComponent, MiniMap } from 'react-zoom-pan-pinch';
import { useIsMobile } from '@/hooks/use-is-mobile';
```

**상수 정의 패턴 (lines 20-21) — 매직 컬러는 const 분리:**
```tsx
const LOCKED_COLOR = '#D1D5DB';
const SELECTED_STROKE = '#1A1A2E';
```
Phase 12에서는 신규 상수 추가 없음 (UI-SPEC `--color-primary` 토큰 그대로 hardcode 사용 OK — 미니맵 borderColor `"#6C3CE0"`).

**핵심 패턴: processedSvg useMemo + DOMParser + DOM 조작 (lines 68-147):**
```tsx
// Source: seat-map-viewer.tsx lines 68-147 — Phase 12 주 수정 영역
const processedSvg = useMemo(() => {
  if (!rawSvg) return null;

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawSvg, 'image/svg+xml');
  const seats = doc.querySelectorAll('[data-seat-id]');

  seats.forEach((el) => {
    const seatId = el.getAttribute('data-seat-id');
    if (!seatId) return;

    const tierInfo = tierColorMap.get(seatId);
    const state = seatStates.get(seatId) ?? 'available';
    const isSelected = selectedSeatIds.has(seatId);

    if (isSelected && tierInfo) {
      el.setAttribute('fill', tierInfo.color);
      el.setAttribute('stroke', SELECTED_STROKE);
      el.setAttribute('stroke-width', '3');
      el.setAttribute('style', 'cursor:pointer;opacity:1;transition:none');  // L88 — Phase 12 변경

      // Inject white checkmark centered on seat (L91-120)
      const svgNs = 'http://www.w3.org/2000/svg';
      const checkEl = doc.createElementNS(svgNs, 'text');
      // ... 위치 계산 ...
      if (cx !== null && cy !== null) {
        checkEl.setAttribute('x', String(cx));
        // ...
        checkEl.setAttribute('pointer-events', 'none');
        // Phase 12 신규 추가: data-seat-checkmark attr (CSS @keyframes 트리거)
        checkEl.textContent = '✓';
        el.parentNode?.insertBefore(checkEl, el.nextSibling);
      }
    } else if (state === 'locked' || state === 'sold') {
      // L121-125 — Phase 12 변경 없음 (D-13 broadcast 즉시 플립)
      el.setAttribute('style', 'cursor:not-allowed;opacity:0.6;transition:none');
    } else if (tierInfo) {
      // L126-130 — Phase 12 변경 없음
      el.setAttribute('style', 'cursor:pointer;opacity:1;transition:none');
    }
  });

  // viewBox 보장 (L134-140) — Phase 12에서 STAGE 오버레이 삽입 위치
  const svgEl = doc.documentElement;
  if (!svgEl.getAttribute('viewBox')) { /* ... */ }
  // [INSERT D-07 stage badge overlay here — viewBox 결정 직후]
  svgEl.removeAttribute('width');
  svgEl.removeAttribute('height');
  svgEl.setAttribute('style', 'width:100%;height:auto;display:block;');

  return doc.documentElement.outerHTML;
}, [rawSvg, seatStates, selectedSeatIds, tierColorMap]);
```

**ref-based 성능 패턴 (lines 167-213) — 미니맵에서도 동일 원칙(React state 회피):**
```tsx
// Source: seat-map-viewer.tsx lines 167-213 — useRef + 직접 DOM 조작 + state 회피
const handleMouseOver = useCallback(
  (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest<SVGElement>('[data-seat-id]');
    // ...
    if (containerRect && tooltipRef.current) {
      tooltipRef.current.style.left = `${x}px`;  // 직접 DOM 갱신
      tooltipRef.current.style.top = `${y}px`;
      tooltipRef.current.style.display = 'block';
    }
  },
  [seatStates, selectedSeatIds, tierColorMap],
);
```

**TransformWrapper 블록 패턴 (lines 276-303) — Phase 12 미니맵/모바일 분기 삽입:**
```tsx
// Source: seat-map-viewer.tsx lines 276-303
return (
  <div className="relative overflow-hidden rounded-lg bg-gray-50">
    <TransformWrapper
      initialScale={1}                          // Phase 12: {isMobile ? 1.4 : 1}
      minScale={0.5}                            // 유지
      maxScale={4}                              // 유지
      centerOnInit                              // 유지
      wheel={{ step: 0.1 }}
      doubleClick={{ disabled: true }}
    >
      <SeatMapControls />
      {/* Phase 12: <MiniMap> 컴포넌트 데스크톱 전용 마운트 — 여기 삽입 */}
      <TransformComponent
        wrapperClass="w-full min-h-[300px] lg:min-h-[500px]"
        contentClass="w-full"
        wrapperStyle={{ width: '100%', maxWidth: '100%' }}
        contentStyle={{ width: '100%' }}
      >
        <div
          ref={containerRef}
          role="grid"
          aria-label="좌석 배치도"
          onClick={handleClick}
          onMouseOver={handleMouseOver}
          onMouseOut={handleMouseOut}
          dangerouslySetInnerHTML={{ __html: processedSvg }}
        />
      </TransformComponent>
    </TransformWrapper>
    <div ref={tooltipRef} className="pointer-events-none absolute z-50 ..." />
  </div>
);
```

**Error/loading 분기 패턴 (lines 240-274) — Phase 12 변경 없음, 그대로 유지:**
```tsx
// Source: seat-map-viewer.tsx lines 240-274
if (error) { /* ... 새로고침 버튼 ... */ }
if (isLoading) { /* ... Skeleton + spinner ... */ }
if (!processedSvg) { /* ... 좌석 배치도가 준비되지 않았습니다 ... */ }
```

---

### `apps/web/components/admin/svg-preview.tsx` (component, request-response)

**Analog (in-file):** 자기 자신 — Phase 12는 `handleSvgUpload` 콜백 안 검증 prepend

**Imports 패턴 (lines 1-9):**
```tsx
'use client';

import { useState, useCallback } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { SeatMapConfig } from '@grapit/shared';
import { usePresignedUpload, useSaveSeatMap } from '@/hooks/use-admin';
import { TierEditor } from '@/components/admin/tier-editor';
import { Button } from '@/components/ui/button';
```

**핵심 핸들러 패턴 (lines 31-62) — 검증 → presigned → R2 PUT 순서:**
```tsx
// Source: svg-preview.tsx lines 31-62 — Phase 12 변경 영역 (검증 prepend)
const handleSvgUpload = useCallback(
  async (file: File) => {
    // Step 1: 클라이언트 사전 검증 (size)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('SVG 파일은 10MB 이하여야 합니다.');
      return;
    }
    // [INSERT Phase 12 D-06/D-08: stage marker 검증 — 여기에 prepend, R2 PUT 이전]

    try {
      // Step 2: presigned URL 발급
      const { uploadUrl, publicUrl } = await presignedUpload.mutateAsync({
        folder: 'seat-maps',
        contentType: 'image/svg+xml',
        extension: 'svg',
      });
      // Step 3: R2 PUT
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': 'image/svg+xml' },
      });
      setSvgUrl(publicUrl);

      // Step 4: 좌석 카운트 (file.text() 호출 — Phase 12 검증과 중복, 변수 재사용 가능)
      const text = await file.text();
      const seatCount = (text.match(/data-seat-id/g) || []).length;
      setTotalSeats(seatCount);

      toast.success('좌석맵 SVG가 업로드되었습니다.');
    } catch {
      toast.error('SVG 업로드에 실패했습니다.');
    }
  },
  [presignedUpload],
);
```

**중요 동작:**
- `toast.error()`로 검증 실패 사용자 피드백 (lines 34, 58, 73, 84 모두 이 패턴).
- `useCallback` deps는 `[presignedUpload]` 유지 (검증 추가해도 상태 의존성 신규 없음).
- 검증 실패 시 early `return` — `presignedUpload.mutateAsync` 호출 없이 함수 종료.

**검증 패턴 (DOMParser — RESEARCH.md §Pattern + §Pitfall 8):**
```tsx
// Source: RESEARCH.md §Code Examples / svg-preview.tsx 변경 후
const text = await file.text();
const parser = new DOMParser();
const doc = parser.parseFromString(text, 'image/svg+xml');
const hasStageText = Array.from(doc.querySelectorAll('text')).some(
  (t) => t.textContent?.trim() === 'STAGE'
);
const hasDataStage = doc.documentElement.hasAttribute('data-stage')
  || doc.querySelector('[data-stage]') !== null;
if (!hasStageText && !hasDataStage) {
  toast.error(
    '스테이지 마커가 없는 SVG입니다. <text>STAGE</text> 또는 data-stage 속성을 포함해주세요.'
  );
  return;
}
```
**참고:** seat-map-viewer.tsx도 동일한 `parser.parseFromString(text, 'image/svg+xml')` 패턴 사용 (line 73). 일관성 확보.

---

### `apps/web/components/home/hot-section.tsx` (component, CRUD-read)

**Analog (in-file):** 자기 자신

**현재 패턴 (line 19) — Phase 12 변경 1줄:**
```tsx
// Source: hot-section.tsx line 19
return (
  <section className="mt-12">  {/* Phase 12: mt-12 → mt-10 */}
    <div className="mb-6 flex items-center justify-between">
      <h2 className="text-display font-semibold leading-[1.2]">HOT 공연</h2>
      {/* ... */}
```

`section` wrapper의 `mt-12` 클래스만 `mt-10`으로 교체. 다른 모든 className/구조 유지 (D-04: 새 컴포넌트 추가/구조 재편 금지).

---

### `apps/web/components/home/new-section.tsx` (component, CRUD-read)

**Analog (in-file):** 자기 자신

**현재 패턴 (line 15):**
```tsx
// Source: new-section.tsx line 15
return (
  <section className="mt-12">  {/* Phase 12: mt-12 → mt-10 */}
```
hot-section.tsx와 정확히 동일 패턴. 1줄 변경.

---

### `apps/web/components/home/genre-grid.tsx` (component, static)

**Analog (in-file):** 자기 자신

**현재 패턴 (line 44):**
```tsx
// Source: genre-grid.tsx line 44
return (
  <section className="mt-12 pb-12">  {/* Phase 12: mt-12 → mt-10, pb-12 유지 */}
    <h2 className="mb-6 text-display font-semibold leading-[1.2]">장르별 바로가기</h2>
```
주의: `pb-12`는 유지 (페이지 하단 여백). `mt-12`만 `mt-10`로 변경.

---

### `apps/web/hooks/use-is-mobile.ts` (hook, event-driven) — NEW

**Closest analog:** `apps/web/hooks/use-countdown.ts`

**Reason:** 코드베이스에 `useSyncExternalStore` 선례 0건 (Grep 검증). use-countdown.ts가 가장 유사한 단일 export hook 구조를 보유.

**구조 패턴 (use-countdown.ts lines 1-3, 12-58 발췌):**
```tsx
// Source: apps/web/hooks/use-countdown.ts lines 1-3 — 'use client' + 'react' import 패턴
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface CountdownResult {
  minutes: number;
  seconds: number;
  isWarning: boolean;
  isActive: boolean;
}

export function useCountdown(
  expiresAt: number | null,
  onExpire: () => void,
): CountdownResult {
  // ...
}
```

**핵심 채택 사항 (use-countdown 에서 차용):**
- `'use client'` directive (file 상단).
- 단일 export, 함수형 — class 금지 (CLAUDE.md: 함수형 우선).
- 명시적 return type (`CountdownResult`/`boolean`) — `any` 금지 (CLAUDE.md: strict typing).
- `react`에서 직접 hook import (배럴 사용 안 함).

**use-is-mobile.ts 신규 구현 (RESEARCH.md §Pattern 3 — codebase 첫 도입):**
```tsx
// Source: RESEARCH.md §Code Examples / hooks/use-is-mobile.ts (신규)
'use client';

import { useSyncExternalStore } from 'react';

const MOBILE_QUERY = '(max-width: 767px)';

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;  // SSR fallback: desktop (initialScale=1)
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

**Pitfall:** `TransformWrapper`의 `initialScale`은 mount 시 1회만 평가 — `key={isMobile ? 'm' : 'd'}` 강제 재마운트 필요 (RESEARCH.md §Pitfall 2 + Pitfall 4).

---

### `apps/web/components/admin/__tests__/svg-preview.test.tsx` (test) — NEW

**Closest analog:** `apps/web/app/auth/reset-password/__tests__/reset-password.test.tsx`

**Reason:** sonner toast mock + apiClient mock + fetch stubGlobal 3개 패턴 모두 동일 use case.

**Imports 패턴 (reset-password.test.tsx lines 1-3):**
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
```

**sonner toast mock 패턴 (reset-password.test.tsx lines 25-28):**
```tsx
// Source: app/auth/reset-password/__tests__/reset-password.test.tsx lines 25-28
// sonner toast mock — confirm success path uses toast.success
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
```

**apiClient/hook mock 패턴 (reset-password.test.tsx lines 30-39):**
```tsx
// Source: lines 30-39 — apps/web/lib/api-client mock
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: vi.fn().mockResolvedValue({}),
    get: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));
```

**use-admin hook mock 패턴 (svg-preview.tsx 의존성 — 신규 작성):**
```tsx
// 신규 — usePresignedUpload + useSaveSeatMap mock
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
```

**fetch stub + restore 패턴 (reset-password.test.tsx lines 42-50):**
```tsx
// Source: reset-password.test.tsx lines 42-50
beforeEach(() => {
  // ...
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});
```

**파일 업로드 트리거 패턴 (jsdom + File constructor 사용 — Phase 12 신규 작성, 표준 vitest+RTL 패턴):**
```tsx
// 신규 — File 객체 생성 + fireEvent.change(input, { target: { files } })
import { fireEvent } from '@testing-library/react';

const goodSvg = '<svg xmlns="http://www.w3.org/2000/svg"><text>STAGE</text><rect data-seat-id="A-1"/></svg>';
const badSvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect data-seat-id="A-1"/></svg>';

const file = new File([badSvg], 'bad.svg', { type: 'image/svg+xml' });
const input = container.querySelector('#svg-input') as HTMLInputElement;
fireEvent.change(input, { target: { files: [file] } });

// 검증
await waitFor(() => {
  expect(toastErrorSpy).toHaveBeenCalledWith(expect.stringContaining('스테이지 마커'));
  expect(mockMutateAsync).not.toHaveBeenCalled();  // R2 presigned 호출 X
});
```

---

### `apps/web/hooks/__tests__/use-is-mobile.test.ts` (test) — NEW

**Closest analog:** `apps/web/hooks/__tests__/use-countdown.test.ts`

**Reason:** 동일한 `renderHook` + `vi.useFakeTimers`/`vi.useRealTimers` setup/teardown + 단일 hook 테스트 구조. matchMedia stub은 신규 (codebase에 stubGlobal('matchMedia') 선례 0건).

**기본 구조 (use-countdown.test.ts lines 1-12):**
```tsx
// Source: apps/web/hooks/__tests__/use-countdown.test.ts lines 1-12
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCountdown } from '../use-countdown';

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
```

**테스트 케이스 패턴 (use-countdown.test.ts lines 14-26):**
```tsx
// Source: lines 14-26 — renderHook + result.current 검증
it('returns correct initial state when expiresAt is 600s from now', () => {
  const now = Date.now();
  const expiresAt = now + 600_000;
  const onExpire = vi.fn();

  const { result } = renderHook(() => useCountdown(expiresAt, onExpire));

  expect(result.current.isActive).toBe(true);
  // ...
});
```

**use-is-mobile.test.ts 신규 작성 — matchMedia mock (vi.stubGlobal 활용, reset-password.test.tsx의 `vi.stubGlobal('fetch', ...)` 패턴 적용):**
```tsx
// 신규 — matchMedia mock + addEventListener/removeEventListener 추적
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockListeners: Array<() => void> = [];
const mockMatchMedia = (matches: boolean) => vi.fn().mockReturnValue({
  matches,
  addEventListener: vi.fn((_event: string, cb: () => void) => mockListeners.push(cb)),
  removeEventListener: vi.fn(),
});

describe('useIsMobile', () => {
  beforeEach(() => {
    mockListeners.length = 0;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('데스크톱 viewport에서 false 반환', async () => {
    vi.stubGlobal('matchMedia', mockMatchMedia(false));
    const { useIsMobile } = await import('../use-is-mobile');
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('모바일 viewport에서 true 반환', async () => {
    vi.stubGlobal('matchMedia', mockMatchMedia(true));
    const { useIsMobile } = await import('../use-is-mobile');
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('matchMedia change 이벤트로 리렌더', async () => {
    vi.stubGlobal('matchMedia', mockMatchMedia(false));
    const { useIsMobile } = await import('../use-is-mobile');
    const { result } = renderHook(() => useIsMobile());
    act(() => { mockListeners.forEach((cb) => cb()); });
    // matches mock은 정적이므로 정확히 검증하려면 mock 함수를 동적으로 교체
  });
});
```

**SSR fallback 검증 — vitest는 jsdom 기본 환경이므로 `typeof window` 분기는 자동 테스트 어려움. 통상적으로 `getServerSnapshot()` 직접 import + 호출로 검증:**
```tsx
import { /* internal export 또는 hook 직접 호출 */ } from '../use-is-mobile';
// 또는 hook 모듈에서 helper 별도 export 후 단위 테스트
```

---

### `apps/web/components/booking/__tests__/seat-map-viewer.test.tsx` (test) — UPDATE

**Analog (in-file):** 자기 자신 — 라인 7-18 mock 확장

**기존 react-zoom-pan-pinch mock (lines 7-18):**
```tsx
// Source: seat-map-viewer.test.tsx lines 7-18
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

**Phase 12 mock 확장 (RESEARCH.md §Wave 0 Gaps):**
```tsx
// 변경 후 — MiniMap 추가 + TransformWrapper가 initialScale 캡처 가능하도록 spy 변환
const transformWrapperSpy = vi.fn();
vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: (props: any) => {
    transformWrapperSpy(props);
    return <div data-testid="transform-wrapper">{props.children}</div>;
  },
  TransformComponent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="transform-component">{children}</div>
  ),
  MiniMap: ({ children, ...rest }: { children: React.ReactNode }) => (
    <div data-testid="mini-map" {...rest}>{children}</div>
  ),
}));
```

**use-is-mobile mock (Phase 12 신규):**
```tsx
const mockUseIsMobile = vi.fn();
vi.mock('@/hooks/use-is-mobile', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));
```

**기존 fetch mock 패턴 (lines 40-45) — 그대로 유지:**
```tsx
// Source: lines 40-45
beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(SVG_CONTENT),
  });
});
```

**기존 케이스 패턴 (lines 47-73) — 신규 케이스도 동일 구조 따름:**
```tsx
// Source: lines 47-73 — render + waitFor + container.querySelector + expect.attribute
it('renders available seats with tier color fill', async () => {
  const seatStates = new Map<string, SeatState>([
    ['A-1', 'available'],
  ]);

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
    const seatA1 = container.querySelector('[data-seat-id="A-1"]');
    expect(seatA1?.getAttribute('fill')).toBe('#6C3CE0');
  });
});
```

**Phase 12 추가 케이스 (RESEARCH.md §Wave 0 Gaps + §Validation Architecture lines 1002-1006):**

1. **선택 좌석 transition 검증 (UX-04):**
   ```tsx
   it('선택 좌석에 transition:fill 150ms이 inline style로 포함된다', async () => {
     mockUseIsMobile.mockReturnValue(false);
     const { container } = render(<SeatMapViewer ... selectedSeatIds={new Set(['A-1'])} />);
     await waitFor(() => {
       const seatA1 = container.querySelector('[data-seat-id="A-1"]') as SVGElement;
       expect(seatA1.getAttribute('style')).toContain('fill 150ms');
     });
   });

   it('locked 좌석은 transition:none을 유지한다 (D-13)', async () => {
     // ... seatStates: locked
     expect(seatA1.getAttribute('style')).toContain('transition:none');
   });
   ```

2. **체크마크 data attribute 검증 (UX-04):**
   ```tsx
   it('선택 좌석에 data-seat-checkmark 속성을 가진 <text> 요소가 삽입된다', async () => {
     // ... selectedSeatIds: A-1
     await waitFor(() => {
       expect(container.querySelector('[data-seat-checkmark]')).toBeTruthy();
     });
   });
   ```

3. **미니맵 마운트 분기 검증 (UX-05):**
   ```tsx
   it('데스크톱(isMobile=false)에서 MiniMap이 마운트된다', async () => {
     mockUseIsMobile.mockReturnValue(false);
     render(<SeatMapViewer ... />);
     await waitFor(() => {
       expect(screen.queryByTestId('mini-map')).toBeTruthy();
     });
   });

   it('모바일(isMobile=true)에서 MiniMap이 마운트되지 않는다', async () => {
     mockUseIsMobile.mockReturnValue(true);
     render(<SeatMapViewer ... />);
     await waitFor(() => {
       expect(screen.queryByTestId('mini-map')).toBeFalsy();
     });
   });
   ```

4. **모바일 initialScale 검증 (UX-06):**
   ```tsx
   it('isMobile=true 시 TransformWrapper에 initialScale=1.4 전달', async () => {
     mockUseIsMobile.mockReturnValue(true);
     render(<SeatMapViewer ... />);
     await waitFor(() => {
       expect(transformWrapperSpy).toHaveBeenCalledWith(
         expect.objectContaining({ initialScale: 1.4 })
       );
     });
   });
   ```

5. **STAGE 배지 오버레이 검증 (UX-02 viewer):**
   ```tsx
   it('SVG에 data-stage 속성만 있을 때 viewer가 STAGE 배지를 오버레이로 추가한다', async () => {
     global.fetch = vi.fn().mockResolvedValue({
       ok: true,
       text: () => Promise.resolve(`<svg xmlns="..." data-stage="top" viewBox="0 0 400 200"><rect data-seat-id="A-1"/></svg>`),
     });
     const { container } = render(<SeatMapViewer ... />);
     await waitFor(() => {
       const stageText = Array.from(container.querySelectorAll('text')).find(
         (t) => t.textContent === 'STAGE'
       );
       expect(stageText).toBeTruthy();
     });
   });
   ```

---

## Shared Patterns

### Pattern S1: 'use client' directive 위치
**Source:** 모든 client component (`seat-map-viewer.tsx:1`, `svg-preview.tsx:1`, `hot-section.tsx:1`, `use-countdown.ts:1`)
**Apply to:** `use-is-mobile.ts`, 그 외 모든 신규 hook/component
```tsx
'use client';

import { /* react/external */ } from '...';
```
파일 첫 줄(공백 없음). React 19 + Next.js 16 App Router 표준.

### Pattern S2: sonner toast 사용
**Source:** `svg-preview.tsx:5,34,56,58,73,82,84` — Phase 12에서도 동일 패턴 재사용
**Apply to:** Admin SVG 검증 실패(D-06/D-08)
```tsx
import { toast } from 'sonner';
// ...
toast.error('스테이지 마커가 없는 SVG입니다. <text>STAGE</text> 또는 data-stage 속성을 포함해주세요.');
toast.success('좌석맵 SVG가 업로드되었습니다.');
```
**중요:** 자체 알림 컴포넌트 신규 작성 금지 (RESEARCH.md §Don't Hand-Roll). `Toaster`는 `apps/web/components/ui/sonner.tsx`에 이미 마운트.

### Pattern S3: DOMParser SVG 파싱
**Source:** `seat-map-viewer.tsx:72-73` — Admin svg-preview.tsx 검증도 동일 패턴
**Apply to:** Admin SVG 업로드 검증, viewer STAGE 배지 오버레이
```tsx
const parser = new DOMParser();
const doc = parser.parseFromString(text, 'image/svg+xml');
// 정규식 매칭 금지 (RESEARCH.md §Pitfall 8)
const hasStageText = Array.from(doc.querySelectorAll('text')).some(
  (t) => t.textContent?.trim() === 'STAGE'
);
```

### Pattern S4: vitest mock 순서 (top-of-file hoisted)
**Source:** `reset-password.test.tsx:9-28`, `use-socket.test.ts:6-51`, `seat-map-viewer.test.tsx:7-22`
**Apply to:** 모든 신규 vitest 파일
```tsx
// 1) imports
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, ... } from '@testing-library/react';

// 2) hoisted vi.mock (절대 함수 안에 두지 말 것)
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/use-admin', () => ({ /* ... */ }));

// 3) (선택) lazy import for swappable mocks
// const { foo } = await import('../foo')  안에서 호출

// 4) describe(...)
```

### Pattern S5: strict TypeScript (CLAUDE.md)
**Source:** 모든 기존 파일 — `any` 0건 (svg-preview.tsx, seat-map-viewer.tsx, use-countdown.ts 모두)
**Apply to:** 모든 신규 코드
- 명시적 return type (`: boolean`, `: CountdownResult`).
- 명시적 parameter type (`React.MouseEvent`, `() => void`).
- 신규 hook의 return은 단일 primitive 또는 명시적 interface.
- 라이브러리 타입 직접 import (예: `MiniMapProps` from `react-zoom-pan-pinch`).

### Pattern S6: aria-label 한글 명명
**Source:** `seat-map-viewer.tsx:295-296` (`role="grid" aria-label="좌석 배치도"`), `svg-preview.tsx:97-98` (`aria-label="좌석맵 미리보기"`)
**Apply to:** 신규 미니맵 컨테이너, STAGE 오버레이 `<g>`
```tsx
<g aria-label={`무대 위치: ${dataStage}`}>...</g>  // SVG 내부
<MiniMap aria-label="좌석 미니맵" />              // HTML wrapper
```

### Pattern S7: useCallback dependency 보수성
**Source:** `seat-map-viewer.tsx:163-165, 211-212, 236-237`, `svg-preview.tsx:60-61`
**Apply to:** Phase 12 변경 시 `useCallback`/`useMemo` deps 수정 — 신규 분기 추가 시 새 deps 빠짐 없음
```tsx
// 예: processedSvg useMemo deps (line 147)
}, [rawSvg, seatStates, selectedSeatIds, tierColorMap]);
// Phase 12: 위 4개로 충분. STAGE 오버레이는 rawSvg에서 파싱하므로 신규 deps 불필요.
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (없음) | — | — | 모든 신규/수정 파일은 코드베이스 내 유사 분석체 또는 자기 자신 패턴 보유. `use-is-mobile.ts`의 `useSyncExternalStore` 패턴은 코드베이스 첫 도입이지만 React 19 표준 + RESEARCH.md §Pattern 3 직접 검증 코드 제공 → 신규 패턴이지만 high-confidence. |

---

## Metadata

**Analog search scope:**
- `apps/web/hooks/`, `apps/web/hooks/__tests__/`
- `apps/web/components/booking/`, `apps/web/components/admin/`, `apps/web/components/home/`
- `apps/web/components/auth/__tests__/`, `apps/web/app/auth/reset-password/__tests__/`
- `apps/web/lib/`, `apps/web/components/ui/`
- `apps/web/app/globals.css`, `apps/web/vitest.config.ts`

**Files scanned:** 18 (직접 read) + Glob/Grep 다수
**Pattern extraction date:** 2026-04-21
**Phase:** 12 - UX 현대화
**Downstream consumer:** gsd-planner (PLAN.md 생성 시 Pattern Assignments 섹션을 plan action 단계의 "Copy from" 인용으로 활용)
