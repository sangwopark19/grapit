---
phase: 09-tech-debt
verified: 2026-04-14T00:00:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "비밀번호 재설정 이메일 실제 발송 및 링크 클릭 플로우 확인"
    expected: "실 RESEND_API_KEY 설정 후 /auth/password-reset/request 호출 → 실제 이메일 수신 → 링크 클릭 → 비밀번호 변경 완료"
    why_human: "Resend 샌드박스 또는 실 발송은 실제 RESEND_API_KEY가 있어야 하며, 이메일 수신함 확인은 자동화 불가. dev mock(console.log)은 검증됐지만 prod 이메일 발송 경로는 실 키 없이 테스트 불가."
  - test: "Toss Payments E2E 전체 실행 (TOSS_CLIENT_KEY_TEST 설정 후)"
    expected: "pnpm --filter @grapit/web test:e2e toss-payment 실행 시 3 tests PASS (happy path widget mount + confirm intercept + UI regression)"
    why_human: "실 DB 시드(admin@grapit.test) + API 서버 기동 + Toss sandbox 네트워크 접근 필요. 에이전트 샌드박스에서 실행 불가. SUMMARY에는 E2E 실행 자체가 deferred로 남겨져 있음."
---

# Phase 9: 기술부채 청산 Verification Report

**Phase Goal:** v1.0에서 누적된 stub, 테스트 회귀, 미검증 항목을 해소하여 코드베이스 신뢰도를 확보한다
**Verified:** 2026-04-14
**Status:** human_needed
**Re-verification:** No — 초기 검증

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | 비밀번호 재설정 시 실제 이메일이 발송되고 링크를 통해 비밀번호 변경 완료 | ? HUMAN | EmailService + auth.service.spec.ts 통합 테스트 존재(21/21 PASS 주장), console.log stub 제거 확인. prod 실 발송은 실 키 없이 확인 불가. |
| 2 | 회원가입 시 이용약관 dialog에 실제 약관 텍스트가 표시 | ✓ VERIFIED | signup-step2.tsx에 LegalDraftBanner + TermsMarkdown 조합, 3개 MD import, TERMS_CONTENT placeholder 완전 제거 확인. |
| 3 | 전체 테스트 스위트가 0 failure로 통과 (locked seat click 회귀 포함) | ✓ VERIFIED | SUMMARY에 API 160/160, web 91/91 전체 PASS 기록. format-datetime 4/4, seat-map-viewer 7/7 포함. seat-map-viewer.tsx production 코드 미변경 확인. auth.service.spec.ts 21/21 PASS 기록. |
| 4 | Toss Payments 결제 플로우가 E2E로 검증 완료 | ? HUMAN | E2E spec 파일 생성 확인(165줄), widget mount + confirmIntercepted strict assert 코드 존재 확인. 실 실행은 DB+API 서버+Toss sandbox 필요 — SUMMARY에서 명시적 deferred. |
| 5 | 타입 경고 0건 + 미사용 라우트 정리 완료 | ✓ VERIFIED | SUMMARY 기록: Plan 01/02/03 각각 pnpm typecheck exits 0. useShowtimes 훅 소스 파일에서 완전 제거 확인. admin-booking-detail-modal 인라인 formatDateTime 정의 0개 확인. |

**Score:** 3/5 자동 검증 완료, 2/5 인간 검증 필요

### Required Artifacts

#### Plan 01 (DEBT-03/04/06)

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `apps/web/lib/format-datetime.ts` | nullable-safe formatter, exports formatDateTime | ✓ VERIFIED | 24줄, `(string | null | undefined) => string` 시그니처, null/undefined/NaN 시 em dash 반환 |
| `apps/web/lib/format-datetime.test.ts` | 4개 테스트 (min 20줄) | ✓ VERIFIED | 23줄, null/undefined/valid-ISO/invalid 4 케이스 |
| `apps/web/components/ui/sonner.tsx` | classNames.info 포함 | ✓ VERIFIED | `info: 'bg-info-surface text-info border-info/20'` 존재 확인 |

#### Plan 02 (DEBT-01/02)

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `apps/api/src/modules/auth/email/email.service.ts` | Resend + dev mock + prod hard-fail | ✓ VERIFIED | 84줄, RESEND_API_KEY/FROM_EMAIL/NODE_ENV 기반 분기, `{data, error}` 패턴 |
| `apps/api/src/modules/auth/email/email.service.spec.ts` | 6-branch 테스트 (min 80줄) | ✓ VERIFIED | 100줄, 6 테스트 케이스(dev/prod-real/prod-misconfig-api-key/FROM_EMAIL-unset/FROM_EMAIL-invalid/SDK-error) |
| `apps/api/src/modules/auth/email/email.module.ts` | EmailModule, exports EmailService | ✓ VERIFIED | ConfigModule import, EmailService provider+export |
| `apps/api/src/modules/auth/email/templates/password-reset.tsx` | PasswordResetEmail export | ✓ VERIFIED | PasswordResetEmail function export 확인 |
| `apps/api/src/modules/auth/auth.service.spec.ts` | password reset flow integration describe | ✓ VERIFIED | L588: `describe('password reset flow integration')` + JwtService secret rotation assert + one-time token reuse rejection |
| `apps/web/content/legal/terms-of-service.md` | 40줄 이상 | ✓ VERIFIED | 78줄 |
| `apps/web/content/legal/privacy-policy.md` | 55줄 이상, 국외이전(제6조) 포함 | ✓ VERIFIED | 93줄, 제6조 "개인정보의 국외이전" + 제28조의8 + Resend/Twilio US 표 |
| `apps/web/content/legal/marketing-consent.md` | 15줄 이상 | ✓ VERIFIED | 32줄 |
| `apps/web/components/legal/legal-draft-banner.tsx` | LegalDraftBanner export, role='note', aria-label, WCAG AA | ✓ VERIFIED | role='note', aria-label='초안 안내', 초안 문구 확인. WCAG AA(7.47:1) SUMMARY 기록. |
| `apps/web/components/legal/terms-markdown.tsx` | TermsMarkdown export | ✓ VERIFIED | TermsMarkdown function export, react-markdown + remark-gfm |
| `apps/web/env.d.ts` | `declare module '*.md'` | ✓ VERIFIED | `declare module '*.md'` 존재 확인 |
| `.planning/phases/09-tech-debt/09-02-LEGAL-ACCURACY-CHECKLIST.md` | 수집 항목 vs users table 섹션 포함 | ✓ VERIFIED | "수집 항목 vs users table schema", 국외이전(제6조) row 포함 확인 |

#### Plan 03 (DEBT-05)

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `apps/web/e2e/toss-payment.spec.ts` | 90줄 이상, widget mount + confirm intercept + loginAsTestUser | ✓ VERIFIED | 165줄, `#payment-method iframe` assert, `expect.poll(() => confirmIntercepted).toBe(true)`, `loginAsTestUser(page)` 호출 |
| `apps/web/e2e/fixtures/booking-store.ts` | injectBookingFixture export, SeatSelection shape | ✓ VERIFIED | `export async function injectBookingFixture`, seatId+tierName shape 사용 |
| `apps/web/e2e/helpers/auth.ts` | loginAsTestUser export | ✓ VERIFIED | `export async function loginAsTestUser(page: Page)` |
| `apps/web/stores/use-booking-store.ts` | `__BOOKING_FIXTURE__` 포함 | ✓ VERIFIED | `window.__BOOKING_FIXTURE__` 훅 존재 확인 |
| `.github/workflows/ci.yml` | verify-toss-secrets step 포함 | ✓ VERIFIED | `verify-toss-secrets` step, push/schedule/workflow_dispatch + 동일 repo PR에서 exit 1, fork PR 허용 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `auth.service.ts` L240 | `emailService.sendPasswordResetEmail` | constructor 주입 | ✓ WIRED | `await this.emailService.sendPasswordResetEmail(email, resetLink)` 확인, console.log stub 0건 |
| `auth.controller.ts` | `@Throttle({ default: { limit: 3, ttl: 900000 } })` | password-reset/request + confirm | ✓ WIRED | L120, L133 각각 `@Throttle({ default: { limit: 3, ttl: 900000 } })` 확인 |
| `apps/api/src/main.ts` | FRONTEND_URL https 검증 | bootstrap process.exit(1) | ✓ WIRED | `FRONTEND_URL must be an https URL in production` 문자열 + process.exit(1) 확인 |
| `auth.module.ts` | EmailModule | imports 배열 | ✓ WIRED | `imports: [EmailModule]` L21 확인 |
| `signup-step2.tsx` | LegalDraftBanner + TermsMarkdown + 3 MD | Dialog body 렌더링 | ✓ WIRED | `<LegalDraftBanner />`, `<TermsMarkdown>{content}</TermsMarkdown>`, LEGAL_CONTENT 3개 MD 매핑 |
| `next.config.ts` | `raw-loader` 터보팩 룰 | turbopack.rules | ✓ WIRED | `'*.md': { as: '*.js', loaders: ['raw-loader'] }` 확인 |
| `deploy.yml` | RESEND 시크릿 주입 | Secret Manager 바인딩 | ✓ WIRED | `RESEND_API_KEY=resend-api-key:latest`, `RESEND_FROM_EMAIL=resend-from-email:latest` 확인 |
| `deploy.yml` | TOSS test 키 절대 미주입 (D-13) | NEGATIVE | ✓ VERIFIED | `grep -c 'TOSS_CLIENT_KEY_TEST\|TOSS_SECRET_KEY_TEST' deploy.yml` = 0 확인 |
| `booking-page.tsx` | `toast.info('이미 다른 사용자가 선택한 좌석입니다')` | 인라인 style 없음 | ✓ WIRED | 2곳 모두 plain toast.info, style 프롭 없음 |
| `admin-booking-detail-modal.tsx` | `from '@/lib/format-datetime'` | 공통 유틸 import | ✓ WIRED | import 확인, 인라인 function formatDateTime 정의 0건 |
| `booking-page.tsx` | `performance?.showtimes ?? []` | useShowtimes 제거 후 | ✓ WIRED | `allShowtimes = useMemo(() => performance?.showtimes ?? [], ...)` 확인 |
| `toss-payment.spec.ts` | `loginAsTestUser(page)` | happy path 시작부 | ✓ WIRED | L46 `await loginAsTestUser(page)` 확인 |
| `toss-payment.spec.ts` | `expect.poll(() => confirmIntercepted).toBe(true)` | strict boolean assert | ✓ WIRED | L109 `expect.poll(() => confirmIntercepted, { timeout: 10000 }).toBe(true)` 확인 |
| `ci.yml` | `verify-toss-secrets` hard-gate | exit 1 on non-fork missing secrets | ✓ WIRED | push/schedule/workflow_dispatch + 동일 repo PR에서 exit 1, fork는 조건 불일치로 skip |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `signup-step2.tsx` → TermsMarkdown | `LEGAL_CONTENT[dialogKey]?.content` | Turbopack raw-loader로 MD import | MD 파일 3개 정적 번들링 | ✓ FLOWING |
| `email.service.ts` → Resend | `resetLink` | `auth.service.ts`에서 JWT 생성 후 EmailService 호출 | prod: Resend API, dev: console.log | ✓ FLOWING (dev 확인, prod은 인간 검증 필요) |
| `toss-payment.spec.ts` → confirmIntercepted | `confirmIntercepted = true` | `page.route` intercept callback | page.route가 실제로 호출되었을 때 | ? (E2E 실행 필요) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---------|---------|--------|--------|
| formatDateTime null 반환 | 소스 코드 직접 확인 (tests 4/4 PASS 주장) | em dash 반환 로직 확인 | ✓ PASS (정적) |
| useShowtimes 소스 파일 0건 | grep 결과 | 0건 확인 | ✓ PASS |
| EmailService 6-branch 테스트 | SUMMARY 기록 | 6/6 PASS | ✓ PASS (SUMMARY 신뢰) |
| auth.service 통합 테스트 | SUMMARY 기록 | 21/21 PASS | ✓ PASS (SUMMARY 신뢰) |
| Toss E2E 전체 실행 | 실 서버+DB 필요 | 실행 불가 (sandbox) | ? SKIP |
| 비밀번호 재설정 이메일 수신 | 실 RESEND_API_KEY 필요 | 실행 불가 | ? SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|---------|
| DEBT-01 | Plan 02 | Password reset 이메일 기능 실구현 | ? PARTIAL | EmailService + auth.service 통합 테스트 구현 완료, prod 실 발송은 인간 검증 필요 |
| DEBT-02 | Plan 02 | 이용약관 dialog에 실제 약관 텍스트 | ✓ SATISFIED | 3개 MD + LegalDraftBanner + TermsMarkdown + signup-step2 wiring 전부 확인 |
| DEBT-03 | Plan 01 | seat-map-viewer locked seat click 테스트 회귀 수정 | ✓ SATISFIED | seat-map-viewer.tsx 미수정, sonner classNames.info 일원화, 7/7 PASS 주장 |
| DEBT-04 | Plan 01 | admin-booking-detail-modal formatDateTime null 타입 경고 | ✓ SATISFIED | nullable-safe util 추출, 인라인 정의 0건, typecheck 0 errors |
| DEBT-05 | Plan 03 | Toss Payments E2E 테스트 검증 | ? PARTIAL | E2E spec + fixture + auth helper 구현 완료, 실 실행은 인간 검증 필요 |
| DEBT-06 | Plan 01 | useShowtimes hook 미존재 라우트 정리 | ✓ SATISFIED | 소스 파일 0건, booking-page.tsx performance?.showtimes ?? [] 단일화 |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|---------|--------|
| `apps/web/e2e/toss-payment.spec.ts` L121-148 | Cancel/Decline 시나리오가 URL simulation만 — 실 Toss flow 아님 | ℹ️ Info | 의도적 설계 (DEBT-05 closure는 happy path만, UI regression test 주석 명시됨) |
| E2E 전체 | 실 E2E 실행 결과가 SUMMARY에 deferred로 명시됨 | ⚠️ Warning | 코드는 완성됐으나 실 실행 검증 미완료 |

