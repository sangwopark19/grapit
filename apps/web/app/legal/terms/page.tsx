import type { Metadata } from 'next';
import termsMd from '@/content/legal/terms-of-service.md?raw';
import { TermsMarkdown } from '@/components/legal/terms-markdown';
import { getLegalRobots } from '../robots';

export const dynamic = 'force-static';

/**
 * Phase 16 review HIGH-4 (codex) — preview/staging 환경 noindex 강제.
 * D-12 의 "검색 엔진 색인 허용" lock 은 prod 기준. placeholder leak 위험 기간 동안
 * preview/non-prod 환경이 색인되지 않도록 환경 변수로 분기.
 * GRABIT_ENV: 'production' | 'preview' | 'development' | undefined.
 * GRABIT_ENV 가 누락된 production build 는 NODE_ENV=production 을 fallback 으로 사용한다.
 */
export const metadata: Metadata = {
  title: '이용약관 — Grabit',
  description: 'Grabit 서비스 이용 조건과 회원·회사의 권리·의무를 안내합니다.',
  alternates: {
    canonical: 'https://heygrabit.com/legal/terms',
  },
  robots: getLegalRobots(),
};

export default function TermsPage() {
  return <TermsMarkdown showH1>{termsMd}</TermsMarkdown>;
}
