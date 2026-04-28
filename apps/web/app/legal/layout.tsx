import type { ReactNode } from 'react';

/**
 * Legal pages 공통 layout (D-02)
 * 3개 페이지 (/legal/{terms,privacy,marketing}) 의 공유 container.
 * - <main> landmark 책임 (root layout 에는 <main> 없음 — LayoutShell 이 GNB/Footer/MobileTabBar 만 렌더)
 * - reading-optimized max-w-[760px] (UI-SPEC §Spacing L52-65)
 * - GNB/Footer/MobileTabBar 는 LayoutShell 자동 상속 — 본 layout 에서 중복 렌더 금지
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[760px] px-4 pt-8 pb-16 md:px-6 md:pt-12 md:pb-24">
      {children}
    </main>
  );
}
