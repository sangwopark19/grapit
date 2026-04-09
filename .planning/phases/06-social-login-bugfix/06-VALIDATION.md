---
phase: 6
slug: social-login-bugfix
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-09
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (API), Playwright 1.x (Web E2E) |
| **Config file** | `apps/api/vitest.config.ts`, `apps/web/playwright.config.ts` |
| **Quick run command** | `pnpm --filter @grapit/api exec vitest run src/modules/auth` |
| **Full suite command** | `pnpm --filter @grapit/api exec vitest run src/modules/auth && pnpm --filter @grapit/web exec playwright test e2e/social-login.spec.ts` |
| **Estimated runtime** | ~2 seconds (unit), ~15 seconds (E2E) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @grapit/api exec vitest run src/modules/auth`
- **After every plan wave:** Run full suite (unit + E2E)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds (unit)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | callbackURL /social/ 포함 | T-06-01 | callbackURL이 컨트롤러 라우트와 일치 | unit | `vitest run src/modules/auth/strategies` | ✅ | ✅ green |
| 06-01-02 | 01 | 1 | Guard OAuth 에러→redirect | T-06-04 | 에러 시 FRONTEND_URL로만 redirect | unit | `vitest run src/modules/auth/guards` | ✅ | ✅ green |
| 06-01-03 | 01 | 1 | sameSite: lax 쿠키 | T-06-03 | httpOnly+lax로 CSRF 방어 유지 | unit | `vitest run src/modules/auth/auth.controller.spec.ts` | ✅ | ✅ green |
| 06-01-04 | 01 | 1 | handleSocialCallback null user 체크 | T-06-04 | Guard redirect 후 null user 안전 처리 | unit | `vitest run src/modules/auth/auth.controller.spec.ts` | ✅ | ✅ green |
| 06-01-05 | 01 | 1 | handleSocialCallback try-catch→server_error | T-06-05 | 내부 에러를 generic code로만 노출 | unit | `vitest run src/modules/auth/auth.controller.spec.ts` | ✅ | ✅ green |
| 06-01-06 | 01 | 1 | 프론트엔드 callback 에러 UI | — | N/A | e2e | `playwright test e2e/social-login.spec.ts` | ✅ | ✅ green |
| 06-01-07 | 01 | 1 | 프론트엔드 login 에러 표시 | — | N/A | e2e | `playwright test e2e/social-login.spec.ts` | ✅ | ✅ green |
| 06-02-01 | 02 | 2 | E2E 테스트 인프라 | — | N/A | config | playwright.config.ts 존재 | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 3 provider 재로그인 (카카오/네이버/구글) | AUTH-01 | OAuth provider 로그인 페이지의 봇 감지(CAPTCHA, 2FA)로 자동화 불가 | 1. pnpm dev 실행 2. 소셜 로그인 → 가입 → 로그아웃 → 재로그인 성공 확인 |
| 구조화된 NestJS 로깅 | AUTH-01 | 로깅은 구현 상세이며 side effect 검증은 과도한 coupling | API 콘솔에서 "Social callback: provider=" 로그 출력 확인 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 2s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-09

---

## Validation Audit 2026-04-09

| Metric | Count |
|--------|-------|
| Gaps found | 4 |
| Resolved (automated) | 3 |
| Escalated (manual-only) | 1 |

**Tests added:** `apps/api/src/modules/auth/auth.controller.spec.ts` (12 tests)
**Total auth tests:** 48 (6 files, all green)
