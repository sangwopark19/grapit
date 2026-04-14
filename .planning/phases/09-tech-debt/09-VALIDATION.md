---
phase: 9
slug: tech-debt
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. See `09-RESEARCH.md` §Validation Architecture for the source-of-truth mapping.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.0 (unit/integration) + Playwright 1.59.1 (E2E) |
| **Config file** | `apps/api/vitest.config.ts`, `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts` |
| **Quick run command (unit)** | `pnpm --filter @grapit/<app> test <pattern>` |
| **Quick run command (E2E)** | `pnpm --filter @grapit/web test:e2e` |
| **Full suite command** | `pnpm typecheck && pnpm lint && pnpm test` |
| **Estimated runtime** | unit ~2-5s per pattern, full ~60s, E2E ~30-45s |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @grapit/<app> test <narrow-pattern>` (~2-5s)
- **After every plan wave:** Run `pnpm typecheck && pnpm lint && pnpm test` (full unit + typecheck + lint)
- **Before `/gsd-verify-work`:** Full suite + `pnpm --filter @grapit/web test:e2e` green (E2E skips when `TOSS_CLIENT_KEY_TEST` unset)
- **Max feedback latency:** 60 seconds for per-task, 90 seconds for per-wave

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 9-01-* | 01 | 1 | DEBT-03 | — | Locked seat click → onSeatClick fires; sold seat click → blocked | unit | `pnpm --filter @grapit/web test seat-map-viewer` | ✅ existing (7/7 pass) | ⬜ pending |
| 9-01-* | 01 | 1 | DEBT-03 | — | Locked seat parent toast renders info-level | unit | `pnpm --filter @grapit/web test booking-page` | ❌ W0 (optional) | ⬜ pending |
| 9-01-* | 01 | 1 | DEBT-04 | — | `formatDateTime(null/undefined)` === "—" | unit | `pnpm --filter @grapit/web test format-datetime` | ❌ W0 (new) | ⬜ pending |
| 9-01-* | 01 | 1 | DEBT-04 | — | `formatDateTime('2026-...')` ≠ "—" | unit | 동일 | ❌ W0 | ⬜ pending |
| 9-01-* | 01 | 1 | DEBT-04 | — | `tsc --noEmit` 0 errors | typecheck | `pnpm typecheck` | ✅ root script | ⬜ pending |
| 9-01-* | 01 | 1 | DEBT-06 | — | `import { useShowtimes }` callsites = 0 | static | `grep -r "useShowtimes" apps/ \| wc -l` → 0 | ✅ grep | ⬜ pending |
| 9-01-* | 01 | 1 | DEBT-06 | — | `booking-page` unit/integration green | integration | `pnpm --filter @grapit/web test booking-page` | (existing) | ⬜ pending |
| 9-02-* | 02 | 2 | DEBT-01 | T-V7-enum | EmailService dev mode → console.log only, no Resend call | unit (mock resend) | `pnpm --filter @grapit/api test email.service` | ❌ W0 (new) | ⬜ pending |
| 9-02-* | 02 | 2 | DEBT-01 | — | EmailService prod mode → Resend.emails.send called with React template | unit (mock resend) | 동일 | ❌ W0 | ⬜ pending |
| 9-02-* | 02 | 2 | DEBT-01 | T-V14-misconfig | NODE_ENV=production + RESEND_API_KEY missing → throw on bootstrap | unit | 동일 | ❌ W0 | ⬜ pending |
| 9-02-* | 02 | 2 | DEBT-01 | T-V7-enum | `requestPasswordReset` silent return when user not found preserved | integration (mock EmailService) | `pnpm --filter @grapit/api test auth.service` | (existing — extend) | ⬜ pending |
| 9-02-* | 02 | 2 | DEBT-02 | — | Dialog opens → LegalDraftBanner + MD body rendered | unit (@testing-library/react) | `pnpm --filter @grapit/web test signup-step2` | ❌ W0 (new, optional if E2E covers) | ⬜ pending |
| 9-02-* | 02 | 2 | DEBT-02 | — | LegalDraftBanner `role="note"` + 문구 표시 | unit | 동일 | ❌ W0 | ⬜ pending |
| 9-02-* | 02 | 2 | DEBT-02 | — | Legal copy accuracy (오탈자, 법적 완결성) | manual | 1인 개발자 proofreading | N/A — judgment | ⬜ pending |
| 9-03-* | 03 | 3 | DEBT-05 | T-V14-leak | Toss happy path: 위젯 마운트 → 테스트카드 → 승인 → success URL | E2E | `pnpm --filter @grapit/web test:e2e toss-payment` | ❌ W0 (new) | ⬜ pending |
| 9-03-* | 03 | 3 | DEBT-05 | — | PAY_PROCESS_CANCELED → error toast 렌더 | E2E (URL simulation) | 동일 | ❌ W0 | ⬜ pending |
| 9-03-* | 03 | 3 | DEBT-05 | — | 카드 승인 거절 → error toast 렌더 | E2E (URL simulation) | 동일 | ❌ W0 | ⬜ pending |
| 9-03-* | 03 | 3 | DEBT-05 | T-V14-leak | env 미설정 시 test.skip (exit 0) | E2E (skip log) | 동일 | ❌ W0 | ⬜ pending |
| 9-03-* | 03 | 3 | DEBT-05 | — | CI workflow에 E2E step 추가 + TOSS_CLIENT_KEY_TEST/SECRET_KEY_TEST secrets 주입 | integration (workflow syntax) | `act -j e2e --dry-run` or manual PR | ❌ W0 | ⬜ pending |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs use wildcard `*` until planner assigns concrete numbering in PLAN.md frontmatter. This map binds to plan numbers 01/02/03 per D-21.*

---

## Wave 0 Requirements

**Plan 1 (Quick Cleanup):**
- [ ] `apps/web/lib/format-datetime.test.ts` — null/undefined/valid 3 cases (new)
- [ ] (optional) `apps/web/components/booking/__tests__/booking-page.test.tsx` — parent toast assertion for locked seat flow

**Plan 2 (Terms + Email):**
- [ ] `apps/api/src/modules/auth/email/email.service.spec.ts` — 3-branch tests (dev mock / prod real / prod-misconfig throw) (new)
- [ ] (optional) `apps/web/components/auth/__tests__/signup-step2.test.tsx` — Dialog banner + MD body render (can be covered by E2E)

**Plan 3 (Toss E2E):**
- [ ] `apps/web/e2e/toss-payment.spec.ts` — happy path + cancel + decline + env-gated skip (new; follow §Pattern 6 in RESEARCH.md)
- [ ] `.github/workflows/ci.yml` — add `pnpm --filter @grapit/web test:e2e` step, gated on `TOSS_CLIENT_KEY_TEST` secret

**Framework install requirements:** 없음 — vitest + Playwright 모두 이미 설치됨 (RESEARCH §Environment Availability 확인).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Legal copy (terms-of-service / privacy-policy / marketing-consent) 내용 검수 | DEBT-02 | KOPICO 표준 템플릿 각색 — 오탈자/법적 완결성은 자동 검증 불가, 1인 개발자 판단 필요 | Dialog 오픈 → 본문 처음~끝까지 읽기 → LegalDraftBanner 문구 확인 → 마크업된 페이지 스타일 확인 |
| Resend dashboard에서 `grapit.com` DKIM/SPF 검증 | DEBT-01 | 외부 계정 작업, CI로 검증 불가 | Resend 대시보드 → Domains → `grapit.com` 상태 = Verified 확인. 프로덕션 배포 전 필수. 미완료 시 `onboarding@resend.dev` from으로 잠정 운영 가능 |
| 프로덕션 Cloud Run에 `TOSS_CLIENT_KEY_TEST`/`TOSS_SECRET_KEY_TEST`가 **주입되지 않았음** 확인 | DEBT-05 (D-13 격리) | GCP console 상태, 자동 테스트 불가 | `gcloud run services describe api --region=asia-northeast3 --format="value(spec.template.spec.containers[0].env[].name)"` → 테스트 키 이름이 목록에 없어야 함 |
| 법률 검토 배너가 production 배포 후에도 표시되는지 육안 확인 | DEBT-02 | 배너 제거는 법률 검토 완료 시점에만 가능, 자동 제거 방지용 guard | 프로덕션에서 /signup → 약관 Dialog → 배너 텍스트 렌더 확인 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies mapped above
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (typecheck + existing suites cover gaps)
- [ ] Wave 0 covers all W0 references in the Per-Task Verification Map
- [ ] No watch-mode flags (`--watch`, `--ui` 금지 — CI friendly만)
- [ ] Feedback latency < 60s for per-task, < 90s for per-wave
- [ ] `nyquist_compliant: true` set in frontmatter once planner inserts concrete task IDs and all W0 items are created

**Approval:** pending (set to `approved YYYY-MM-DD` after `/gsd-verify-work` passes)
