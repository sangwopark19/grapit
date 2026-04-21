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

// reviews revision MED #6 (also applied here): dynamic import via variable specifier
// to keep Wave 0 typecheck exit 0 even though `../use-is-mobile` is authored in Plan 12-02.
// `moduleSpecifier` is a runtime string (not literal), so TS bundler resolution defers.
const moduleSpecifier = '../use-is-mobile';
type UseIsMobileModule = {
  useIsMobile: () => boolean;
  getServerSnapshot: () => boolean;
};

async function loadModule(): Promise<UseIsMobileModule> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = (await import(moduleSpecifier)) as any;
  return mod as UseIsMobileModule;
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

    const { useIsMobile } = await loadModule();
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

    const { useIsMobile } = await loadModule();
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

    const { useIsMobile } = await loadModule();
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
    const { getServerSnapshot } = await loadModule();
    expect(getServerSnapshot()).toBe(false);
  });
});
