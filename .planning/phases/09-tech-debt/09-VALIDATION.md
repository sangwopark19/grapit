---
phase: 9
slug: tech-debt
status: revised-for-reviews-2
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-14
last_revised: 2026-04-14 (revision-2 — checker blockers B1/B2/B3/B4/B5/B6 + W1/W5)
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. See `09-RESEARCH.md` §Validation Architecture for the source-of-truth mapping.
> **Revised 2026-04-14 (iteration 1 — reviews mode)** to reflect Codex review feedback: (HIGH-01) Plan 3 real widget mount + strict confirm intercept, (HIGH-02) CI secrets hard-gate, (HIGH-03) password reset flow integration test, (HIGH-04) rate limit, plus MED items (RESEND_FROM_EMAIL hard-fail, FRONTEND_URL validation, API build, raw-loader unification, legal accuracy checklist, grep -c bug).
> **Revised 2026-04-14 (iteration 2 — checker blockers)** to close 6 blockers + warnings: B1 (Plan 3 seats shape → SeatSelection), B2 (Plan 3 auth helper loginAsTestUser), B3 (Plan 2 privacy-policy 국외이전 제6조), B4 (Plan 2 Task 6 JwtService secret rotation assert), B5 (Plan 2 Task 5 @nestjs/throttler v6 객체 시그니처 lock), B6 (Plan 2 Task 2 typecheck 제거 → Task 3 이동), W1 (Plan 3 Task 5 SUMMARY as deliverable), W5 (LegalDraftBanner WCAG AA contrast check).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.0 (unit/integration) + Playwright 1.59.1 (E2E) |
| **Config file** | `apps/api/vitest.config.ts`, `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts` |
| **Quick run command (unit)** | `pnpm --filter @grapit/<app> test <pattern>` |
| **Quick run command (E2E)** | `pnpm --filter @grapit/web test:e2e` |
| **Full suite command** | `pnpm typecheck && pnpm lint && pnpm test` |
| **API build command** | `pnpm --filter @grapit/api build` (REVIEWS.md MED — React Email TSX 실 빌드) |
| **Web build command** | `pnpm --filter @grapit/web build` (REVIEWS.md MED — Turbopack raw-loader 실 빌드) |
| **E2E DB seed prerequisite** | `pnpm --filter @grapit/api seed` — Blocker B2 auth helper 가 admin@grapit.test 계정을 요구 |
| **Estimated runtime** | unit ~2-5s per pattern, full ~60s, E2E ~30-45s, builds ~30-60s each |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @grapit/<app> test <narrow-pattern>` (~2-5s)
- **After every plan wave:** Run `pnpm typecheck && pnpm lint && pnpm test` (full unit + typecheck + lint) + `pnpm --filter @grapit/<app> build` where applicable (REVIEWS.md MED)
- **Before `/gsd-verify-work`:** Full suite + `pnpm --filter @grapit/web test:e2e` green (E2E happy path PASS when `TOSS_CLIENT_KEY_TEST` set + DB seeded; skips otherwise)
- **Plan 2 half-way checkpoint (W2):** After Task 6 commit, executor verifies `pnpm --filter @grapit/api test && typecheck && build` green before starting Task 7.
- **Max feedback latency:** 60 seconds for per-task, 90 seconds for per-wave (180s if build is included)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 9-01-t0 | 01 | 1 | DEBT-04 | — | `formatDateTime` RED 테스트 (module 미존재 → fail) | unit TDD | `pnpm --filter @grapit/web test format-datetime` | W0 new | ⬜ pending |
| 9-01-t1 | 01 | 1 | DEBT-04 | — | `formatDateTime(null/undefined/invalid)` === "—" + valid → "YYYY.MM.DD HH:mm" | unit TDD GREEN | `pnpm --filter @grapit/web test format-datetime` | W0 | ⬜ pending |
| 9-01-t2 | 01 | 1 | DEBT-03 | — | Locked seat click → onSeatClick fires; sold seat click → blocked (회귀 없음) | unit | `pnpm --filter @grapit/web test seat-map-viewer` | ✅ existing (7/7 pass) | ⬜ pending |
| 9-01-t2 | 01 | 1 | DEBT-03 | — | sonner classNames.info 추가 + booking-page 인라인 style 2곳 제거 | static | `grep` assertions | ✅ | ⬜ pending |
| 9-01-t3 | 01 | 1 | DEBT-06 | — | `import { useShowtimes }` callsites = 0 | static | `test "$(grep -rn 'useShowtimes' apps/ \| wc -l \| tr -d ' ')" = "0"` | ✅ grep | ⬜ pending |
| 9-01-t3 | 01 | 1 | DEBT-06 | — | `booking-page` unit/integration green | integration | `pnpm --filter @grapit/web test booking-page` | existing | ⬜ pending |
| 9-02-t0 | 02 | 2 | DEBT-01 | T-09-04 | RED: EmailService module missing | unit TDD | `pnpm --filter @grapit/api test email.service` | W0 new | ⬜ pending |
| 9-02-t1 | 02 | 2 | DEBT-01 | — | resend + @react-email/components + react + raw-loader 설치, nodemailer 제거 | static | `grep` on package.json | ✅ | ⬜ pending |
| 9-02-t2 | 02 | 2 | DEBT-01 | — | tsconfig.json 에 JSX 설정 (REVIEWS.md MED + Blocker B6 — grep-only, typecheck 는 Task 3 로 이동) | static | `grep -q '"jsx":\s*"react-jsx"' apps/api/tsconfig.json && grep -q '"jsxImportSource":\s*"react"' apps/api/tsconfig.json` | ✅ | ⬜ pending |
| 9-02-t3 | 02 | 2 | DEBT-01 | T-09-04 | EmailService dev mode → console.log only, no Resend call | unit (mock resend) | `pnpm --filter @grapit/api test email.service` | W0 | ⬜ pending |
| 9-02-t3 | 02 | 2 | DEBT-01 | — | EmailService prod mode → Resend.emails.send called with React template | unit | 동일 | W0 | ⬜ pending |
| 9-02-t3 | 02 | 2 | DEBT-01 | T-09-04 | NODE_ENV=production + RESEND_API_KEY missing → throw on bootstrap | unit | 동일 | W0 | ⬜ pending |
| 9-02-t3 | 02 | 2 | DEBT-01 | T-09-11 (REVIEWS.md MED) | NODE_ENV=production + RESEND_FROM_EMAIL missing or invalid → throw on bootstrap | unit | 동일 | W0 | ⬜ pending |
| 9-02-t3 | 02 | 2 | DEBT-01 | — | API typecheck + build 성공 (Blocker B6 — Task 2 에서 이동, React Email TSX 번들링) | typecheck + build | `pnpm --filter @grapit/api typecheck && pnpm --filter @grapit/api build` | existing | ⬜ pending |
| 9-02-t4 | 02 | 2 | DEBT-01 | T-09-12 (REVIEWS.md MED) | main.ts bootstrap: NODE_ENV=production + FRONTEND_URL missing or non-https → process.exit(1) | unit (manual run) | grep + manual 3 runs | ✅ | ⬜ pending |
| 9-02-t5 | 02 | 2 | DEBT-01 | T-09-03, T-09-10 | `requestPasswordReset` silent return when user not found preserved | integration | `pnpm --filter @grapit/api test auth.service` | existing — extend in t6 | ⬜ pending |
| 9-02-t5 | 02 | 2 | DEBT-01 | T-09-10 (REVIEWS.md HIGH-04 + Blocker B5) | `/auth/password-reset/request` 와 `/confirm` 에 `@Throttle({ default: { limit: 3, ttl: 900000 } })` 적용 — v6 객체 시그니처, ms 단위 (not 900 seconds) | static | `grep -q 'ttl: 900000' apps/api/src/modules/auth/auth.controller.ts && grep -q 'limit: 3' apps/api/src/modules/auth/auth.controller.ts && test "$(grep -c '@Throttle' apps/api/src/modules/auth/auth.controller.ts \| tr -d ' ')" = "2"` | ✅ | ⬜ pending |
| 9-02-t6 | 02 | 2 | DEBT-01 | — | (REVIEWS.md HIGH-03) requestPasswordReset → EmailService spy → token 추출 → resetPassword 성공 → DB hash 변경 검증 | integration (mock EmailService + DB) | `pnpm --filter @grapit/api test auth.service` | W0 new | ⬜ pending |
| 9-02-t6 | 02 | 2 | DEBT-01 | T-09-18 (Blocker B4) | JwtService.signAsync + verifyAsync 가 secret = `jwtSecret + passwordHash` 로 호출됨이 spec 에서 assert + 동일 토큰 재사용은 UnauthorizedException (one-time token rotation) | integration | 동일 | W0 new | ⬜ pending |
| 9-02-t6 | 02 | 2 | DEBT-01 | T-09-13 | Unknown user 요청 시 EmailService 호출 안됨 (enumeration prevention) | integration | 동일 | W0 new | ⬜ pending |
| 9-02-t7 | 02 | 2 | DEBT-02 | — | 3 MD files 존재 + privacy-policy가 Resend/Twilio/Toss/R2 언급 | static | `grep -q "Resend\|Twilio\|토스페이먼츠\|Cloudflare R2" apps/web/content/legal/privacy-policy.md` | W0 new | ⬜ pending |
| 9-02-t7 | 02 | 2 | DEBT-02 | T-09-19 (Blocker B3) | privacy-policy.md 제6조 `개인정보의 국외이전` 섹션 + `제28조의8` 법조 인용 (Resend US + Twilio US 수탁자 표) | static | `grep -q "개인정보의 국외이전" apps/web/content/legal/privacy-policy.md && grep -q "제28조의8" apps/web/content/legal/privacy-policy.md` | W0 new | ⬜ pending |
| 9-02-t7 | 02 | 2 | DEBT-02 | — | (REVIEWS.md MED + Blocker B3) Legal accuracy checklist 파일 존재 + 국외이전 row 포함 | static | `test -f .planning/phases/09-tech-debt/09-02-LEGAL-ACCURACY-CHECKLIST.md && grep -q "국외이전" .planning/phases/09-tech-debt/09-02-LEGAL-ACCURACY-CHECKLIST.md` | ✅ | ⬜ pending |
| 9-02-t7 | 02 | 2 | DEBT-02 | — | Legal copy accuracy sign-off (수기 체크리스트 통과) | manual | 1인 개발자 proofreading + checklist 기재 | N/A — judgment | ⬜ pending |
| 9-02-t8 | 02 | 2 | DEBT-02 | — | next.config.ts 에 raw-loader 설정 (REVIEWS.md MED — 단일 접근법) | static + build | `grep` + `pnpm --filter @grapit/web build` | ✅ | ⬜ pending |
| 9-02-t9 | 02 | 2 | DEBT-02 | — | LegalDraftBanner `role="note"` + 문구 + TermsMarkdown react-markdown 매핑 | unit | 파일 grep + typecheck | ✅ | ⬜ pending |
| 9-02-t9 | 02 | 2 | DEBT-02 | — | (W5) LegalDraftBanner foreground/bg-warning-surface 대비 ≥ 4.5:1 (WCAG AA) — SUMMARY 에 측정값 기록 | manual | webaim contrastchecker + SUMMARY 기록 | N/A — judgment | ⬜ pending |
| 9-02-t10 | 02 | 2 | DEBT-02 | — | signup-step2 에서 TERMS_CONTENT 제거 + LEGAL_CONTENT/LegalDraftBanner/TermsMarkdown 사용 | static + typecheck | grep + typecheck | ✅ | ⬜ pending |
| 9-02-t11 | 02 | 2 | DEBT-01 | T-09-05 | `.env.example` + `deploy.yml` secrets 에 RESEND_API_KEY + RESEND_FROM_EMAIL | static | grep | ✅ | ⬜ pending |
| 9-03-t0 | 03 | 3 | DEBT-05 | T-09-13 (REVIEWS.md HIGH-01) | Happy path spec: widget mount assert + `expect(confirmIntercepted).toBe(true)` strict + `loginAsTestUser(page)` 호출 (Blocker B2) + SeatSelection shape (Blocker B1) | E2E (TDD RED 단계는 typecheck) | `pnpm --filter @grapit/web typecheck` → 추후 full run | W0 new | ⬜ pending |
| 9-03-t0 | 03 | 3 | DEBT-05 | T-09-20 (Blocker B2) | `apps/web/e2e/helpers/auth.ts` 존재 + loginAsTestUser export + page.request.post /api/v1/auth/login + TEST_USER_* fallback | static | `test -f apps/web/e2e/helpers/auth.ts && grep -q "loginAsTestUser" apps/web/e2e/helpers/auth.ts && grep -q "page.request.post" apps/web/e2e/helpers/auth.ts` | W0 new | ⬜ pending |
| 9-03-t0 | 03 | 3 | DEBT-05 | — (Blocker B1) | fixture/intercept seats shape = `{seatId, tierName, price, row, number}` NOT `{id, label, price, grade}` | static | `grep -q "seatId.*tierName" apps/web/e2e/toss-payment.spec.ts && ! grep -qE "grade:\s*'" apps/web/e2e/toss-payment.spec.ts && ! grep -qE "label:\s*'" apps/web/e2e/toss-payment.spec.ts` | W0 new | ⬜ pending |
| 9-03-t0 | 03 | 3 | DEBT-05 | — | PAY_PROCESS_CANCELED URL → UI regression 주석으로 "not DEBT-05 evidence" 명시 | E2E (URL simulation) | `grep -q "UI regression" apps/web/e2e/toss-payment.spec.ts` | W0 new | ⬜ pending |
| 9-03-t0 | 03 | 3 | DEBT-05 | — | fixture 파일 `apps/web/e2e/fixtures/booking-store.ts` 존재 + SeatSelection import | static | `test -f apps/web/e2e/fixtures/booking-store.ts && grep -q "SeatSelection" apps/web/e2e/fixtures/booking-store.ts` | W0 new | ⬜ pending |
| 9-03-t1 | 03 | 3 | DEBT-05 | T-09-11 | `.env.example` 에 TOSS_*_TEST 별칭 (공개 docs 키) + TEST_USER_* fallback 주석 (Blocker B2) | static | `grep -q "TOSS_CLIENT_KEY_TEST" .env.example && grep -q "TEST_USER_EMAIL" .env.example` | ✅ | ⬜ pending |
| 9-03-t2 | 03 | 3 | DEBT-05 | T-09-16 (REVIEWS.md HIGH-01 + Blocker B1) | booking store에 `__BOOKING_FIXTURE__` hook + production build tree-shake + seats: SeatSelection[] 타입 | static + build | `grep -q "__BOOKING_FIXTURE__" apps/web/stores/use-booking-store.ts && grep -q "SeatSelection\[\]" apps/web/stores/use-booking-store.ts && pnpm --filter @grapit/web build` | W0 new | ⬜ pending |
| 9-03-t3 | 03 | 3 | DEBT-05 | — | playwright.config.ts webServer.env 에 NEXT_PUBLIC_TOSS_CLIENT_KEY 전달 | static | grep | ✅ | ⬜ pending |
| 9-03-t4 | 03 | 3 | DEBT-05 | T-09-17 (REVIEWS.md HIGH-02) | ci.yml verify-toss-secrets step (push/schedule/dispatch/same-repo PR 에서 exit 1) + TEST_USER_* env (Blocker B2) | integration (workflow syntax) | `grep -q "Verify Toss test secrets present" .github/workflows/ci.yml && grep -q "TEST_USER_EMAIL" .github/workflows/ci.yml` | W0 new | ⬜ pending |
| 9-03-t4 | 03 | 3 | DEBT-05 | T-09-11 | deploy.yml 에 TOSS_*_TEST 절대 없음 (D-13 격리) | static | `test "$(grep -c 'TOSS_CLIENT_KEY_TEST\|TOSS_SECRET_KEY_TEST' .github/workflows/deploy.yml \| tr -d ' ')" = "0"` | ✅ | ⬜ pending |
| 9-03-t5 | 03 | 3 | DEBT-05 | — (W1) | (REVIEWS.md HIGH-01 GREEN 확인) E2E full run 에서 happy path + cancel + decline 3/3 PASS + 09-03-SUMMARY.md 작성 | E2E full | `pnpm --filter @grapit/web test:e2e toss-payment` (키 설정 + DB seeded) | — | ⬜ pending |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

**Plan 1 (Quick Cleanup):**
- [ ] `apps/web/lib/format-datetime.test.ts` — null/undefined/valid/invalid 4 cases (new)

**Plan 2 (Terms + Email):**
- [ ] `apps/api/src/modules/auth/email/email.service.spec.ts` — 6-branch tests (dev / prod-real / prod-misconfig-API_KEY / prod-misconfig-FROM_EMAIL-unset / prod-misconfig-FROM_EMAIL-invalid / prod-SDK-error) — **REVIEWS.md MED 반영 — RESEND_FROM_EMAIL hard-fail 2 tests 추가**
- [ ] `apps/api/src/modules/auth/auth.service.spec.ts` — extended with `password reset flow integration` describe block containing:
  - (HIGH-03) EmailService spy → resetPassword → DB hash change
  - (Blocker B4) JwtService.signAsync/verifyAsync secret argument assert
  - (Blocker B4) one-time token reuse rejection test (secret rotation)
  - (T-09-13) enumeration-prevention test
- [ ] `.planning/phases/09-tech-debt/09-02-LEGAL-ACCURACY-CHECKLIST.md` — manual checklist with 국외이전 row (REVIEWS.md MED + Blocker B3)

**Plan 3 (Toss E2E):**
- [ ] `apps/web/e2e/toss-payment.spec.ts` — happy path (widget mount + strict confirmIntercepted + loginAsTestUser + SeatSelection shape) + cancel + decline + env-gated skip (new; REVIEWS.md HIGH-01 + Blocker B1+B2)
- [ ] `apps/web/e2e/fixtures/booking-store.ts` — `injectBookingFixture` helper with `seats: SeatSelection[]` (new; Blocker B1)
- [ ] `apps/web/e2e/helpers/auth.ts` — `loginAsTestUser` helper (new; Blocker B2)
- [ ] `apps/web/stores/use-booking-store.ts` — dev/test only fixture hook with SeatSelection[] typing (new addition; Blocker B1)
- [ ] `apps/web/playwright.config.ts` — `webServer.env.NEXT_PUBLIC_TOSS_CLIENT_KEY` 추가
- [ ] `.github/workflows/ci.yml` — (a) `verify-toss-secrets` gate step (REVIEWS.md HIGH-02) + (b) `pnpm --filter @grapit/web test:e2e` step + (c) TEST_USER_* env injection (Blocker B2)
- [ ] `.planning/phases/09-tech-debt/09-03-SUMMARY.md` — Task 5 deliverable (W1)

**Framework install requirements:** 없음 — vitest + Playwright 모두 이미 설치됨. raw-loader만 Plan 02 Task 1 에서 추가 설치.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Legal copy (terms-of-service / privacy-policy / marketing-consent) 내용 검수 + accuracy checklist sign-off (국외이전 row 포함) | DEBT-02 + Blocker B3 | KOPICO 표준 템플릿 각색 — 오탈자/법적 완결성은 자동 검증 불가, 1인 개발자 판단 필요 (REVIEWS.md MED) | Dialog 오픈 → 본문 읽기 → LegalDraftBanner 확인 → `09-02-LEGAL-ACCURACY-CHECKLIST.md` 의 모든 row (국외이전 row 포함) 에 체크 + sign-off |
| LegalDraftBanner 색상 대비 WCAG AA ≥ 4.5:1 측정 (W5) | DEBT-02 | 시각적/색상 계산은 automation 하기보다 webaim contrastchecker 로 1회 측정 후 SUMMARY 기록이 더 간단 | https://webaim.org/resources/contrastchecker/ 에서 foreground(`#8B6306` 또는 변경 후 값) + background(bg-warning-surface 실 hex) 입력 → 대비 ≥ 4.5:1 확인 → SUMMARY 에 실측값 기록 |
| Resend dashboard 에서 `grapit.com` DKIM/SPF 검증 + RESEND_FROM_EMAIL 이 검증된 sender | DEBT-01 (REVIEWS.md MED) | 외부 계정 작업, CI로 검증 불가. production hard-fail 은 값 설정 여부만 검사 — 실 deliverability 는 manual 확인 필수 | Resend 대시보드 → Domains → `grapit.com` 상태 = Verified 확인. `RESEND_FROM_EMAIL` 이 이 도메인의 주소인지 확인 |
| 실 Resend 이메일 발송 + inbox 에서 reset link 클릭 → 비밀번호 변경 end-to-end | DEBT-01 roadmap success criterion 1 | 실 외부 메일 송수신 + 메일 클라이언트 동작 판단 — CI로 자동화 불가 (REVIEWS.md HIGH-03 integration test + Blocker B4 one-time token test 로 **코드 경로**만 자동 커버) | 프로덕션 or staging 환경에서: 실 이메일로 `/auth/reset-password` 요청 → Resend 발송 → 수신 확인 → 링크 클릭 → 새 비밀번호 입력 → 로그인 성공 |
| `NODE_ENV=production pnpm --filter @grapit/api start` 3가지 scenario | DEBT-01 (REVIEWS.md MED FRONTEND_URL) | bootstrap `process.exit(1)` 은 unit test로 안전하게 검증 어려움 | 3 manual runs:<br>(a) `FRONTEND_URL=http://insecure.com NODE_ENV=production pnpm start` → exit 1<br>(b) `NODE_ENV=production pnpm start` (FRONTEND_URL unset) → exit 1<br>(c) `FRONTEND_URL=https://grapit.com NODE_ENV=production pnpm start` → 정상 기동 |
| Password reset rate limit 동작 확인 (v6 ms 단위) | DEBT-01 (REVIEWS.md HIGH-04 + Blocker B5) | 실 HTTP 요청 + 15분 TTL — CI에서 timing 기반 테스트는 flaky. Blocker B5: `ttl: 900000` 이 ms 인지 (15분) vs 초 (1.5분이었으면 bug) 확인 필수 | dev server 기동 → `for i in 1 2 3 4; do curl -X POST http://localhost:8080/api/v1/auth/password-reset/request -H "Content-Type: application/json" -d '{"email":"test@test.com"}'; done` → 4번째 호출이 429. 그 다음 1.5초 만에 다시 시도해도 여전히 429 (ms 단위 검증) |
| Plan 3 E2E 실행 전 DB seed (Blocker B2) | DEBT-05 | auth helper `loginAsTestUser` 가 admin@grapit.test 계정을 요구하므로 로컬 DB 가 seed 되어야 green | `pnpm --filter @grapit/api seed` 1회 실행 → `SELECT email FROM users WHERE email='admin@grapit.test'` 존재 확인 |
| 프로덕션 Cloud Run 에 `TOSS_CLIENT_KEY_TEST`/`TOSS_SECRET_KEY_TEST`가 **주입되지 않았음** 확인 | DEBT-05 (D-13 격리, T-09-11) | GCP console 상태, 자동 테스트 불가 | `gcloud run services describe grapit-api --region=asia-northeast3 --format="value(spec.template.spec.containers[0].env[].name)" \| grep -E "TOSS_.*_TEST" \|\| echo "OK: no test keys in prod"` → "OK" 출력 |
| CI secrets gate drill (optional) | DEBT-05 (REVIEWS.md HIGH-02) | gate 자체가 실제로 fail하는지 production-grade 확인 | 1회 drill: GitHub UI 에서 `TOSS_CLIENT_KEY_TEST` secret 일시 제거 → empty commit push → `verify-toss-secrets` step fail 확인 → secret 재등록 |
| 법률 검토 배너가 production 배포 후에도 표시 | DEBT-02 | 배너 제거는 법률 검토 완료 시점에만 가능 | 프로덕션에서 /signup → 약관 Dialog → 배너 텍스트 렌더 확인 |
| Playwright E2E happy path 스크린샷 검증 | DEBT-05 (REVIEWS.md HIGH-01 + Blocker B1/B2) | widget iframe 렌더링 정상 여부를 시각적으로 최종 확인 | `pnpm --filter @grapit/web test:e2e toss-payment` 실행 후 `apps/web/playwright-report/index.html` 열기 → Scenario 1 trace 에서 widget iframe visible + 결제 완료 메시지 렌더 확인. loginAsTestUser 가 /complete 로의 redirect 없이 confirm API intercept 성공했는지 확인. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies mapped above
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (typecheck + existing suites cover gaps)
- [ ] Wave 0 covers all W0 references in the Per-Task Verification Map
- [ ] No watch-mode flags (`--watch`, `--ui` 금지 — CI friendly만)
- [ ] Feedback latency < 60s for per-task, < 90s for per-wave (< 180s with builds)
- [ ] All expected-absence verify patterns use `! grep -q` or `test "$(grep -c ... | tr -d ' ')" = "0"` — no `grep -c ... && ...` chaining (REVIEWS.md MED)
- [ ] `nyquist_compliant: true` set once planner inserts concrete task IDs and all W0 items are created — **set** (revised for reviews + revision-2)
- [ ] REVIEWS.md HIGH-01 closure: Plan 3 happy path widget mount + strict `expect(confirmIntercepted).toBe(true)`
- [ ] REVIEWS.md HIGH-02 closure: ci.yml `verify-toss-secrets` step with fork 분기
- [ ] REVIEWS.md HIGH-03 closure: auth.service.spec integration test for password reset flow
- [ ] REVIEWS.md HIGH-04 closure: @Throttle on both password-reset endpoints
- [ ] **Revision-2 Blocker B1 closure:** fixture / intercept / store hook 에서 `seats` shape 이 `SeatSelection { seatId, tierName, price, row, number, tierColor? }` 로 통일 — `{ id, label, price, grade }` 는 0건
- [ ] **Revision-2 Blocker B2 closure:** `apps/web/e2e/helpers/auth.ts` 의 `loginAsTestUser` 가 Plan 3 happy path 첫 줄에서 호출 + CI `ci.yml` 에서 TEST_USER_EMAIL/PASSWORD env 주입 + `.env.example` 에 fallback 주석
- [ ] **Revision-2 Blocker B3 closure:** privacy-policy.md 제6조 "개인정보의 국외이전" 섹션 + "제28조의8" 법조 인용 + Resend/Twilio US 수탁자 표 + accuracy checklist 국외이전 row 존재
- [ ] **Revision-2 Blocker B4 closure:** auth.service.spec Blocker B4 block 에 signAsync + verifyAsync secret arg assertion + 동일 토큰 reuse 시 UnauthorizedException 테스트 추가
- [ ] **Revision-2 Blocker B5 closure:** `apps/api/src/modules/auth/auth.controller.ts` 에 `@Throttle({ default: { limit: 3, ttl: 900000 } })` — v6 객체 시그니처, ms 단위. v5 fallback (`@Throttle(3, 900)`) 0건.
- [ ] **Revision-2 Blocker B6 closure:** Plan 2 Task 2 verify 는 grep-only (tsconfig JSX 키 2개). typecheck + build 는 Task 3 으로 이동하여 EmailService GREEN 이후 실행.
- [ ] **W1 closure:** Plan 3 Task 5 가 `.planning/phases/09-tech-debt/09-03-SUMMARY.md` 를 deliverable 로 명시하여 `<files>` 가 더 이상 공란이 아님.
- [ ] **W5 closure:** LegalDraftBanner foreground/bg-warning-surface 대비 ≥ 4.5:1 webaim 측정값이 SUMMARY 에 기록됨 (또는 디자인 토큰 `text-warning-foreground` 사용으로 설계상 충족).

**Approval:** pending (set to `approved YYYY-MM-DD` after `/gsd-verify-work` passes revision-2 blocker checks)
