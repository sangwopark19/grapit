# Phase 9: 기술부채 청산 - Research

**Researched:** 2026-04-14
**Domain:** Mixed — email delivery (Resend), static markdown rendering (Next.js 16), payment E2E (Playwright + Toss sandbox), refactor/dead-code cleanup
**Confidence:** HIGH (most findings VERIFIED via actual tool probes; a few Toss sandbox specifics are LOW confidence and marked)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**DEBT-01 (이메일 발송):**
- **D-01:** 이메일 프로바이더 = **Resend** (1인 개발 DX + 무료 3,000건/월 + React Email 1st-party + 한국 배달률 양호)
- **D-02:** dev/test 환경은 SMS 패턴과 동일하게 env 기반 mock — `RESEND_API_KEY` 미설정 시 console.log, 프로덕션에서만 실제 발송
- **D-03:** 이메일 템플릿은 **React Email** (`@react-email/components`) 사용
- **D-04:** Phase 9 범위 = **password reset 이메일만** (예매 확인 등은 별도 phase)
- **D-05:** `auth.service.ts:217-241`의 `requestPasswordReset`의 `console.log` stub (L240)을 Resend 호출로 교체, `EmailService` 프로바이더를 auth 모듈에 주입

**DEBT-02 (약관/개인정보처리방침):**
- **D-06:** 약관 텍스트는 **별도 Markdown 파일**로 분리 — `apps/web/content/legal/{terms-of-service,privacy-policy,marketing-consent}.md`, `?raw` import로 정적 포함
- **D-07:** 초기 텍스트는 **KOPICO 표준 개인정보처리방침 + 표준 티켓 예매 약관 템플릿** Grapit 각색. "법률 검토 전 교체 필요" 배너 유지
- **D-08:** 버전 추적은 **Git 이력만** (사용자별 동의 시점 버전 추적은 범위 외)
- **D-09:** `signup-step2.tsx:22-38`의 `TERMS_CONTENT` 인라인 placeholder를 MD 파일 import 구조로 교체

**DEBT-05 (Toss Payments E2E):**
- **D-10:** **Toss sandbox + 실 SDK 연동** — Toss 공식 테스트 카드로 실제 SDK 로딩/위젯/결제 전체 플로우 검증
- **D-11:** 커버리지 = **happy path + 실패 1-2건** (카드 성공, 결제창 취소, 카드 승인 거절)
- **D-12:** CI 트리거 = **PR + main push** (기존 social-login 패턴) — `TOSS_CLIENT_KEY_TEST` 미설정 시 skip
- **D-13:** 테스트 키 **별도 관리** — GitHub Actions secrets(`TOSS_CLIENT_KEY_TEST` / `TOSS_SECRET_KEY_TEST`) + 로컬 `.env`
- **D-14:** 실 SDK 로딩 vs `page.route()` 인터셉션 하이브리드 허용 — planner/executor 재량

**DEBT-06 (useShowtimes 정리):**
- **D-15:** `useShowtimes` 훅과 호출부 **전체 삭제**
- **D-16:** 삭제 범위 = `apps/web/hooks/use-booking.ts:26-35` 훅 정의 + `apps/web/components/booking/booking-page.tsx`의 import/호출/삼항 → `performance?.showtimes ?? []`로 단순화

**DEBT-03 (좌석맵 테스트):**
- **D-17:** 기대 동작 = locked 좌석 클릭 시 `onSeatClick` 호출 + parent toast 안내
- **D-18:** Sold 좌석은 클릭 차단 (`onSeatClick` 미호출) — locked와의 UX 차이 유지
- **D-19:** 실제 테스트 실패 여부는 planner 단계에서 확인 후 fix 방향 결정

**DEBT-04 (formatDateTime):**
- **D-20:** 시그니처를 `(dateString: string | null | undefined): string` 로 변경, null/undefined 시 '—' 반환

**실행 전략:**
- **D-21:** 3 plans — Plan 1 (빠른 정리: 03/04/06), Plan 2 (약관+이메일: 02/01), Plan 3 (Toss E2E: 05)
- **D-22:** Plan 1 → Plan 2 → Plan 3 순서

### Claude's Discretion

