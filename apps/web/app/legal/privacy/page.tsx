import type { Metadata } from 'next';
import privacyMd from '@/content/legal/privacy-policy.md?raw';
import { TermsMarkdown } from '@/components/legal/terms-markdown';

export const dynamic = 'force-static';

// Phase 16 review HIGH-4: prod 만 index. preview/staging 은 noindex (placeholder 누출 차단)
const isProd = process.env.GRABIT_ENV === 'production';

export const metadata: Metadata = {
  title: '개인정보처리방침 — Grabit',
  description:
    'Grabit이 수집·이용하는 개인정보 항목과 처리 목적, 보유 기간 및 이용자의 권리를 안내합니다.',
  alternates: {
    canonical: 'https://heygrabit.com/legal/privacy',
  },
  robots: {
    index: isProd,
    follow: isProd,
  },
};

export default function PrivacyPage() {
  return <TermsMarkdown showH1>{privacyMd}</TermsMarkdown>;
}
