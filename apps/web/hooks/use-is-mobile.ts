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

/**
 * SSR snapshot — 항상 false (desktop fallback).
 *
 * `useSyncExternalStore`의 3번째 인자로 사용되며, named export로도 노출하여
 * Wave 0 unit test가 SSR fallback 정합성을 직접 검증할 수 있도록 한다 (B-4).
 *
 * @returns false (Next.js SSR HTML 생성 시 desktop initialScale=1 적용 보장)
 */
export function getServerSnapshot(): boolean {
  return false;
}

/**
 * 모바일 viewport(< 768px) 여부를 반환하는 hook.
 *
 * - SSR: false (desktop fallback)
 * - 클라이언트: matchMedia 결과 + change 이벤트 구독
 *
 * 사용처: Plan 12-03 seat-map-viewer.tsx의 TransformWrapper initialScale
 * + MiniMap 마운트 분기 (D-16/D-17).
 *
 * @see .planning/phases/12-ux/12-CONTEXT.md D-17
 * @see .planning/phases/12-ux/12-RESEARCH.md §Pattern 3
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
