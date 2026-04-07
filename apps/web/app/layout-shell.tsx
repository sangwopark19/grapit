'use client';

import { usePathname } from 'next/navigation';
import { GNB } from '@/components/layout/gnb';
import { Footer } from '@/components/layout/footer';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');
  // Hide GNB/Footer on booking seat selection and confirm pages, but show on complete page
  const isBookingCheckout =
    pathname.startsWith('/booking') && !pathname.endsWith('/complete');
  const hideShell = isAdmin || isBookingCheckout;

  return (
    <>
      {!hideShell && <GNB />}
      <div className="flex flex-1 flex-col">{children}</div>
      {!hideShell && <Footer />}
    </>
  );
}
