import type { Metadata } from 'next';
import { pretendard } from './fonts';
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
      <body>{children}</body>
    </html>
  );
}
