import type { Metadata } from 'next';
import { pretendard } from './fonts';
import { GNB } from '@/components/layout/gnb';
import { Footer } from '@/components/layout/footer';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Grapit - 공연 티켓 예매',
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
        <GNB />
        <div className="flex flex-1 flex-col">{children}</div>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
