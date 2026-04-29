---
phase: 18-password-reset-production-api-origin-fix
fixed_at: "2026-04-29T06:05:18Z"
review_path: .planning/phases/18-password-reset-production-api-origin-fix/18-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 18: Code Review Fix Report

**Fixed at:** 2026-04-29T06:05:18Z
**Source review:** `.planning/phases/18-password-reset-production-api-origin-fix/18-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: workflow_run 배포가 CI가 검증한 commit이 아닌 코드를 배포할 수 있음

**Status:** fixed
**Files modified:** `.github/workflows/deploy.yml`
**Commit:** d339444
**Applied fix:** Added `DEPLOY_SHA` from `github.event.workflow_run.head_sha`, checked out that ref in both deploy jobs, and used the same SHA for API/Web image build, push, and deploy references.

### CR-02: production origin 검증이 API 배포 후에만 일부 값에 적용됨

**Status:** fixed
**Files modified:** `.github/workflows/deploy.yml`
**Commit:** 5fa1e82
**Applied fix:** Added an early `Validate production origins` gate before API deployment work and validated both `CLOUD_RUN_API_URL` and `CLOUD_RUN_WEB_URL` as trimmed HTTPS non-localhost absolute URLs. Removed the narrower web-only validation step.

### CR-03: password reset request가 enumeration 방지 의도와 달리 API 에러 toast를 노출함

**Status:** fixed
**Files modified:** `apps/web/app/auth/reset-password/page.tsx`, `apps/web/app/auth/reset-password/__tests__/reset-password.test.tsx`
**Commit:** 7e0483d
**Applied fix:** Switched password reset request mode from `apiClient.post()` to direct `fetch(apiUrl(...))` and added a regression test proving API failure responses still show the success state without calling `toast.error` or `apiClient.post`.

### WR-01: token query가 바뀌어도 form state의 reset token이 갱신되지 않음

**Status:** fixed: requires human verification
**Files modified:** `apps/web/app/auth/reset-password/page.tsx`, `apps/web/app/auth/reset-password/__tests__/reset-password.test.tsx`
**Commit:** a25a641
**Applied fix:** Keyed `ConfirmView` by token so client-side token query changes remount the form with the current token. Added a regression test that rerenders with a new token query and verifies submit uses the latest token.

### WR-02: apiClient public API가 leading slash를 타입으로 강제하지 않아 malformed URL을 만들 수 있음

**Status:** fixed
**Files modified:** `apps/web/lib/api-client.ts`
**Commit:** 3edd27d
**Applied fix:** Added an `ApiPath = \`/${string}\`` type, used it for the internal request path and exported `apiClient` method parameters, and removed unsafe casts before calling `apiUrl()`.

---

_Fixed: 2026-04-29T06:05:18Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
