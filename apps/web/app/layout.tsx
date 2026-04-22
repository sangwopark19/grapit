import type { Metadata } from 'next';
import { pretendard } from './fonts';
import { Toaster } from '@/components/ui/sonner';
import { AuthInitializer } from '@/components/auth/auth-initializer';
import { NetworkBanner } from '@/components/layout/network-banner';
import { Providers } from './providers';
import { LayoutShell } from './layout-shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Grabit - 공연 티켓 예매',
  description: '공연, 전시, 스포츠 등 라이브 엔터테인먼트 티켓 예매 플랫폼',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="flex min-h-screen flex-col">
        <Providers>
          <AuthInitializer />
          <NetworkBanner />
          <LayoutShell>{children}</LayoutShell>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
