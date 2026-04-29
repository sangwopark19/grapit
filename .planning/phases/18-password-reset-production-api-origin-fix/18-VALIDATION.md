---
phase: 18
slug: password-reset-production-api-origin-fix
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-29
---

# Phase 18 - Validation Strategy

> Per-phase validation contract for password reset production API origin fixes.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.x |
| **Config file** | `apps/web/vitest.config.ts`, `apps/api/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @grabit/web test -- lib/__tests__/api-url.test.ts app/auth/reset-password/__tests__/reset-password.test.tsx` |
| **Full suite command** | `pnpm --filter @grabit/web typecheck && pnpm --filter @grabit/web test && pnpm --filter @grabit/api test -- src/modules/auth/auth.service.spec.ts src/modules/auth/email/email.service.spec.ts` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run the focused command for files touched by that task.
- **After every plan wave:** Run `pnpm --filter @grabit/web typecheck && pnpm --filter @grabit/web test`.
- **Before `$gsd-verify-work`:** Run the full suite command and complete `18-HUMAN-UAT.md`.
- **Max feedback latency:** 120 seconds for automated checks.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | DEBT-01 | T-18-01 | `apiUrl('/api/v1/auth/password-reset/confirm')` returns an absolute public API URL when `NEXT_PUBLIC_API_URL` is set. | unit | `pnpm --filter @grabit/web test -- lib/__tests__/api-url.test.ts` | Missing W0 | pending |
| 18-01-02 | 01 | 1 | DEBT-01 | T-18-01 | reset confirm submit calls `${NEXT_PUBLIC_API_URL}/api/v1/auth/password-reset/confirm`, not relative `/api/v1/auth/password-reset/confirm`. | component | `pnpm --filter @grabit/web test -- app/auth/reset-password/__tests__/reset-password.test.tsx` | Existing | pending |
| 18-01-03 | 01 | 1 | DEBT-01 | T-18-02 | production `next.config.ts` rewrites return no `localhost:8080` destination. | unit/static config | `pnpm --filter @grabit/web test -- lib/__tests__/next-config.test.ts` | Missing W0 | pending |
| 18-02-01 | 02 | 2 | CUTOVER-01..06 | T-18-03 | production password reset request -> email -> confirm -> login path records public API origin and successful login evidence. | manual UAT | `test -f .planning/phases/18-password-reset-production-api-origin-fix/18-HUMAN-UAT.md && rg -n "api.heygrabit.com|password reset|login success" .planning/phases/18-password-reset-production-api-origin-fix/18-HUMAN-UAT.md` | Missing W0 | pending |
| 18-02-02 | 02 | 2 | CUTOVER-06 | T-18-04 | existing backend reset-token and email regression tests stay green. | unit | `pnpm --filter @grabit/api test -- src/modules/auth/auth.service.spec.ts src/modules/auth/email/email.service.spec.ts` | Existing | pending |

---

## Wave 0 Requirements

- [ ] `apps/web/lib/api-url.ts` - shared public API origin helper.
- [ ] `apps/web/lib/__tests__/api-url.test.ts` - local/preview/production API URL contract tests.
- [ ] `apps/web/lib/__tests__/next-config.test.ts` - production rewrite guard test.
- [ ] `apps/web/app/auth/reset-password/__tests__/reset-password.test.tsx` - exact confirm submit URL assertion.
- [ ] `.planning/phases/18-password-reset-production-api-origin-fix/18-HUMAN-UAT.md` - production smoke evidence shell.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `heygrabit.com` password reset email reaches a registered password-based user inbox, link opens, confirm submit posts to `https://api.heygrabit.com/api/v1/auth/password-reset/confirm`, and the new password logs in successfully. | CUTOVER-01..06 | Requires live production Cloud Run, real mailbox, and operator account access. | Use a known password-based production account. Request reset from `https://heygrabit.com/auth/reset-password`, open the email link, change password, verify browser network request host is `api.heygrabit.com`, then login with the new password. Record timestamp, account domain, request host, Cloud Run/API log notes, and result in `18-HUMAN-UAT.md`. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies.
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify.
- [ ] Wave 0 covers all missing references.
- [ ] No watch-mode flags.
- [ ] Feedback latency < 120s.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending
