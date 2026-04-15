---
phase: 09-tech-debt
verified: 2026-04-15T03:00:00Z
status: human_needed
score: 4/5 must-haves verified (Truth 1 closed by Plan 04 human UAT, Truth 4 still awaiting live CI run)
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 4/5
  gaps_closed:
    - "Truth 1 (DEBT-01): 비밀번호 재설정 이메일 수신 → 링크 → confirm UI → 비밀번호 변경 → 재로그인 end-to-end — Plan 04 Task 4 human UAT (sangwopark19@gmail.com 실계정) 승인 2026-04-15"
    - "CR-02 silent regression (preliminary verifyAsync 가 합법 토큰도 401 로 차단하던 문제) — Plan 04 Task 5-7 (TDD RED/GREEN + real JwtService integration guard 3 cases) 로 해소"
    - "UAT Test 11 (이메일 링크 클릭 시 재설정 UI 가 아닌 다시 요청 폼으로 가던 frontend 공백) — Plan 04 Task 1-3 (page.tsx Suspense + useSearchParams 분기 + ConfirmView + raw fetch 401/429/400/네트워크 에러 UI) 로 해소"
  gaps_remaining: []
  regressions: []
  notes:
    - "Truth 1 의 인간 검증 조건은 Plan 04 Task 4 UAT 로 충족됨 — frontend confirm UI 도입 전 1차 검증에서 이메일 수신/링크 접근은 pass 였으나 '링크 → 재설정 UI' 가 missing 이었음. Plan 04 완료 후 2026-04-15 같은 실 계정에서 정상 경로 + 회귀 시나리오 6 (위조 토큰 → confirm 폼 → 제출 → backend 401 → '유효하지 않은 링크' 에러 UI + 다시 요청하기 링크) 까지 승인 완료."
    - "Truth 4 (Toss E2E) 는 여전히 실 CI 환경 (DB seed + API 서버 + Toss sandbox 네트워크 + GitHub Actions TOSS_*_TEST secrets) 을 요구하므로 인간/CI 검증으로 남음. 코드는 100% 완성."
human_verification:
  - test: "Toss Payments E2E 전체 실행 (TOSS_CLIENT_KEY_TEST / TOSS_SECRET_KEY_TEST secrets 등록 후 CI 1회 실행 또는 로컬 live run)"
    expected: "pnpm --filter @grapit/web test:e2e toss-payment 실행 시 3 tests PASS (happy path widget mount `#payment-method iframe` visible + page.route intercept 로 confirmIntercepted === true 확인 + UI regression 2)"
    why_human: "실 DB 시드 (admin@grapit.test) + API 서버 기동 (port 8080) + Toss sandbox 네트워크 접근 필요. 에이전트 샌드박스에서 실행 불가. 09-03-SUMMARY 의 'Requires local infra' 섹션에 명시적으로 'first CI run on main push is the canonical verification trigger' 로 deferred. 코드/static 검증은 모두 완료 (typecheck 0 / build 0 / spec parses / D-13 deploy.yml 격리 grep=0)."
---

# Phase 9: 기술부채 청산 Verification Report

**Phase Goal:** v1.0에서 누적된 stub, 테스트 회귀, 미검증 항목을 해소하여 코드베이스 신뢰도를 확보한다
**Verified:** 2026-04-15T03:00:00Z
**Status:** human_needed (1 item remaining — live CI / external-infra requirement only)
**Re-verification:** Yes — 2차 검증 (Plan 04 gap closure 반영)

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 비밀번호 재설정 시 실제 이메일이 발송되고 링크를 통해 비밀번호 변경 완료 | ✓ VERIFIED | **(re-verification)** Plan 02: EmailService + Resend + auth.service 통합 테스트 21/21 PASS. Plan 04 Task 1-3: `page.tsx` 에 `Suspense > ResetPasswordInner > (RequestView \| ConfirmView)` 도입, `useSearchParams().get('token')` 분기, `fetch('/api/v1/auth/password-reset/confirm', ...)` 호출, 401/429/400/네트워크 에러 UI. Plan 04 Task 4: 2026-04-15 sangwopark19@gmail.com 실계정 human UAT 승인 — 이메일 수신 → 링크 클릭 → confirm 폼 → 비밀번호 변경 → 새 비밀번호로 로그인 완료. 회귀 시나리오 6 (위조 토큰) 포함 모두 pass. |
| 2 | 회원가입 시 이용약관 dialog에 실제 약관 텍스트가 표시 | ✓ VERIFIED | `signup-step2.tsx` L18-19 `LegalDraftBanner` + `TermsMarkdown` import, L30 `LEGAL_CONTENT` 3개 MD 매핑 (type `LegalKey`), L190-191 Dialog body 에 `<LegalDraftBanner />` + `<TermsMarkdown>{LEGAL_CONTENT[dialogKey].content}</TermsMarkdown>`. 3개 MD 파일 존재 (terms-of-service.md / privacy-policy.md 제6조 국외이전 + 제28조의8 / marketing-consent.md). 1차 UAT Test 2-5 pass. |
| 3 | 전체 테스트 스위트가 0 failure로 통과 (locked seat click 회귀 포함) | ✓ VERIFIED | Plan 04 SUMMARY: API 22 files / **172 tests pass** (Plan 02 의 169 + Plan 04 신규 3 integration), Web 16 files / **95 tests pass** (Plan 02 의 91 + Plan 04 신규 4 reset-password). seat-map-viewer.tsx production 코드 미변경 (Plan 01 SUMMARY self-check). auth.service.spec.ts 에 24 `it()` 블록 확인 (기존 21 + CR-02 regression guard 3). |
| 4 | Toss Payments 결제 플로우가 E2E로 검증 완료 | ? HUMAN | E2E spec 파일 + fixture + auth helper + CI secrets hard-gate 모두 존재. `toss-payment.spec.ts` L96 `#payment-method iframe` visible assert, L109 `expect.poll(() => confirmIntercepted, { timeout: 10000 }).toBe(true)`, L46/128/150 `loginAsTestUser(page)` 3회 호출. typecheck/build/lint 0 errors. **실 실행은 external infra (DB seed + API server + Toss sandbox + GitHub secrets) 필요 — 09-03-SUMMARY 에 명시적 deferred.** |
| 5 | 타입 경고 0건 + 미사용 라우트 정리 완료 | ✓ VERIFIED | Plan 01/02/03/04 각 SUMMARY: `pnpm typecheck` exit 0, `pnpm lint` 0 errors (pre-existing warnings 만 잔존, CLAUDE.md 지침 준수). `grep -rn 'useShowtimes' apps/` = 0. `allShowtimes = useMemo(() => performance?.showtimes ?? [], ...)` 단일화 (booking-page.tsx L67). admin-booking-detail-modal 인라인 `function formatDateTime` 0건. |

**Score:** 4/5 자동 검증 완료, 1/5 인간/CI 검증 필요 (이전 검증 대비 Truth 1 closure 로 +1)

---

## Required Artifacts

### Plan 01 (DEBT-03/04/06) — 빠른 정리

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/lib/format-datetime.ts` | nullable-safe formatter, exports formatDateTime | ✓ VERIFIED | 시그니처 `(string \| null \| undefined) => string`, null/undefined/NaN 시 `—` (U+2014) 반환 |
| `apps/web/lib/format-datetime.test.ts` | 4개 테스트 | ✓ VERIFIED | null / undefined / valid-ISO / invalid 4 케이스 (Plan 01 SUMMARY) |
| `apps/web/components/ui/sonner.tsx` | classNames.info 포함 | ✓ VERIFIED | `info: 'bg-info-surface text-info border-info/20'` 존재 (Plan 01 SUMMARY self-check) |

### Plan 02 (DEBT-01/02) — 이메일 + 약관

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/modules/auth/email/email.service.ts` | Resend + dev mock + prod hard-fail | ✓ VERIFIED | ls 확인 (email/ 디렉터리 내 3 파일). 6/6 branch spec PASS |
| `apps/api/src/modules/auth/email/email.service.spec.ts` | 6-branch 테스트 | ✓ VERIFIED | Plan 02 SUMMARY: 6 케이스 (dev/prod-happy/prod-misconfig API_KEY/FROM_EMAIL 미설정/FROM_EMAIL 무효/SDK error) |
| `apps/api/src/modules/auth/email/email.module.ts` | EmailModule | ✓ VERIFIED | ls 확인, auth.module.ts 에 imports 확인 |
| `apps/api/src/modules/auth/email/templates/password-reset.tsx` | PasswordResetEmail | ✓ VERIFIED | templates/ 디렉터리 확인 |
| `apps/api/src/modules/auth/auth.service.spec.ts` | password reset flow integration + CR-02 regression guard | ✓ VERIFIED | L596 `describe('password reset flow integration')` + L791 `describe('resetPassword (integration — real JwtService — CR-02 regression guard)')` (Plan 04 신규) + real `new JwtService({ secret })` L828. 총 24 `it()` 블록 |
| `apps/web/content/legal/terms-of-service.md` | 40줄+ | ✓ VERIFIED | Plan 02 SUMMARY: 78줄 / 15 조항 |
| `apps/web/content/legal/privacy-policy.md` | 55줄+, 제6조 국외이전 | ✓ VERIFIED | Plan 02 SUMMARY: 93줄, "개인정보의 국외이전" + "제28조의8" + Resend/Twilio US 표 |
| `apps/web/content/legal/marketing-consent.md` | 15줄+ | ✓ VERIFIED | Plan 02 SUMMARY: 32줄 |
| `apps/web/components/legal/legal-draft-banner.tsx` | role='note', aria-label, WCAG AA 7.47:1 | ✓ VERIFIED | Plan 02 SUMMARY self-check |
| `apps/web/components/legal/terms-markdown.tsx` | react-markdown + remark-gfm | ✓ VERIFIED | Plan 02 SUMMARY |
| `apps/web/env.d.ts` | `declare module '*.md'` | ✓ VERIFIED | Plan 02 SUMMARY |
| `.planning/phases/09-tech-debt/09-02-LEGAL-ACCURACY-CHECKLIST.md` | schema cross-check + 제6조 row | ✓ VERIFIED | ls 확인 (Phase dir 내) |

### Plan 03 (DEBT-05) — Toss E2E

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/e2e/toss-payment.spec.ts` | widget mount + confirm intercept + loginAsTestUser | ✓ VERIFIED | 166줄, L96 `#payment-method iframe` assert, L109 `expect.poll(() => confirmIntercepted)`, L46/128/150 `loginAsTestUser(page)` |
| `apps/web/e2e/fixtures/booking-store.ts` | injectBookingFixture + SeatSelection shape (Blocker B1) | ✓ VERIFIED | ls 확인, seatId/tierName shape (Plan 03 SUMMARY grep) |
| `apps/web/e2e/helpers/auth.ts` | loginAsTestUser export (Blocker B2) | ✓ VERIFIED | ls 확인, real /api/v1/auth/login (Plan 03 SUMMARY) |
| `apps/web/stores/use-booking-store.ts` | `__BOOKING_FIXTURE__` dev-only hook | ✓ VERIFIED | Plan 03 SUMMARY grep: 7 matches (existing + fixture block) |
| `.github/workflows/ci.yml` | verify-toss-secrets hard-gate | ✓ VERIFIED | Plan 03 SUMMARY: ci.yml L29-31 event gate + L32 fork detection + L41 exit 1 |

### Plan 04 (DEBT-01 gap closure) — Reset Password Confirm UI + CR-02 Fix

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/app/auth/reset-password/page.tsx` | Suspense + token 분기 + ConfirmView 폼 + raw fetch + 401/429/400 에러 UI | ✓ VERIFIED | L3 Suspense import, L8 useSearchParams, L12 resetPasswordSchema, L32 `<Suspense fallback={null}>`, L39 `searchParams`, L43 `<ConfirmView token={token} />`, L45 `<RequestView />`, L156 `function ConfirmView({ token })`, L159 `const [tokenError, setTokenError] = useState(false)`, L162 `resolver: zodResolver(resetPasswordSchema)`, L163 defaultValues { token, newPassword, newPasswordConfirm }, L171 `fetch('/api/v1/auth/password-reset/confirm', ...)`, L209 `if (tokenError)` branch, L222 `<Link href="/auth/reset-password">다시 요청하기</Link>`, L251/271 `name="newPassword"` + `name="newPasswordConfirm"` |
| `apps/web/app/auth/reset-password/__tests__/reset-password.test.tsx` | vitest 4 cases | ✓ VERIFIED | L41 `describe('ResetPasswordPage')`, L52 request-mode / L60 confirm-mode 두 중첩 describe, L53 이메일 폼 렌더 regression, L65 새 비밀번호 UI 렌더, L74 fetch path + body 검증 (`/api/v1/auth/password-reset/confirm`, token/newPassword/newPasswordConfirm), L108 401 → 에러 UI + 다시 요청하기 링크. 95개 web test 에 포함 |
| `apps/api/src/modules/auth/auth.service.ts` | preliminary verifyAsync → decode (CR-02 fix) | ✓ VERIFIED | L254 주석 "decode 로 sub 만 추출. 서명은 검증하지 않고 형식(UUID) 검사로 DB lookup 전", L269 `this.jwtService.decode<{ sub?: unknown } \| null>(token)`, L270-274 null/object/UUID_REGEX 가드 유지, L295 final `verifyAsync<{ ... }>` 호출 (서명 + 만료 검증은 이 한 곳에서만) |
| `apps/api/src/modules/auth/auth.service.spec.ts` (재검증) | real JwtService regression guard 3 cases | ✓ VERIFIED | L791-905 `describe('resetPassword (integration — real JwtService — CR-02 regression guard)')` — 3 `it()` 블록: (1) 정상 token 성공, (2) sub 형식 위반 → 401, (3) passwordHash 누락 secret → final 401. L828 `new JwtService({ secret })` 실제 인스턴스 주입, L854-861 `new AuthService(realJwtService, ...)` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `auth.service.ts` L250 | `emailService.sendPasswordResetEmail` | constructor 주입 | ✓ WIRED | grep: L65 `private readonly emailService: EmailService`, L250 `await this.emailService.sendPasswordResetEmail(email, resetLink)`. console.log stub 0건 |
| `auth.service.ts` L269 | `jwtService.decode` (CR-02 preliminary) | JwtService DI | ✓ WIRED | grep: L269 `this.jwtService.decode<{ sub?: unknown } \| null>(token)` (verifyAsync 호출은 L295/L408 — registration 용 final verify 만) |
| `auth.controller.ts` | `@Throttle({ default: { limit: 3, ttl: 900000 } })` | request + confirm | ✓ WIRED | Plan 02 SUMMARY self-check: 2회 적용, v6 객체 시그니처 전용 (v5 positional 금지 regex 통과) |
| `apps/api/src/main.ts` L28-44 | FRONTEND_URL https 검증 | bootstrap | ✓ WIRED | grep: L31 "FRONTEND_URL must be set in production", L36 non-https filter, L34/L42 `process.exit(1)` |
| `auth.module.ts` | EmailModule | imports | ✓ WIRED | Plan 02 SUMMARY self-check |
| `signup-step2.tsx` L190-191 | LegalDraftBanner + TermsMarkdown + 3 MD | Dialog body | ✓ WIRED | grep: L18-19 imports, L30 LEGAL_CONTENT, L185 DialogTitle, L190 `<LegalDraftBanner />`, L191 `<TermsMarkdown>{LEGAL_CONTENT[dialogKey].content}</TermsMarkdown>` |
| `next.config.ts` | `raw-loader` turbopack 룰 | turbopack.rules | ✓ WIRED | Plan 02 SUMMARY build PASS (MD bundle 임베드 검증) |
| `deploy.yml` L119-120 | RESEND 시크릿 | Secret Manager | ✓ WIRED | grep: RESEND_API_KEY + RESEND_FROM_EMAIL `:latest` 바인딩 |
| `deploy.yml` | TOSS test 키 NEGATIVE (D-13) | 미주입 | ✓ VERIFIED | grep TOSS_CLIENT_KEY_TEST/TOSS_SECRET_KEY_TEST in deploy.yml = 0 matches |
| `booking-page.tsx` | `performance?.showtimes ?? []` | useShowtimes 제거 후 | ✓ WIRED | L67 `const allShowtimes = useMemo(...)` 단일화, L75/83/88/91/95/96/285/299 에서 일관 참조 |
| `admin-booking-detail-modal.tsx` | `@/lib/format-datetime` | 공통 유틸 import | ✓ WIRED | Plan 01 SUMMARY self-check (인라인 정의 0건) |
| `toss-payment.spec.ts` | `loginAsTestUser(page)` | AuthGuard bypass | ✓ WIRED | L46 (happy), L128/L150 (regression scenarios) — 3회 호출 |
| `toss-payment.spec.ts` | `expect.poll(() => confirmIntercepted).toBe(true)` | strict boolean assert | ✓ WIRED | L109 confirm intercept polling |
| `ci.yml` | `verify-toss-secrets` hard-gate | event-conditional exit 1 | ✓ WIRED | Plan 03 SUMMARY static verification |
| **Plan 04**: `reset-password/page.tsx` L171 | `POST /api/v1/auth/password-reset/confirm` | raw fetch (apiClient 401 auto-redirect 우회) | ✓ WIRED | L171 `await fetch('/api/v1/auth/password-reset/confirm', ...)`, L162-163 react-hook-form + zodResolver(resetPasswordSchema) body 구성, L209-222 tokenError → "유효하지 않은 링크" + `Link href="/auth/reset-password"` 다시 요청하기 |
| **Plan 04**: Backend `auth.service.ts` L269 | `decode` (preliminary) → L295 `verifyAsync` (final) | 2-단계 token 검증 | ✓ WIRED | preliminary 는 서명 검증 없이 sub UUID 형식만 가드 (DoS/PG 22P02 방지), final 은 jwtSecret + user.passwordHash 로 rotation-aware verify. CR-02 regression (bc3b434) 해소 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `signup-step2.tsx` → TermsMarkdown | `LEGAL_CONTENT[dialogKey].content` | Turbopack raw-loader MD import | 3 MD 정적 번들 | ✓ FLOWING |
| `email.service.ts` → Resend | `resetLink` | `auth.service.ts` L245-250 에서 JWT sign (jwtSecret + passwordHash) + `${frontendUrl}/auth/reset-password?token=...` 합성 후 EmailService 호출 | prod: Resend API, dev: logger.log | ✓ FLOWING (dev 검증 + Plan 04 human UAT 에서 prod 경로 실 이메일 수신 확인) |
| **Plan 04**: `reset-password/page.tsx` ConfirmView | `token` (searchParams) + `newPassword`/`newPasswordConfirm` (form state) | `useSearchParams().get('token')` + react-hook-form | 사용자 입력 → fetch body → backend 200/401 응답 | ✓ FLOWING (vitest 4 cases + 실 UAT 통과) |
| **Plan 04**: Backend `auth.service.ts` resetPassword | `preliminarySub` → `payload.sub` → `user.passwordHash` | preliminary decode(token) → final verifyAsync(jwtSecret + user.passwordHash) | 유효 token → updatePassword 호출, 위조 token → final 401 | ✓ FLOWING (real JwtService integration test 3/3 + UAT 시나리오 6 위조 토큰 401 확인) |
| `toss-payment.spec.ts` → confirmIntercepted | `confirmIntercepted = true` | `page.route` intercept callback | page.route 가 실제 호출될 때 | ? (live E2E 실행 필요 — external infra) |

---

## Behavioral Spot-Checks

| Behavior | Command / Artifact | Result | Status |
|----------|---------------------|--------|--------|
| formatDateTime null 반환 | `apps/web/lib/format-datetime.ts` L10/L15 em dash 반환 | source 확인 | ✓ PASS (static) |
| useShowtimes 소스 파일 0건 | `grep -rn 'useShowtimes' apps/` | 0건 | ✓ PASS |
| EmailService 6-branch | Plan 02 SUMMARY | 6/6 PASS | ✓ PASS (SUMMARY) |
| auth.service 통합 테스트 | `grep -c 'it('` auth.service.spec.ts | 24 it blocks (기존 21 + Plan 04 CR-02 guard 3) | ✓ PASS (SUMMARY: 24/24) |
| reset-password vitest | Plan 04 SUMMARY | 4/4 PASS (request / confirm / fetch / 401) | ✓ PASS (SUMMARY) |
| API 전체 test | Plan 04 SUMMARY | 22 files / 172 tests pass | ✓ PASS (SUMMARY) |
| Web 전체 test | Plan 04 SUMMARY | 16 files / 95 tests pass | ✓ PASS (SUMMARY) |
| Web build (turbopack raw-loader) | Plan 02 SUMMARY + Plan 04 SUMMARY | 성공 (`/auth/reset-password` static prerender 포함) | ✓ PASS (SUMMARY) |
| API build (SWC + React Email TSX) | Plan 04 SUMMARY | TSC 0 issues, SWC 115 files compiled | ✓ PASS (SUMMARY) |
| Toss E2E 실행 | 실 서버 + DB + sandbox 필요 | deferred (09-03-SUMMARY) | ? SKIP |
| Password reset 실 이메일 수신 | Plan 04 Task 4 human UAT (2026-04-15) | 실 계정 수신 + 링크 → 비밀번호 변경 + 로그인 + 위조 토큰 거부 | ✓ PASS (human, 기존 ? HUMAN 에서 승격) |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DEBT-01 | Plan 02 + **Plan 04** | Password reset 이메일 실구현 + confirm UI + CR-02 fix | ✓ SATISFIED | EmailService 6/6 + auth.service integration 21/21 + **reset-password vitest 4/4 + real JwtService CR-02 guard 3/3 + 2026-04-15 human UAT 승인** |
| DEBT-02 | Plan 02 | 이용약관 dialog 실 텍스트 | ✓ SATISFIED | 3 MD + LegalDraftBanner + TermsMarkdown + signup-step2 wiring + UAT Test 2-5 pass |
| DEBT-03 | Plan 01 | seat-map-viewer locked seat 회귀 fix | ✓ SATISFIED | sonner classNames.info 일원화, seat-map-viewer.tsx 미수정, 7/7 PASS |
| DEBT-04 | Plan 01 | formatDateTime null 타입 경고 | ✓ SATISFIED | nullable-safe util 추출, 인라인 정의 0건, typecheck 0 errors |
| DEBT-05 | Plan 03 | Toss Payments E2E 검증 | ? PARTIAL | 코드 완성 (spec 166줄 + fixture + auth helper + CI hard-gate), 실 실행은 external infra 필요 (09-03-SUMMARY deferred) |
| DEBT-06 | Plan 01 | useShowtimes dead code | ✓ SATISFIED | 소스 0건, booking-page.tsx 단일화 |

**커버리지:** 5/6 완전 충족, 1/6 (DEBT-05) PARTIAL — 구현 완료 / 실 실행 검증 대기

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `apps/web/e2e/toss-payment.spec.ts` L121-148 | Cancel/Decline 시나리오는 URL simulation 만 | ℹ️ Info | 의도적 — DEBT-05 closure 는 happy path 만, regression test 주석 명시 |
| E2E 전체 | 실 실행이 external infra 필요 (deferred) | ⚠️ Warning | 코드 완성 / 실 실행 미검증 (09-03-SUMMARY 명시) |
| Plan 04 위조 토큰 pre-submit 가드 | 위조 토큰 클릭 시 confirm 폼 렌더 → 사용자 입력 후에야 401 표시 | ℹ️ Info | 의도적 — UAT 시나리오 6 에서 flow 확인됨. UX 개선 여지: 페이지 로드 시 token 유효성 pre-check. Phase 12 UX 현대화 또는 별도 follow-up 후보 (Gaps 아님) |

---

## Human Verification Required

### 1. Toss Payments E2E 전체 실행

**Test:** `gh secret set TOSS_CLIENT_KEY_TEST --body "test_gck_..."` + `TOSS_SECRET_KEY_TEST` 등록 후, main push 또는 `gh workflow run CI` 트리거 → Playwright 3 tests 실행.
**Expected:**
- (1) happy path: `loginAsTestUser` → `/booking/:id/confirm` 접근 → `#payment-method iframe` visible → `/booking/:id/complete?...` 리다이렉트 → `confirmIntercepted === true` polling 통과 → BookingComplete 텍스트 노출
- (2) cancel URL regression — UI 만
- (3) decline URL regression — UI 만
**Why human:** 실 PostgreSQL DB (`admin@grapit.test` 시드) + API server (port 8080) + Toss sandbox 네트워크 + GitHub Actions secrets 등록 필요. 에이전트 샌드박스 밖. 09-03-SUMMARY 에 이미 deferred checklist 로 문서화됨 (secret 등록 + `gcloud run services describe` 로 D-13 프로덕션 격리 재확인 + 선택적 drill).

---

## Gaps Summary

5개 Roadmap Success Criteria 중 4개가 완전 검증되었고, 1개(Truth 4 / DEBT-05)만 external infra 제약으로 인간 검증에 남음.

**이전 검증(2026-04-14, status: human_needed, 2/5 pending) 대비 변화:**

- Truth 1 (DEBT-01 이메일 end-to-end) — **HUMAN → VERIFIED** (Plan 04 인간 UAT 승인).
- Truth 4 (DEBT-05 Toss E2E) — **HUMAN 유지** (live CI 실행은 에이전트 범위 밖 그대로).
- 추가 획득: CR-02 silent regression 해소 + real JwtService integration guard 3 cases. 이는 이전 UAT 시점에는 존재하지 않았던 추가 회귀 가드로, 향후 토큰 회전/서명 검증 관련 코드 변경 시 동일 mock 함정을 봉쇄한다.

**Phase 9 실질적 완료 상태:** 6건 기술부채(DEBT-01~06) 중 5건 완전 closure, 1건(DEBT-05) 코드 완전 + 실 실행 CI 대기. 전체 테스트 suite green (API 172 + Web 95), lint 0 errors, typecheck 0 errors, 양쪽 build 성공.

---

## Open Follow-ups (Phase 9 범위 외 — 참고용)

Phase 9 를 종료하기 전에 결정 불필요한 정보성 항목:

1. **Reset-password 위조 토큰 UX 개선 (optional):** 현재는 위조 token 링크 클릭 → confirm 폼 렌더 → 사용자 입력 → backend 401 → 에러 UI 경로. 페이지 로드 시점에 token 유효성을 pre-check 하는 API 를 추가하면 사용자 경험이 좋아지지만, Phase 9 범위 외 UX 개선. Phase 12 UX 현대화 또는 별도 quick task.
2. **Toss E2E 실 CI 1회 실행:** main push 후 `verify-toss-secrets` hard-gate 통과 + 3 tests PASS 확인. Phase 9 closure 이후 운영 업무(1인 개발 manual checklist 09-03-SUMMARY 기재) 로 처리.
3. **이메일 템플릿 확장:** 현재 password-reset TSX 1개. 예매 확인/취소 메일은 09-CONTEXT 에 명시된 별도 phase 로 deferred (descope 유지).
4. **약관 버전 추적:** 09-CONTEXT 의 deferred 항목 — 법적 요구 발생 시 `terms_versions` + `user_consents` 테이블 설계 phase 분리.

---

## Final Verdict

**PARTIAL PASS (human_needed) — DEBT-01~04 + DEBT-06 완전 통과, DEBT-05 코드 완료 / 실 CI 실행 1회 대기**

- **Phase 9 실질 완료도:** 5/6 requirements fully verified (83%) + 1/6 code-complete / infra-pending.
- **회귀 위험:** 낮음. API 172/172, Web 95/95 PASS. CR-02 regression 은 real-service integration guard 로 봉쇄됨.
- **Plan 04 gap closure 효과:** UAT Test 11 에서 발견된 frontend confirm UI 공백 + 동반 발견된 CR-02 backend regression 두 건을 같은 plan 안에서 TDD 로 닫음. 1차 verify 대비 Truth 1 `HUMAN → VERIFIED`.
- **차기 phase 진입 가능 여부:** Phase 10 (SMS 실연동) planning 시작 가능. DEBT-05 의 external-infra 1회 실행은 병렬 운영 업무로 처리 (code-complete 상태이므로 planning block 아님).

**권장 조치:**
1. Phase 10 planning 착수 (Depends on Phase 9 — code-complete 확인됨).
2. `gh secret set TOSS_*_TEST` 등록 + 다음 main push 의 `verify-toss-secrets` + E2E step 결과 확인. 만약 FAIL 시 별도 fix plan (09-tech-debt wave 5) 로 대응.

---

_Verified: 2026-04-15T03:00:00Z_
_Verifier: Claude (gsd-verifier, re-verification after Plan 04 gap closure)_
_Previous verification: 2026-04-14T00:00:00Z (human_needed, 4/5)_
