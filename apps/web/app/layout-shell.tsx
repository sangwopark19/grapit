'use client';

import { usePathname } from 'next/navigation';
import { GNB } from '@/components/layout/gnb';
import { Footer } from '@/components/layout/footer';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');
  const isBooking = pathname.startsWith('/booking');
  const hideShell = isAdmin || isBooking;

  return (
    <>
      {!hideShell && <GNB />}
      <div className="flex flex-1 flex-col">{children}</div>
      {!hideShell && <Footer />}
    </>
  );
}