- Resend 환경변수 네이밍 (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`)
- React Email 템플릿 파일 위치 (`apps/api/src/modules/auth/emails/` 또는 모듈별)
- `EmailService` 프로바이더 구조 및 mock 분기 로직
- 약관 MD 파일 실 문안 세부 (KOPICO 표준 Grapit 각색)
- Toss E2E 실 SDK 로딩 vs `page.route()` 인터셉션 비율
- DEBT-03 진단 후 fix 방법 (production 코드 vs 테스트)
- `formatDateTime` 리팩터링 범위 (admin-booking-detail-modal만 vs 4개 파일 통합)
- Plan 1/2/3 commit 분할 세부 기준

### Deferred Ideas (OUT OF SCOPE)

- 예매 확인 메일 (별도 phase)
- 사용자별 약관 동의 시점 버전 추적
- 약관 문안 법률 자문 반영 (런칭 전 별도)
- `/performances/:id/showtimes` 전용 엔드포인트
- Sold 좌석 toast 안내 (Phase 12 범위)
- Toss E2E 전체 결제수단 커버 (카드 외 카카오/네이버/계좌이체)

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEBT-01 | Password reset 이메일 실구현 (console.log stub → 실 발송) | §2.1 Resend + React Email + SmsService 패턴 복제 |
| DEBT-02 | 이용약관 dialog에 실제 텍스트 적용 | §2.2 `?raw` Turbopack 지원 + react-markdown 권장 |
| DEBT-03 | seat-map-viewer.test.tsx locked seat click 회귀 수정 | §3 **현재 테스트 7/7 PASS 확인 완료** — 회귀 없음, UI-SPEC의 toast 일원화만 남음 |
| DEBT-04 | admin-booking-detail-modal formatDateTime null 경고 수정 | §3 **타입 경고 없음 (typecheck clean)** — 코드 스멜 리팩터링 |
| DEBT-05 | Toss Payments E2E 테스트 검증 | §2.5 Playwright `page.waitForEvent('popup')` + Toss 테스트 키 + 에러 URL 시뮬레이션 |
| DEBT-06 | useShowtimes hook 정리 | §2.6 삭제 지점 4곳 확인 완료, 런타임 영향 없음 (`enabled:false`) |

</phase_requirements>

## Summary

**Phase 9는 코드베이스 신뢰도 회복을 목표로 한 6건의 기술부채 청산이며, 본 리서치는 다음 3가지 핵심 진단을 했다:**

1. **DEBT-03는 실제로는 회귀가 아님.** `pnpm --filter @grapit/web test seat-map-viewer` 실제 실행 결과 **7/7 tests PASS** (§3 참조). `seat-map-viewer.tsx:161`에서 `state === 'sold'`일 때만 return하고 locked는 통과시키는 구현이 현재 올바르게 동작하며, `booking-page.tsx:192-196`에서 parent toast가 렌더된다. Plan 1은 "회귀 수정"이 아니라 UI-SPEC 권고사항(toast 인라인 style → Toaster `classNames.info` 일원화) 적용으로 진행.

2. **DEBT-04도 실제 타입 에러가 아님.** `pnpm --filter @grapit/web typecheck` 결과 에러 없음. `admin-booking-detail-modal.tsx:150`의 `booking.paymentInfo.paidAt ? formatDateTime(booking.paymentInfo.paidAt) : '—'` 삼항은 TypeScript narrowing으로 안전히 통과. D-20의 목적은 **타입 안전성 확장** + **콜사이트 코드 중복 제거**. 4개 파일에 중복 정의된 `formatDateTime`을 `apps/web/lib/format-datetime.ts` 공통 유틸로 통합하는 것이 권장 확장 범위 (UI-SPEC Implementation Notes 324-330 라인).

3. **Resend + React Email은 1st-party 통합으로 간단.** Resend 6.11.0은 `emails.send({ react: <Template/> })` 형태로 TSX 컴포넌트를 직접 받는다. `@react-email/render`의 `render()` 함수는 필요하지 않으며, Resend가 내부에서 자동 변환. 별도 `render()` 호출이 필요한 경우는 nodemailer 같은 다른 SMTP 클라이언트 사용 시뿐이다. **nodemailer 기존 설치는 제거 대상** (`apps/api/package.json`에 `nodemailer@^8.0.4` 잔존).

**Primary recommendation:** Plan 1은 **"DEBT-03/04 회귀 수정" 프레임을 "toast 일원화 + formatDateTime 공통 유틸 추출" 프레임으로 재정의**하고, Plan 2는 Resend SDK 단독 사용 (render 함수 없음), Plan 3는 Toss 공개 테스트 키(`test_gck_docs_...`) 그대로 재사용하되 CI secrets으로 분리.

## Project Constraints (from CLAUDE.md)

Phase 9 실행 시 반드시 지킬 프로젝트 직지시:

- **pnpm + DOTENV_CONFIG_PATH 규약:** drizzle-kit 같은 cwd 의존 도구는 `DOTENV_CONFIG_PATH=../../.env pnpm --filter @grapit/api exec ...` 형태로 호출. Plan 2에서 마이그레이션 없어서 무관하나, Resend 환경변수는 루트 `.env`에 추가.
- **ES 모듈:** import/export 사용. CommonJS 금지. 모든 import는 `.js` 확장자 포함 (NestJS ESM 관례).
- **Strict typing:** `any` 금지, 모든 변수 타입 있어야 함. Plan 1 DEBT-04 유틸 추출 시 strict nullable 타입 필수.
- **Tests first for business logic:** EmailService는 unit test (mock/prod 분기) 선작성.
- **Run typecheck + lint after changes:** 각 plan 완료 시 `pnpm typecheck && pnpm lint`.
- **Never bypass pre-commit:** `--no-verify` 금지. Conventional commits (`feat(09):...`, `fix(09):...`, `refactor(09):...`) 사용.
- **NO Co-Authored-By trailers:** commit message에 Claude 서명 금지 (`/Users/sangwopark19/.claude/CLAUDE.md` 명시).
- **Project-level 환경변수 규약:** `.env` 루트에 위치, `.env.example` 업데이트, Cloud Run은 Secret Manager 주입.
- **NestJS 11 + Drizzle 0.45 (stable):** Plan 2 EmailService는 NestJS DI 패턴 (ConfigService 주입, Module.providers + exports).
- **`.env`에 이미 Toss docs 테스트 키 존재:** `NEXT_PUBLIC_TOSS_CLIENT_KEY=test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm`, `TOSS_SECRET_KEY=test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6` (quick task 260406-n1z 결과). Plan 3는 이 키를 TOSS_CLIENT_KEY_TEST/TOSS_SECRET_KEY_TEST로 **별칭 추가** (D-13 준수)하고 GitHub secrets에 등록.

## Standard Stack

### Core (Phase 9 신규 추가 패키지)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `resend` | 6.11.0 [VERIFIED: npm view resend version] | Resend SDK (Node.js) | 1st-party SDK, `emails.send({ react: <Template/> })` 직접 TSX 전달 지원 |
| `@react-email/components` | 1.0.12 [VERIFIED: npm view] | React Email 빌딩 블록 | Resend와 같은 팀이 제작. Button/Heading/Section 등 email-safe 컴포넌트 |
| `react-markdown` | 10.1.0 [VERIFIED: npm view] | MD → JSX 런타임 렌더 | Dialog 내부 약관 본문 렌더. `components` prop으로 Tailwind 클래스 매핑 |
| `remark-gfm` | 4.0.1 [VERIFIED: npm view] | GitHub Flavored Markdown plugin | 테이블/체크박스/url 자동 링크 지원. 약관에서는 optional이나 안전 |

### Existing (재사용)

| Library | Version | Purpose | Used In |
|---------|---------|---------|---------|
| `@tosspayments/tosspayments-sdk` | 2.6.0 [VERIFIED: apps/web/package.json] | Toss 결제 SDK | `toss-payment-widget.tsx:66` (설치 완료) |
| `@playwright/test` | 1.59.1 [VERIFIED: apps/web/package.json] | E2E 테스트 | `apps/web/e2e/social-login.spec.ts` 기 사용 |
| `@nestjs/config` | 4.0.0 [VERIFIED: apps/api/package.json] | 환경변수 + DI | EmailService ConfigService 주입 |
| `@nestjs/common` | 11.1.0 [VERIFIED] | `@Injectable`, `Logger`, `Module` | EmailService 제공자 패턴 |
| `vitest` | 3.2.0 [VERIFIED] | 단위 테스트 러너 | EmailService 테스트 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff / Why Rejected |
|------------|-----------|------------------------|
| Resend | SendGrid / AWS SES / Mailgun / nodemailer | D-01 잠금 — 다른 옵션은 Phase 9에서 논외 |
| `react-markdown` | `marked` + `dangerouslySetInnerHTML` | 번들 소폭 감소 가능하나 XSS 리스크 + 타이포 매핑이 복잡. react-markdown `components` prop이 더 안전 |
| `react-markdown` | 수동 정규식 파서 | 번들 0 증가이나 유지보수 비용 + 엣지케이스 취약. 약관 내용 변경 빈도 고려 시 권장 X |
| `nest-resend` / `nestjs-resend` | 커스텀 EmailService (SMS 패턴 복제) | 3rd-party wrapper는 버전 종속 및 학습 비용. 본 프로젝트는 `SmsService` 패턴이 이미 있어 복제가 더 일관성 높음 |
| Tailwind `@tailwindcss/typography` (prose) | 수동 타이포 매핑 | prose 플러그인이 Tailwind CSS v4에서 일부 이슈 보고됨. UI-SPEC 71 라인이 수동 매핑을 명문화했으므로 그대로 따름 |
| `@react-email/render` 별도 import | Resend `react` 파라미터에 직접 전달 | render() 호출은 Resend 외 SMTP 사용 시에만 필요. Resend 사용 시 중복 |

**Installation:**
```bash
# API (apps/api)
pnpm --filter @grapit/api add resend @react-email/components

# Web (apps/web)
pnpm --filter @grapit/web add react-markdown remark-gfm

# Remove unused legacy
pnpm --filter @grapit/api remove nodemailer @types/nodemailer
```

**Version verification (2026-04-14 `npm view` 확인):**
- `resend@6.11.0` — Node >=20 엔진, ESM + CJS 모두 export
- `@react-email/components@1.0.12` — React 18/19 peer, 최신 RC 호환 (2026-04-09 modified)
- `@react-email/render@2.0.6` — React 18/19 peer (**Phase 9에서는 불필요, Resend 내장 사용**)
- `react-markdown@10.1.0` — React 19 호환
- `remark-gfm@4.0.1` — react-markdown v10 호환

## Architecture Patterns

### Recommended Project Structure (Phase 9 추가 파일만)

```
apps/api/src/modules/auth/
├── email/
│   ├── email.service.ts          # DEBT-01: NestJS provider (ConfigService 주입)
│   ├── email.service.spec.ts     # Unit test: mock/prod 분기
│   ├── email.module.ts           # Provides + exports EmailService
│   └── templates/
│       └── password-reset.tsx    # React Email TSX 템플릿
├── auth.service.ts               # L217-241 requestPasswordReset을 email.service 호출로 교체
└── auth.module.ts                # EmailModule import 추가

apps/web/content/legal/           # DEBT-02 신규
├── terms-of-service.md
├── privacy-policy.md
└── marketing-consent.md

apps/web/components/legal/        # DEBT-02 신규 (또는 components/auth/ 하위로 조정 가능)
├── legal-draft-banner.tsx        # UI-SPEC 115-125의 warning 배너
└── terms-markdown.tsx            # react-markdown + components prop 타이포 매핑

apps/web/lib/                     # DEBT-04 공통 유틸 (Discretion 확장)
└── format-datetime.ts            # 4개 파일 중복 정의 통합

apps/web/e2e/                     # DEBT-05 신규
└── toss-payment.spec.ts          # Playwright spec

apps/web/env.d.ts                 # DEBT-02 신규 (?raw 타입 선언)
```

### Pattern 1: EmailService (SMS 패턴 복제)

**Source:** `apps/api/src/modules/sms/sms.service.ts:1-132` 구조 그대로 복제 [VERIFIED: read 완료]

```typescript
// apps/api/src/modules/auth/email/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PasswordResetEmail } from './templates/password-reset.js';

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly isDevMode: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.from = this.configService.get<string>('RESEND_FROM_EMAIL', 'onboarding@resend.dev');
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    // Phase 7 REDIS_URL hard-fail 원칙 적용 (context_code.md L136)
    if (nodeEnv === 'production' && !apiKey) {
      throw new Error(
        '[email] RESEND_API_KEY is required in production environment. ' +
          'Silent console.log fallback is disabled to prevent missed password reset emails. ' +
          'Check Cloud Run secret binding.',
      );
    }

    this.isDevMode = !apiKey;
    if (this.isDevMode) {
      this.resend = null;
      this.logger.warn('Email Service running in DEV MOCK mode (no RESEND_API_KEY)');
    } else {
      this.resend = new Resend(apiKey!);
    }
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<SendEmailResult> {
    if (this.isDevMode) {
      this.logger.log(`DEV EMAIL: password reset link for ${to}: ${resetLink}`);
      return { success: true };
    }
    // Resend SDK returns { data, error } — does NOT throw
    const { data, error } = await this.resend!.emails.send({
      from: this.from,
      to,
      subject: '[Grapit] 비밀번호 재설정',
      react: PasswordResetEmail({ resetLink }),
    });
    if (error) {
      this.logger.error(`Resend send failed for ${to}: ${error.message}`);
      return { success: false, error: error.message };
    }
    return { success: true, id: data?.id };
  }
}
```
Source [VERIFIED: Resend SDK docs via WebFetch 2026-04-14, resend.com/docs/send-with-nextjs]

### Pattern 2: React Email Template

```tsx
// apps/api/src/modules/auth/email/templates/password-reset.tsx
import { Html, Head, Body, Container, Heading, Text, Button, Hr, Section } from '@react-email/components';

