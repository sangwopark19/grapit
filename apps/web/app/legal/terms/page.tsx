import type { Metadata } from 'next';
import termsMd from '@/content/legal/terms-of-service.md?raw';
import { TermsMarkdown } from '@/components/legal/terms-markdown';

export const dynamic = 'force-static';

/**
 * Phase 16 review HIGH-4 (codex) — preview/staging 환경 noindex 강제.
 * D-12 의 "검색 엔진 색인 허용" lock 은 prod 기준. placeholder leak 위험 기간 동안
 * preview/non-prod 환경이 색인되지 않도록 환경 변수로 분기.
 * GRABIT_ENV: 'production' | 'preview' | 'development' | undefined
 * - production → index:true, follow:true (D-12)
 * - 그 외 (preview/staging/dev) → index:false, follow:false (HIGH-4 안전 보강)
 * 빌드 시점 평가 — Cloud Run / GitHub Actions 배포 단계에서 GRABIT_ENV 주입 필요.
 */
const isProd = process.env.GRABIT_ENV === 'production';

export const metadata: Metadata = {
  title: '이용약관 — Grabit',
  description: 'Grabit 서비스 이용 조건과 회원·회사의 권리·의무를 안내합니다.',
  alternates: {
    canonical: 'https://heygrabit.com/legal/terms',
  },
  robots: {
    index: isProd,
    follow: isProd,
  },
};

export default function TermsPage() {
  return <TermsMarkdown showH1>{termsMd}</TermsMarkdown>;
}