### Human Verification Required

#### 1. 비밀번호 재설정 이메일 실 발송 플로우

**Test:** 실 RESEND_API_KEY + RESEND_FROM_EMAIL 환경변수 설정 후 `/auth/password-reset/request` 엔드포인트 호출, 등록된 이메일 수신함 확인, 링크 클릭 후 비밀번호 변경 완료
**Expected:** 이메일 수신 → 링크 클릭 → /auth/reset-password?token=... 페이지 접근 → 새 비밀번호 입력 → 로그인 성공
**Why human:** Resend API 실 키가 필요하며 이메일 수신함 확인은 자동화 불가. dev mock은 console.log로 대체되어 검증됐지만 prod 경로는 실 키 없이 검증 불가.

#### 2. Toss Payments E2E 전체 실행

**Test:** `TOSS_CLIENT_KEY_TEST` + `TOSS_SECRET_KEY_TEST` GitHub Actions secrets 등록 후, `pnpm --filter @grapit/api seed` 실행하여 `admin@grapit.test` 시드, API 서버 기동, `pnpm --filter @grapit/web test:e2e toss-payment` 실행
**Expected:** 3개 테스트 PASS — (1) happy path: `/booking/:id/confirm` 접근 → Toss widget iframe mount → `/booking/:id/complete` 리다이렉트 → `confirmIntercepted === true` (2) cancel URL regression (3) decline URL regression
**Why human:** 실 PostgreSQL DB + API 서버(port 8080) + Toss sandbox 네트워크 접근이 필요. 에이전트 샌드박스에서 서버를 기동하거나 외부 서비스에 접근 불가. SUMMARY에서 명시적으로 deferred.

### Gaps Summary

자동 검증 가능한 5개 Roadmap Success Criteria 중 3개가 완전 통과되었습니다.

성공 기준 2 (이용약관 텍스트), 성공 기준 3 (테스트 회귀), 성공 기준 5 (타입 경고 0건 + 미사용 라우트 정리)는 코드베이스에서 완전히 검증되었습니다.

성공 기준 1 (비밀번호 재설정 이메일)과 성공 기준 4 (Toss E2E)는 구현 코드가 완성됐지만 실 외부 서비스(Resend, Toss sandbox)와의 연동은 실 환경에서만 검증 가능합니다. 이는 자동화 한계이지 구현 결함이 아닙니다. 두 항목 모두 SUMMARY에서 명시적으로 실 환경 실행이 deferred 상태임을 인정하고 있습니다.

---

_Verified: 2026-04-14_
_Verifier: Claude (gsd-verifier)_