interface PasswordResetEmailProps {
  resetLink: string;
}

export function PasswordResetEmail({ resetLink }: PasswordResetEmailProps) {
  return (
    <Html lang="ko">
      <Head />
      <Body style={{ backgroundColor: '#f5f5f7', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', padding: '32px', maxWidth: '560px' }}>
          <Heading style={{ fontSize: '20px', color: '#1A1A2E' }}>비밀번호 재설정 안내</Heading>
          <Text style={{ fontSize: '14px', color: '#4A4A5E' }}>
            아래 버튼을 눌러 비밀번호를 재설정해주세요. 이 링크는 1시간 동안만 유효합니다.
          </Text>
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={resetLink} style={{ backgroundColor: '#6C3CE0', color: '#ffffff', padding: '12px 24px', borderRadius: '6px' }}>
              비밀번호 재설정
            </Button>
          </Section>
          <Hr />
          <Text style={{ fontSize: '12px', color: '#6B6B7B' }}>
            본 메일을 요청하지 않으셨다면 무시하셔도 됩니다.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

**Why:** Resend SDK의 `react` 파라미터는 `React.ReactNode`를 받아 내부에서 자동으로 HTML 변환 (별도 `render()` 불필요). 테스트 도메인 `onboarding@resend.dev`는 도메인 검증 전에도 사용 가능.

### Pattern 3: Turbopack `?raw` Markdown Import

**Next.js 16.2 Turbopack은 `?raw` 네이티브 지원하지 않음** — `raw-loader` 설정 필요 [CITED: https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack 2026-04-10 version 16.2.3]. 하지만 더 간단한 방법은 **module type `raw`** 직접 지정:

**Option A (권장):** `next.config.ts`에서 MD 파일을 `raw` 타입으로 선언:
```typescript
// next.config.ts
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      '*.md': {
        as: '*.js',
        loaders: ['raw-loader'],
      },
    },
  },
};
```
+ `pnpm add -D raw-loader` + `declare module '*.md'` 타입 선언 (`apps/web/env.d.ts`)

**Option B:** Turbopack module type `raw` 직접 사용 (Next.js 16에서 지원, 위 Turbopack 문서 "Module types" 섹션):
```typescript
// next.config.ts
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      '*.md': { type: 'raw' },
    },
  },
};
```
+ `declare module '*.md' { const content: string; export default content; }` 필요
+ **장점:** raw-loader 불필요 (번들 감소)

**Option C (fallback if loader/type 방식 실패):** 런타임 `fetch('/legal/terms.md')` — `public/legal/*.md` 배치 후 클라이언트 fetch. Dialog 오픈 시에만 로드.

**권장:** Option B 시도 → Option A fallback → Option C는 최후.

### Pattern 4: MD → JSX with Tailwind mapping

```tsx
// apps/web/components/legal/terms-markdown.tsx
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components: Components = {
  h1: () => null, // DialogTitle이 이미 제목 (UI-SPEC 77)
  h2: (props) => <h2 className="text-base font-semibold text-gray-900 mt-6 first:mt-0" {...props} />,
  h3: (props) => <h3 className="text-caption font-semibold text-gray-800 mt-4" {...props} />,
  p: (props) => <p className="text-caption leading-relaxed text-gray-700 mt-2" {...props} />,
  ul: (props) => <ul className="text-caption leading-relaxed text-gray-700 mt-2 ml-5 list-disc" {...props} />,
  ol: (props) => <ol className="text-caption leading-relaxed text-gray-700 mt-2 ml-5 list-decimal" {...props} />,
  li: (props) => <li className="mt-1" {...props} />,
  strong: (props) => <strong className="font-semibold text-gray-900" {...props} />,
  a: (props) => <a className="text-primary underline hover:text-primary/80" target="_blank" rel="noopener noreferrer" {...props} />,
  hr: () => <hr className="my-4 border-gray-200" />,
};

export function TermsMarkdown({ children }: { children: string }) {
  return <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>;
}
```

### Pattern 5: Legal Draft Banner

```tsx
// apps/web/components/legal/legal-draft-banner.tsx (UI-SPEC 115-125 준수)
import { AlertTriangle } from 'lucide-react';

export function LegalDraftBanner() {
  return (
    <div
      role="note"
      aria-label="초안 안내"
      className="mb-6 flex items-start gap-2 rounded-md border border-warning/30 border-l-4 border-l-warning bg-warning-surface px-4 py-3"
    >
      <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" aria-hidden="true" />
      <span className="text-caption text-[#8B6306]">
        본 약관은 런칭 전 법률 검토를 거쳐 교체될 초안입니다.
      </span>
    </div>
  );
}
```

### Pattern 6: Playwright Toss E2E (popup window handling)

**social-login.spec.ts 패턴 차용 + Toss 특화:**

```typescript
// apps/web/e2e/toss-payment.spec.ts
import { test, expect } from '@playwright/test';

// Gate: skip if TOSS_CLIENT_KEY_TEST env var missing (D-12 준수)
test.describe('Toss Payments E2E', () => {
  test.skip(
    !process.env['TOSS_CLIENT_KEY_TEST'],
    'Skipped: TOSS_CLIENT_KEY_TEST not set (local-only or secrets unset in CI)',
  );

  test('happy path: card payment completes and redirects to /complete', async ({ page, context }) => {
    // 1. Prerequisite: logged in user + pending reservation (setup via seed or API)
    // ... login/seed steps ...

    // 2. Navigate to confirm page
    await page.goto('/booking/performance-id/confirm');

    // 3. Wait for Toss widget to mount
    await expect(page.locator('#payment-method iframe')).toBeVisible({ timeout: 15000 });

    // 4. Agree to terms + click pay
    await page.getByRole('checkbox', { name: /약관/ }).check();

    // 5. The Toss widget opens payment flow — can be popup OR iframe navigation
    //    For sandbox SDK, the simulator generally navigates within the page.
    //    If popup: const popupPromise = page.waitForEvent('popup');
    //    For this test we assume same-tab redirect to successUrl.
    await page.getByRole('button', { name: /결제하기/ }).click();

    // 6. In sandbox, fill test card info (if card method selected)
    //    Toss sandbox widget auto-fills for test keys — verify UI path

    // 7. Assert redirect to /complete
    await page.waitForURL(/\/booking\/.+\/complete/, { timeout: 30000 });
    await expect(page.getByText('예매가 완료되었습니다')).toBeVisible();
  });

  test('payment window cancellation: user cancels, returned to confirm with error toast', async ({ page }) => {
    // ... setup to confirm page ...

    // Simulate cancel by navigating directly with error URL (Toss 실제 취소 시 이와 같이 리턴)
    // This mirrors the behavior in confirm/page.tsx:72 `code === 'PAY_PROCESS_CANCELED'`
    await page.goto('/booking/performance-id/confirm?error=true&code=PAY_PROCESS_CANCELED');
    await expect(page.getByText('결제가 취소되었습니다.')).toBeVisible();
  });

  test('declined card: error message surfaced', async ({ page }) => {
    await page.goto('/booking/performance-id/confirm?error=true&code=INVALID_CARD&message=카드%20승인%20거절');
    await expect(page.getByText(/카드 승인 거절|결제에 실패/)).toBeVisible();
  });
});
```

**Note on happy path 난이도:** Toss sandbox iframe 내부의 카드 입력 필드는 cross-origin이므로 Playwright `frameLocator`로 접근해야 한다. **실 SDK 흐름을 끝까지 자동화하기는 고난이도** — D-14가 허용한 `page.route()` 인터셉션 하이브리드가 실용적:

```typescript
// Hybrid approach: load real SDK (prove it loads), but intercept the final confirm callback
await page.route('**/api/v1/payments/confirm', async (route) => {
  await route.fulfill({ status: 200, body: JSON.stringify({ /* mock reservation */ }) });
});
```

### Anti-Patterns to Avoid

- **react-email render() in Resend pipeline**: Resend는 `react` 파라미터에 TSX 전달 시 내부에서 자동 HTML 변환. `await render(<Template/>)` + `html:` 패턴은 불필요한 이중 변환. [CITED: resend.com/docs/send-with-nextjs 확인]
- **NODE_ENV=production에서 RESEND_API_KEY 없으면 silent log**: Phase 7 `REDIS_URL` hard-fail 원칙 적용. throw해야 함.
- **Toss 테스트 키를 프로덕션 키와 같은 이름으로 관리**: D-13이 분리 요구. 별칭 `TOSS_CLIENT_KEY_TEST`를 만들어 CI에서는 이 값만 주입.
- **MD 파일을 Dialog에서 client-side fetch만으로 로드**: 오프라인/404 엣지케이스 + 초기 flash. 빌드 타임 `?raw` 또는 `type: 'raw'` import가 안정적.
- **formatDateTime 유틸 통합 중 콜사이트 세미콜론 깜빡**: booking-complete.tsx의 `formatDateTime` 시그니처는 다르게 구현됨 (Intl.DateTimeFormat 사용). 통합 시 4개 파일 포맷 출력이 **다름** 인지하고 진행 — 리스크는 §5 참고.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| React → HTML 이메일 변환 | 자체 JSX 렌더러 | Resend SDK `react` param (내부에서 @react-email/render 호출) | Resend가 이메일 client별 HTML 호환성 보장 |
| Markdown → JSX 변환 | 정규식 파서 | `react-markdown` + `remark-gfm` | 중첩 리스트, inline code, 이스케이프 엣지케이스 |
| Email 인증 sender domain 관리 | 자체 DNS record 주입 | Resend dashboard에서 도메인 검증 (DKIM/SPF 자동) | 프로덕션 신뢰도 확보 |
| Toss 결제 popup 처리 | Manual window.open event listener | Playwright `page.waitForEvent('popup')` | context 간 race condition 자동 처리 |
| Null date 포매팅 | 각 콜사이트마다 삼항 | 단일 `formatDateTime(string \| null \| undefined)` 유틸 | D-20 locked. DRY + 타입 안전성 |
| Password reset secret 생성 | JWT payload에 임의 secret 추가 | 기존 `auth.service.ts:226-232`의 `jwtSecret + passwordHash` 체인 재사용 | 이미 구현된 보안 메커니즘 |

**Key insight:** Plan 2의 인프라 추가(Resend, React Email, react-markdown)는 모두 해당 도메인의 업계 표준 선택. 1인 개발자가 직접 롤할 가치 없음.

## Runtime State Inventory

> Phase 9는 순수 코드/설정 변경이므로 Runtime state 영향 최소. 단, DEBT-01과 DEBT-05는 외부 서비스 키를 다룬다.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — Phase 9는 DB 스키마/마이그레이션 변경 없음. `terms_agreements` 테이블 기존 사용자 레코드는 Plan 2의 MD 문안 교체 후에도 유효 (version 필드 없어서 영향 無) | 없음 |
| Live service config | **Resend (신규):** 대시보드에서 도메인 `grapit.com` 검증 필요 (프로덕션 발송용). dev는 `onboarding@resend.dev` 사용. Plan 2 실행 전 1인 개발자가 Resend 계정 생성 + API 키 발급 | 수동 설정 — planner가 "Resend 계정 준비" 사전 조건 명시 |
| Live service config | **Toss sandbox:** 이미 공개 테스트 키(`test_gck_docs_...`) 사용 중. Plan 3에서는 CI 격리를 위해 동일 키를 `TOSS_CLIENT_KEY_TEST`로 **복제** (신규 키 발급 불필요). 현 `TOSS_SECRET_KEY`는 유지 | CI secrets 등록 (GitHub Actions) |
| OS-registered state | **None** — Cloud Run은 stateless. SOPS/Secret Manager에도 영향 없음 | 없음 |
| Secrets/env vars | **신규 필수:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`. 루트 `.env`, `.env.example`, `deploy.yml` secrets 섹션에 추가 | Plan 2의 환경변수 태스크 |
| Secrets/env vars | **신규 CI-only:** `TOSS_CLIENT_KEY_TEST`, `TOSS_SECRET_KEY_TEST`. GitHub Actions secrets + 로컬 `.env`에만 존재 (Cloud Run에는 불필요) | Plan 3의 CI 설정 태스크 |
| Build artifacts | **nodemailer 패키지 잔존:** `apps/api/package.json`에 `nodemailer@^8.0.4` + `@types/nodemailer` 설치됨 but 사용처 없음. Plan 2에서 제거 권장 | `pnpm --filter @grapit/api remove nodemailer @types/nodemailer` |

## Common Pitfalls

### Pitfall 1: Next.js Turbopack `?raw` import 미지원
**What goes wrong:** `import terms from '@/content/legal/terms.md?raw'`가 Next.js 16.2 Turbopack에서 바로 동작 안 함. `?raw`는 Vite-specific query parameter.
**Why it happens:** Turbopack은 import attribute (`with { turbopackLoader: 'raw-loader' }`) 또는 `turbopack.rules` config 기반.
**How to avoid:** §2.2 Pattern 3의 Option B (`type: 'raw'`) 사용 — raw-loader 불필요, config 한 줄.
**Warning signs:** dev 서버에서 "Module not found" 또는 문자열 대신 JS AST 파싱 에러.

### Pitfall 2: Resend SDK는 throw하지 않고 `{ data, error }` 반환
**What goes wrong:** `try { await resend.emails.send(...) } catch (e) {...}` — error block에 도달하지 않아 실패 로그 누락.
**Why it happens:** Resend 디자인 철학 (Go-style error return).
**How to avoid:** `const { data, error } = await resend.emails.send(...); if (error) {...}` 패턴 강제. §2.1 Pattern 1 참조.
**Warning signs:** 실패해도 EmailService가 success 반환하는 거짓 양성.

### Pitfall 3: Toss sandbox iframe cross-origin 접근 불가
**What goes wrong:** Playwright가 Toss 결제창(`https://sandbox.tosspayments.com/...`) 내부 카드 입력 필드에 접근 시 cross-origin 차단.
**Why it happens:** Toss 결제창은 PCI 규정으로 독립 오리진.
**How to avoid:** D-14 허용 범위 내에서 `page.route('**/api/v1/payments/confirm', ...)` 로 서버 측 confirm API만 인터셉트하고, 실 SDK 로딩/위젯 마운트/successUrl 네비게이션까지는 실 sandbox 사용.
**Warning signs:** `frameLocator('iframe[src*="toss"]').getByLabel('카드번호')` 같은 locator가 timeout.

### Pitfall 4: DEBT-03 "회귀"가 실제로 존재하지 않음 — misdiagnosis 리스크
**What goes wrong:** planner가 CONTEXT.md D-17 기대 동작을 현실과 다르게 해석 → production 코드 수정 → 실제로 동작 중이던 코드 파손.
**Why it happens:** 리서치에서 **실제 테스트 실행 확인** (§3): 7/7 PASS. `seat-map-viewer.tsx:161`은 이미 locked 허용 + sold 차단으로 정확히 D-17/D-18을 구현.
**How to avoid:** Plan 1은 "DEBT-03 fix"가 아니라 "DEBT-03 **confirm green** + UI-SPEC toast 일원화"로 재정의. `sonner.tsx:15-18`의 `classNames`에 `info: 'bg-info-surface text-info border-info/20'` 추가 + `booking-page.tsx:193-196, 251-253`의 인라인 `style={{backgroundColor: ..., color: ...}}` 제거.
**Warning signs:** 테스트 PASS인데 production 코드를 "회귀 수정"하려 하는 태스크 발견.

### Pitfall 5: formatDateTime 4개 파일 시그니처 불일치
**What goes wrong:** `apps/web/components/booking/booking-complete.tsx:14`는 `Intl.DateTimeFormat` 기반이고, 다른 3개는 `padStart` 기반. 출력이 다름 ("2026년 4월 14일 (월) 14:23" vs "2026.04.14 14:23").
**Why it happens:** 각 컴포넌트가 독립적으로 정의.
**How to avoid:** D-20 최소 범위 준수 (admin-booking-detail-modal만) **또는** 공통 유틸화 시 각 콜사이트가 요구하는 출력 포맷을 두 함수로 분리 (`formatDateTime` / `formatDateTimeLong`). UI-SPEC 323-330의 Discretion 범위 내.
**Warning signs:** 예매 완료 페이지 날짜 표시가 갑자기 "2026.04.14 14:23"로 바뀌어 디자인 회귀.

### Pitfall 6: Plan 2에서 nodemailer 잔존이 혼동 유발
**What goes wrong:** `apps/api/package.json`에 `nodemailer@^8.0.4` 기존 설치됨. Plan 2 executor가 Resend 대신 nodemailer를 사용하거나, Resend에 덧붙여 이중 구성.
**Why it happens:** 과거 stub 설치 흔적 (`auth.service.ts:238` 주석 "in production, use nodemailer/SES").
**How to avoid:** Plan 2 Task 0에서 `pnpm --filter @grapit/api remove nodemailer @types/nodemailer` 명시.

### Pitfall 7: EmailService를 새 모듈이 아닌 auth.module.ts에 직접 provider로 추가
**What goes wrong:** `auth.module.ts:32`의 providers 배열에 EmailService를 바로 추가하면 Sms/User처럼 별도 모듈 없이 동작은 하나, 향후 Phase 10의 SMS-OTP rate limiting이나 타 모듈에서 이메일 필요 시 순환 의존 위험.
**Why it happens:** NestJS에서 Module per service 관례 (SmsModule, UserModule 이미 분리됨).
**How to avoid:** `apps/api/src/modules/auth/email/email.module.ts` 신설 → exports: [EmailService]. `auth.module.ts`에서 imports에 추가. SMS 모듈과 동일 구조.

## Code Examples

Verified patterns from official sources:

### Example 1: Resend + React Email (Resend 공식 가이드)
```typescript
// Source: https://resend.com/docs/send-with-nextjs [VERIFIED WebFetch 2026-04-14]
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

const { data, error } = await resend.emails.send({
  from: 'Acme <onboarding@resend.dev>',
  to: ['user@example.com'],
  subject: 'hello world',
  react: EmailTemplate({ firstName: 'John' }),  // TSX 컴포넌트 직접 전달
});
```

### Example 2: SmsService 복제 (기존 코드)
```typescript
// Source: apps/api/src/modules/sms/sms.service.ts:22-37 [VERIFIED read]
constructor(private readonly configService: ConfigService) {
  const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
  // ...
  this.isDevMode = !accountSid || (nodeEnv === 'development' && !accountSid);
  if (this.isDevMode) {
    this.twilioClient = null;
    this.logger.warn('SMS Service running in DEV MOCK mode');
  } else {
    this.twilioClient = Twilio(accountSid!, authToken!);
  }
}
```

### Example 3: REDIS_URL hard-fail 패턴 (Phase 7 확립)
```typescript
// Source: apps/api/src/modules/booking/providers/redis.provider.ts:220-236 [VERIFIED read]
if (!url) {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error(
      '[redis] REDIS_URL is required in production environment. ' +
        'Silent InMemoryRedis fallback is disabled...'
    );
  }
  console.warn('[redis] No REDIS_URL — using in-memory mock...');
  return new InMemoryRedis() as unknown as IORedis;
}
```
EmailService는 완전히 동일한 패턴으로 작성.

### Example 4: Playwright env-gated skip (social-login 패턴)
```typescript
// Source: apps/web/e2e/social-login.spec.ts 구조 [VERIFIED read] + D-12 요구
test.describe('Toss Payments E2E', () => {
  test.skip(!process.env['TOSS_CLIENT_KEY_TEST'], 'Requires sandbox keys');
  // ...
});
```

### Example 5: react-markdown with components prop
```tsx
// Source: https://github.com/remarkjs/react-markdown (WebSearch 2026-04-14)
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

<ReactMarkdown
  components={{
    h2: ({node, ...props}) => <h2 className="text-base font-semibold" {...props} />,
    // ...
  }}
  remarkPlugins={[remarkGfm]}
>
  {markdownString}
</ReactMarkdown>
```

## Current State Probe Results

### DEBT-03 — 실제 테스트 실행 결과 (D-19 mandated)

```
$ pnpm --filter @grapit/web test seat-map-viewer

 RUN  v3.2.4 /Users/sangwopark19/icons/grapit/apps/web
 ✓ components/booking/__tests__/seat-map-viewer.test.tsx (7 tests) 46ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  11:07:44
   Duration  761ms
```

**Verdict:** **회귀 없음.** 전 7 테스트 PASS. Locked seat click 테스트(L135-159) PASS, sold seat click 테스트(L161-185) PASS. [VERIFIED: 실제 실행 2026-04-14 11:07]

**Production 코드 검증:**
- `seat-map-viewer.tsx:161` → `if (state === 'sold') return;` (sold만 차단)
- `seat-map-viewer.tsx:162` → `onSeatClick(seatId);` (locked 포함 호출)
- `booking-page.tsx:190-197` → `if (seatState === 'locked' && !selectedSeatIds.has(seatId)) { toast.info('이미 다른 사용자가 선택한 좌석입니다', ...); return; }` (parent toast 확인)

**결론:** DEBT-03는 **회귀 수정이 아니라 UI-SPEC 권고 수용**. Plan 1은 (a) `sonner.tsx`에 `classNames.info` 추가, (b) booking-page.tsx의 인라인 `style` → 클래스 기반으로 교체. 이 변경이 기존 7/7 테스트를 계속 통과해야 함.

### DEBT-04 — typecheck 실행 결과

```
$ pnpm --filter @grapit/web typecheck
(no output — all passes)
```

**Verdict:** **현 시점 타입 에러 0건.** [VERIFIED: 실제 실행 2026-04-14]

`admin-booking-detail-modal.tsx:150`의 삼항 `booking.paymentInfo.paidAt ? formatDateTime(booking.paymentInfo.paidAt) : '—'` 가 narrowing으로 안전. `reservation-detail.tsx:200-206`도 `reservation.cancelledAt && (...)` 가드.

**결론:** DEBT-04는 **proactive type safety + code smell 제거**. `formatDateTime` 공통 유틸 추출로 4개 파일 중복 정의 제거가 진정한 목적 (UI-SPEC 323-330 Discretion 확장 범위).

### DEBT-06 — useShowtimes 호출 지점 grep

```
$ grep -n 'useShowtimes\|showtimesData' apps/web/components/booking/booking-page.tsx

10:  useShowtimes,
44:  const { data: showtimesData } = useShowtimes(performanceId);
70:    () => showtimesData ?? performance?.showtimes ?? [],
71:    [showtimesData, performance?.showtimes],
```

훅 정의: `apps/web/hooks/use-booking.ts:26-35` [VERIFIED]

`performance.controller.ts` 엔드포인트 목록:
- `GET /performances` (L18)
- `GET /performances/:id` (L26)
- `GET /home/banners` (L35)
- `GET /home/hot` (L40)
- `GET /home/new` (L45)

**`/performances/:id/showtimes` 엔드포인트 없음 확인** [VERIFIED]. `enabled: false`이므로 런타임 404 발생하지 않음. 삭제 안전.

### DEBT-01 — requestPasswordReset 현 상태

`auth.service.ts:234-240` 인용:
```typescript
const frontendUrl = this.configService.get<string>('FRONTEND_URL');
const resetLink = `${frontendUrl}/auth/reset-password?token=${resetToken}`;

// TODO: Wire up nodemailer transport in production
// For now, log the link (will be replaced with actual email service)
console.log(`[Password Reset] Link for ${email}: ${resetLink}`);
```

Plan 2의 교체 목표: `console.log` 줄을 `await this.emailService.sendPasswordResetEmail(email, resetLink);` 로 치환 + `AuthService.constructor`에 `EmailService` 주입 + `auth.module.ts` imports에 EmailModule 추가.

### DEBT-02 — signup-step2.tsx 현 상태

`apps/web/components/auth/signup-step2.tsx:22-38` TERMS_CONTENT 인라인 placeholder 확인 [VERIFIED read]. Dialog는 L183-195에 이미 shadcn Dialog 기반으로 구현, 본문 L191-193의 `<div>{TERMS_CONTENT[dialogKey]?.content}</div>`를 `<LegalDraftBanner /> + <TermsMarkdown>{markdown}</TermsMarkdown>`로 교체.

### DEBT-05 — Toss 환경변수 현 상태

**기존 `.env` (quick task 260406-n1z 결과):**
- `NEXT_PUBLIC_TOSS_CLIENT_KEY=test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm`
- `TOSS_SECRET_KEY=test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6`

이는 Toss **공식 공개 docs 테스트 키** [VERIFIED via `.planning/quick/260406-n1z-toss-payments-test-key/260406-n1z-SUMMARY.md`]. Plan 3에서 **동일 키를 `TOSS_CLIENT_KEY_TEST`/`TOSS_SECRET_KEY_TEST` 별칭으로 복제** (D-13 준수) + GitHub Actions secrets 등록.

**왜 새 키 발급 불필요:** 공식 docs 테스트 키는 공개되어 있어 secret 가치가 없음. 하지만 D-13의 "프로덕션 키와 완전 격리" 원칙을 위해 코드/CI에서는 `_TEST` 접미사로 의미론적 구분.

### 기존 dependencies 상태

**apps/api:**
- `resend` — **미설치** (Plan 2에서 추가)
- `@react-email/components` — **미설치** (Plan 2에서 추가)
- `nodemailer@^8.0.4` — **설치됨 but 미사용** (Plan 2에서 제거)
- `@nestjs/config@^4.0.0` — 설치됨 (재사용)
- `@nestjs/common@^11.1.0` — 설치됨 (재사용)

**apps/web:**
- `react-markdown` — **미설치** (Plan 2에서 추가)
- `remark-gfm` — **미설치** (Plan 2에서 추가)
- `@tosspayments/tosspayments-sdk@^2.6.0` — 설치됨 (재사용)
- `@playwright/test@^1.59.1` — 설치됨 (재사용)
- `sonner@^2.0.7` — 설치됨 (재사용, classNames.info 추가만 필요)

### CI 현 상태

`.github/workflows/ci.yml` — `pnpm lint`, `pnpm typecheck`, `pnpm test` 실행 [VERIFIED]. **E2E는 실행 안 함.** Plan 3에서 `pnpm --filter @grapit/web test:e2e` 추가 step 필요.

`.github/workflows/deploy.yml` — secrets 섹션(L90-105)에 `DATABASE_URL`, `JWT_SECRET`, OAuth 키, Redis, R2 존재. Plan 2에서 `RESEND_API_KEY=resend-api-key:latest`, `RESEND_FROM_EMAIL=resend-from-email:latest` 추가.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 3.2.0 (unit/integration) + Playwright 1.59.1 (E2E) |
| Config files | `apps/api/vitest.config.ts` (API), `apps/web/vitest.config.ts` (Web), `apps/web/playwright.config.ts` (E2E) |
| Quick run — unit | `pnpm --filter @grapit/{web,api} test <pattern>` |
| Quick run — E2E | `pnpm --filter @grapit/web test:e2e` |
| Full suite | `pnpm test` (루트) — turbo가 두 워크스페이스 모두 실행 |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEBT-01 | EmailService dev mode → console.log만 호출, Resend 미호출 | unit | `pnpm --filter @grapit/api test email.service` | ❌ Wave 0 (신규) |
| DEBT-01 | EmailService prod mode → Resend 호출 + `{data, error}` 핸들 | unit (mock resend 모듈) | 동일 | ❌ Wave 0 |
| DEBT-01 | NODE_ENV=production + RESEND_API_KEY 미설정 → throw | unit | 동일 | ❌ Wave 0 |
| DEBT-01 | `AuthService.requestPasswordReset`이 EmailService 호출 | integration (mock EmailService) | `pnpm --filter @grapit/api test auth.service` | (auth.service.spec.ts 있음 — 확장) |
| DEBT-02 | Dialog 오픈 시 LegalDraftBanner + MD 본문 렌더 | unit (@testing-library/react) | `pnpm --filter @grapit/web test signup-step2` | ❌ Wave 0 (신규) |
| DEBT-02 | 법률 검토 배너 `role="note"` + 문구 표시 | unit | 동일 | ❌ Wave 0 |
| DEBT-02 | 법률 문안 정확성 (오탈자, 법적 완결성) | manual | 1인 개발자 proofreading | N/A — judgment |
| DEBT-03 | Locked 좌석 클릭 시 `onSeatClick` 호출 (no block) | unit | `pnpm --filter @grapit/web test seat-map-viewer` | ✅ 기존 통과 |
| DEBT-03 | Sold 좌석 클릭 시 `onSeatClick` 미호출 | unit | 동일 | ✅ 기존 통과 |
| DEBT-03 | Locked 좌석 클릭 시 parent toast 렌더 | unit (mock toast) | `pnpm --filter @grapit/web test booking-page` | ❌ Wave 0 (optional) |
| DEBT-04 | `formatDateTime(null)` === "—" | unit | `pnpm --filter @grapit/web test format-datetime` | ❌ Wave 0 (신규) |
| DEBT-04 | `formatDateTime(undefined)` === "—" | unit | 동일 | ❌ Wave 0 |
| DEBT-04 | `formatDateTime('2026-04-14T14:23:00Z')` ≠ "—" | unit | 동일 | ❌ Wave 0 |
| DEBT-04 | `tsc --noEmit` 0 errors (프로젝트 전체) | typecheck | `pnpm typecheck` | ✅ 루트에서 실행 |
| DEBT-05 | Toss 결제 happy path (TOSS_CLIENT_KEY_TEST 있을 때) | E2E | `pnpm --filter @grapit/web test:e2e toss-payment` | ❌ Wave 0 (신규) |
| DEBT-05 | PAY_PROCESS_CANCELED 에러 toast | E2E (URL simulation) | 동일 | ❌ Wave 0 |
| DEBT-05 | 카드 승인 거절 에러 toast | E2E (URL simulation) | 동일 | ❌ Wave 0 |
| DEBT-05 | env 미설정 시 test.skip | E2E (exit 0 with skip log) | 동일 | ❌ Wave 0 |
| DEBT-06 | `import { useShowtimes }` 콜사이트 없음 | grep / static | `grep -r useShowtimes apps/` → match 0 | ✅ grep one-liner |
| DEBT-06 | `booking-page.tsx` 빌드 + 렌더 정상 | integration | `pnpm --filter @grapit/web test booking-page` OR Playwright | (smoke가 부족하면 수동) |
| DEBT-06 | `tsc --noEmit` 0 errors | typecheck | `pnpm typecheck` | ✅ |

### Sampling Rate

- **Per task commit:** `pnpm --filter @grapit/<app> test <narrow-pattern>` (~2-5초)
- **Per plan merge:** `pnpm typecheck && pnpm lint && pnpm test` (전체 빠른 패스, E2E 제외)
- **Per phase gate:** 위 + `pnpm --filter @grapit/web test:e2e` (TOSS_CLIENT_KEY_TEST 있을 때) → `/gsd-verify-work` 실행

### Wave 0 Gaps

Plan 2 실행 전 아래 파일 신규 작성 필요:
- [ ] `apps/api/src/modules/auth/email/email.service.spec.ts` — EmailService 3-branch 테스트 (dev/prod/prod-misconfig)
- [ ] `apps/web/components/auth/__tests__/signup-step2.test.tsx` — Dialog 배너 + MD 렌더 (optional — E2E로 커버 가능)

Plan 1:
- [ ] `apps/web/lib/format-datetime.test.ts` — null/undefined/valid 3 cases
- [ ] (optional) `apps/web/components/booking/__tests__/booking-page.test.tsx` — parent toast assertion

Plan 3:
- [ ] `apps/web/e2e/toss-payment.spec.ts` — §2.5 Pattern 6 참조
- [ ] CI workflow 변경: `.github/workflows/ci.yml`에 `pnpm --filter @grapit/web test:e2e` step 추가 (env: TOSS_CLIENT_KEY_TEST, TOSS_SECRET_KEY_TEST)

Framework 설치 부족 항목: **없음** — vitest, Playwright 모두 설치됨.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Password reset 토큰은 기존 `auth.service.ts:226-232`의 JWT(secret = jwtSecret + passwordHash) 재사용 — 한번 사용 후 passwordHash 변경으로 invalidate |
| V3 Session Management | yes | `auth.service.ts:292-295` 비밀번호 변경 후 해당 user의 모든 refresh token revoke (기존 구현) |
| V4 Access Control | n/a | Password reset 엔드포인트는 `@Public()` 공개 — 레이트 리밋은 Phase 10 SMS-01 범위 (현 phase 외) |
| V5 Input Validation | yes | 이메일 주소 zod 스키마 (`reset-password.dto.ts` 기존) — Plan 2 재사용 |
| V6 Cryptography | yes | argon2id (기존) — 신규 암호 해시 작업 없음. Resend TLS는 SDK 내장 |
| V7 Error Handling | yes | `requestPasswordReset` silent return when user not found (L220-222) — email enumeration 방지. **유지 필수** |
| V8 Data Protection | yes | 법률 MD 본문은 정적 자산 — PII 없음. 약관 동의 이력(`terms_agreements`)은 기존 스키마 유지 |
| V14 Configuration | yes | `RESEND_API_KEY`는 Secret Manager로, 로깅 금지. `RESEND_FROM_EMAIL`은 env_vars 가능 (민감도 낮음) |

### Known Threat Patterns for email + E2E

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Email enumeration via password reset | InfoDisclosure | `auth.service.ts:217-223` silent return — 유지 (Plan 2에서 변경 금지) |
| Resend SDK 에러가 stack trace 포함해 응답에 노출 | InfoDisclosure | EmailService 내부에서 error catch → Controller는 generic "메시지 발송됨" 반환 유지 (`auth.controller.ts:124-125` 기존) |
| 테스트 카드 키가 프로덕션 Cloud Run env에 섞임 | Tampering | D-13 강제 — `TOSS_CLIENT_KEY_TEST`는 **Cloud Run에 전혀 주입하지 않음**. `deploy.yml` secrets 섹션에 추가하지 말 것 |
| E2E spec이 시작 시 실 결제 요청 | Tampering / FinancialLoss | `test.skip(!TOSS_CLIENT_KEY_TEST)` 가드 — local/CI 환경에서 키 미설정 시 아예 실행 안 함 |
| Resend 대시보드에서 domain 미검증 상태로 프로덕션 발송 | Availability (SPAM folder) | 1인 개발자 사전 작업 — Plan 2 README에 "Resend dashboard에서 `grapit.com` DKIM/SPF 검증 필요" 명시 |
| React Email 템플릿에 user-supplied content 주입 (XSS via email client) | Tampering | Phase 9는 password reset 링크만 동적 — 이미 안전. 향후 예매 확인 메일 등에서 주의 필요 (Deferred) |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 모든 빌드 | ✓ | 22.x LTS (Jod) | — |
| pnpm | 모든 스크립트 | ✓ | 10.28.1 | — |
| vitest | 단위 테스트 | ✓ | 3.2.0 | — |
| Playwright browsers | E2E (Chromium) | ? (로컬 개발자 자체 설치 필요) | — | `npx playwright install chromium` |
| Resend 계정 + API 키 | Plan 2 프로덕션 발송 | ✗ (1인 개발자 수동 준비 필요) | — | dev 모드 console.log로 개발 진행 가능, 프로덕션 배포만 blocking |
| Resend 도메인 검증 | Plan 2 프로덕션 발송 | ✗ | — | `onboarding@resend.dev`로 초기 발송 가능 (from 주소만 제한) |
| Toss 개발자센터 계정 | Plan 3 (이미 공개 docs 키 사용 중) | ✓ (공개 키는 계정 불필요) | — | — |
| GitHub Actions secrets 접근 | Plan 3 CI 설정 | ✓ (레포 admin이라 가정) | — | 권한 없으면 CI skip만 동작 |

**Missing dependencies with no fallback:** 없음 (모두 우회 가능)

**Missing dependencies with fallback:**
- **Resend API 키**: 개발은 console.log로 가능. 프로덕션 배포 전에 1인 개발자 준비 필수 → planner가 Plan 2 Phase gate에 명시
- **Resend 도메인 검증**: 임시로 `onboarding@resend.dev`에서 발송 가능 (단, 사용자에게는 Grapit 브랜딩 부족)

## Risks & Open Questions

### Risk 1: DEBT-03 재진단 vs 기존 틀 혼동
- **What we know:** 테스트 7/7 PASS (본 리서치 확인). UI-SPEC도 "production 코드 vs 테스트 중 어느 쪽을 고칠지 planner 단계에서 확인(D-19)" 명시.
- **What's unclear:** Plan 1 실행 시 "회귀 수정"을 기대한 executor가 production 코드를 의도 없이 변경할 위험.
- **Recommendation:** Plan 1의 DEBT-03 섹션 제목을 **"DEBT-03: locked seat toast 일원화 + 기존 테스트 green 확인"**으로 명문화. planner는 "production 코드 수정 금지, 테스트 수정 금지" 가드레일 태스크 포함.

### Risk 2: formatDateTime 4-file 통합 시 출력 포맷 불일치
- **What we know:** `booking-complete.tsx:14`는 `Intl.DateTimeFormat('ko-KR', { weekday: 'short', ... })`로 "2026년 4월 14일 (월) 오후 2:23" 스타일. 다른 3개 파일은 "2026.04.14 14:23" 스타일.
- **What's unclear:** D-20/Discretion 범위에서 통합 시 어느 포맷을 표준으로 할지, 또는 두 포맷용 함수를 분리할지.
- **Recommendation:** 최소 범위(UI-SPEC 325 line "권장 최소 범위")로 진행 — admin-booking-detail-modal만 D-20 적용. 통합은 Deferred. 만약 executor가 통합 원하면 **두 함수로 분리**: `formatDateTime` (padStart 스타일, 관리자/예약) + `formatDateTimeLong` (Intl 스타일, 완료 페이지).

### Risk 3: Toss sandbox iframe cross-origin으로 E2E 불완전 자동화
- **What we know:** Toss 결제창은 독립 오리진. 카드 입력 필드는 Playwright frameLocator로 접근 제한.
- **What's unclear:** "happy path"를 어디까지 자동화할지 — (a) 버튼 클릭까지만, (b) 카드 입력까지, (c) 완료 redirect까지.
- **Recommendation:** **D-14 허용 범위 내에서 하이브리드 접근:**
  - 실 SDK 로딩 + 위젯 마운트 + 약관 동의까지는 실제 (sandbox에서 iframe src 확인으로 검증)
  - 결제창 이후 flow는 `page.route('**/payments/confirm', fulfill mock)` 또는 `page.goto(successUrl)`로 직접 이동
  - 이는 "실 SDK 회귀 방지" 가치 + "CI 안정성" 가치를 둘 다 얻음
- **Planner 결정 포인트:** Plan 3에서 이 하이브리드 수준을 Task 단위로 명시.

### Risk 4: Resend 도메인 미검증으로 프로덕션에서 스팸 분류
- **What we know:** 신규 도메인은 DKIM/SPF 검증 전에는 spam 점수 높음.
- **What's unclear:** 1인 개발자가 Resend 대시보드 작업을 plan 실행 전에 할지, 후에 할지.
- **Recommendation:** Plan 2 README 또는 VERIFICATION 단계에 "Resend 대시보드에서 `grapit.com` 도메인 검증 (DNS records 추가)" 체크리스트 항목 포함. Phase 9 완료 전에 수동 확인 필요.

### Risk 5: KOPICO 표준 문안 라이선스/저작권
- **What we know:** KOPICO 표준 개인정보처리방침은 공개 가이드. 하지만 "티켓 예매 표준약관"은 공정위 또는 한국소비자원 자료일 수 있음.
- **What's unclear:** 직접 복제 vs Grapit 각색 범위 — 저작권 침해 리스크.
- **Recommendation:** Plan 2에서 MD 문안 작성 시 **"KOPICO 표준 템플릿 기반 각색"** 주석을 각 MD 파일 상단에 YAML front matter로 추가. "법률 검토 전 초안" 배너(UI-SPEC 115-125)로 리스크 완화됨. 문구 변경 가능 범위는 Claude's Discretion.

### Risk 6: nodemailer 미제거 시 혼동
- **What we know:** `apps/api/package.json`에 `nodemailer@^8.0.4`, `@types/nodemailer@^7.0.11` 잔존. 사용처 없음.
- **What's unclear:** 제거 시 다른 의존성이 transitively 필요로 할지.
- **Recommendation:** Plan 2 Task 0: `pnpm --filter @grapit/api remove nodemailer @types/nodemailer` → `pnpm typecheck && pnpm lint && pnpm test` 확인. 문제 발생 시 rollback.

### Open Question 1: Resend 환경변수 네이밍 통일
- **What's unclear:** `RESEND_API_KEY` vs `RESEND_KEY` vs `EMAIL_RESEND_API_KEY`.
- **Recommendation:** `RESEND_API_KEY` (Resend 공식 샘플 코드 표준) + `RESEND_FROM_EMAIL` (Grapit convention). Discretion 범위.

### Open Question 2: React Email template 위치
- **What's unclear:** `apps/api/src/modules/auth/email/templates/` vs 공유 패키지 `packages/shared/emails/`.
- **Recommendation:** Phase 9는 password reset 1건만이므로 **`apps/api/src/modules/auth/email/templates/password-reset.tsx`** 권장 (모듈 지역화). 향후 예매 확인 메일 추가 시 `packages/shared/emails/`로 프로모션 가능.

### Open Question 3: Markdown loader 방식 (Option A vs B)
- **What's unclear:** `turbopack.rules` + raw-loader vs `type: 'raw'`.
- **Recommendation:** Option B (`type: 'raw'`) 먼저 시도 — 번들 감소 + config 단순. 실패 시 Option A fallback. 지역 POC 실행 후 결정.

### Open Question 4: `useShowtimes` 삭제 시 export 관점
- **What's unclear:** `use-booking.ts:26-35` 제거 후 해당 파일 정리 (trailing whitespace, import 순서).
- **Recommendation:** Plan 1 DEBT-06 task는 단순 삭제 + `pnpm typecheck && pnpm lint` 수행. ESLint가 자동 정리.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Toss 공개 docs 테스트 키는 일정량 throughput까지 rate limit 없이 CI에서 사용 가능 | §2.5 Pattern 6, §3 Toss 환경변수 | [ASSUMED] — CI에서 PR마다 E2E 실행 시 rate limit 위반 가능. planner는 Toss 문서 확인 후 cron/manual trigger fallback 준비 |
| A2 | KOPICO 표준 템플릿을 Grapit 각색 수준에서 사용하는 것이 저작권 법적 안전 | §Risk 5 | [ASSUMED] — 법률 검토 배너(UI-SPEC 115-125)로 완화되나 런칭 전 별도 확인 필요 |
| A3 | `@react-email/components@1.0.12`의 `Button`/`Container` 등은 주요 이메일 클라이언트(Gmail/Naver/Outlook)에서 일관된 렌더 | §2.2 Pattern 2 | [ASSUMED] — Resend 테스트 발송으로 실제 검증 필요. 한국 네이버/다음 이메일은 React Email 공식 테스트 대상 아닐 수 있음 |
| A4 | Next.js 16.2 Turbopack의 `type: 'raw'` module type이 MD 파일에 안정적으로 동작 | §2.2 Pattern 3 Option B | [CITED: nextjs.org/docs 2026-04-10] — 문서상 지원되나 실제 POC 필요 |
| A5 | Playwright sandbox iframe 접근이 Toss v2 SDK에서 원천 차단 | §Risk 3 | [ASSUMED] — 실 SDK 동작 기반 추정. D-14 하이브리드로 우회하는 방식이 일반적이나, 실측 필요 |

## Open Questions

이미 §5에 포함. 모두 Claude's Discretion 범위 내 판단 가능.

## References

### Primary (HIGH confidence — VERIFIED via tool)
- `apps/api/src/modules/auth/auth.service.ts:217-241` — requestPasswordReset stub [read 완료]
- `apps/api/src/modules/auth/auth.controller.ts:119-136` — reset 엔드포인트 [read 완료]
- `apps/api/src/modules/auth/auth.module.ts:1-42` — DI 구조 [read 완료]
- `apps/api/src/modules/sms/sms.service.ts:1-132` — SMS 패턴 [read 완료]
- `apps/api/src/modules/sms/sms.module.ts:1-11` — SmsModule 구조 [read 완료]
- `apps/api/src/modules/sms/sms.service.spec.ts:1-121` — dev/prod 분기 테스트 패턴 [read 완료]
- `apps/api/src/modules/admin/upload.service.ts:1-80` — 환경변수 기반 mock 대안 패턴 [read 완료]
- `apps/api/src/modules/booking/providers/redis.provider.ts:207-236` — production hard-fail 패턴 [read 완료]
- `apps/api/src/modules/performance/performance.controller.ts` — 엔드포인트 5개 목록 (showtimes 없음 확인) [grep 확인]
- `apps/api/src/modules/payment/toss-payments.client.ts:1-96` — confirmPayment/cancelPayment [read 완료]
- `apps/api/src/modules/payment/payment.service.spec.ts:1-65` — 기존 mock 패턴 [read 완료]
- `apps/web/components/auth/signup-step2.tsx:1-199` — TERMS_CONTENT + Dialog 구조 [read 완료]
- `apps/web/components/booking/__tests__/seat-map-viewer.test.tsx:1-234` — 7 테스트 [read 완료]
- `apps/web/components/booking/seat-map-viewer.tsx:1-312` — production 구현 [read 완료]
- `apps/web/components/booking/booking-page.tsx:1-487` — parent toast 로직 [read 완료]
- `apps/web/components/booking/toss-payment-widget.tsx:1-145` — Toss SDK 래퍼 [read 완료]
- `apps/web/components/admin/admin-booking-detail-modal.tsx:1-251` — formatDateTime 정의 + 호출 [read 완료]
- `apps/web/components/admin/admin-booking-table.tsx:37-45` — 동일 signature 중복 정의 [read 완료]
- `apps/web/components/booking/booking-complete.tsx:14-24` — Intl.DateTimeFormat 스타일 [read 완료]
- `apps/web/components/reservation/reservation-detail.tsx:41-61, 128-206` — 동일 signature + 3 callsites [read 완료]
- `apps/web/hooks/use-booking.ts:26-35` — useShowtimes 정의 [read 완료]
- `apps/web/components/ui/sonner.tsx:1-25` — Toaster classNames 구조 [read 완료]
- `apps/web/vitest.config.ts:1-20` — jsdom 환경 [read 완료]
- `apps/web/playwright.config.ts:1-26` — E2E 설정 [read 완료]
- `apps/web/e2e/social-login.spec.ts:1-65` — 기존 E2E 패턴 [read 완료]
- `apps/web/next.config.ts:1-64` — Turbopack root 설정 [read 완료]
- `apps/web/app/booking/[performanceId]/confirm/page.tsx:1-200` — Toss 결제 entry point [read 완료]
- `apps/web/app/globals.css:1-60` — 색/간격 토큰 [read 완료]
- `packages/shared/src/types/booking.types.ts:1-113` — PaymentInfo + ReservationDetail [read 완료]
- `.github/workflows/ci.yml:1-21` — CI 구조 [read 완료]
- `.github/workflows/deploy.yml:1-154` — Cloud Run secrets 패턴 [read 완료]
- `apps/api/package.json` — 현 dependencies [read 완료]
- `apps/web/package.json` — 현 dependencies [read 완료]
- `.planning/quick/260406-n1z-toss-payments-test-key/260406-n1z-PLAN.md:63-64` — Toss docs 공개 테스트 키 [grep 확인]
- `.planning/phases/07-valkey/07-04-PLAN.md:27` — REDIS_URL hard-fail 패턴 원문 [grep 확인]
- **실측:** `pnpm --filter @grapit/web test seat-map-viewer` → 7/7 PASS [2026-04-14 실행]
- **실측:** `pnpm --filter @grapit/web typecheck` → 0 errors [2026-04-14 실행]
- **실측:** `pnpm --filter @grapit/api typecheck` → 0 errors [2026-04-14 실행]
- **실측:** `npm view resend version` → 6.11.0 [2026-04-14]
- **실측:** `npm view @react-email/components version` → 1.0.12 [2026-04-14]
- **실측:** `npm view react-markdown version` → 10.1.0 [2026-04-14]
- **실측:** `npm view remark-gfm version` → 4.0.1 [2026-04-14]

### Secondary (MEDIUM confidence — WebFetch verified with official sources)
- [Resend SDK Next.js guide](https://resend.com/docs/send-with-nextjs) [CITED: WebFetch 2026-04-14]
- [React Email Resend integration](https://react.email/docs/integrations/resend) [CITED: WebFetch 2026-04-14]
- [Next.js 16.2 Turbopack config](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack) [CITED: WebFetch 2026-04-14, version 16.2.3 lastUpdated 2026-04-10]
- [Resend emails.send API](https://resend.com/docs/api-reference/emails/send-email) [CITED: WebFetch 2026-04-14]
- [Playwright Events docs - waitForEvent popup](https://playwright.dev/docs/events) [CITED: WebSearch linked]
- [@react-email/render 2.0.6 release](https://github.com/resend/react-email) — R`async render()` 시그니처 [CITED: WebSearch 2026-04-14]
- [Toss Payments test guide](https://docs.tosspayments.com/blog/how-to-test-toss-payments) — "테스트 환경에서는 실 카드정보 사용, 출금 안 됨" [CITED: WebFetch]
- [Toss 환경 설정 가이드](https://docs.tosspayments.com/guides/v2/get-started/environment) — 테스트 키 패턴, virtual account 'X' prefix [CITED: WebFetch]

### Tertiary (LOW confidence — flagged for validation)
- Toss 공식 테스트 카드 번호 구체 리스트 — 공식 문서에서 "국내 카드 지정 테스트 번호 없음" 명시. 실측 필요. [A1 assumption]
- `TossPayments-Test-Code` header를 통한 에러 시뮬레이션 — WebSearch에서 confirm 못 함. Plan 3 executor가 Toss 지원팀 문의 필요 시.
- KOPICO "표준 티켓 예매 약관" 정확한 출처 — 공정거래위원회 자료일 가능성. Plan 2 executor가 공식 자료 링크 확인 후 각색.

## Metadata

**Confidence breakdown:**
- Standard stack (versions + integration): **HIGH** — `npm view` 실행 + Resend/React Email 공식 문서 WebFetch
- Architecture (SmsService 패턴 복제): **HIGH** — 기존 코드 직접 read
- Test state (DEBT-03/04 probe): **HIGH** — 실제 테스트 실행 + typecheck 실행
- Toss E2E 패턴: **MEDIUM** — 실 SDK iframe 동작은 실측 필요
- Markdown loader (Turbopack): **MEDIUM** — Next.js 문서 확인했으나 Grapit 환경에서 POC 필요
- KOPICO 문안 저작권 안전성: **LOW** — 법률 검토 범위 외

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (30일 — Resend/React Email 주간 릴리스 있으나 major breaking 확률 낮음)

---

## RESEARCH COMPLETE
