---
phase: quick-260409-os1
plan: 01
status: completed
---

# Quick Task 260409-os1: 프로덕션 소셜로그인 쿠키 SameSite 버그 수정

## Root Cause

프로덕션 Cloud Run 환경에서 API(`grapit-api-*.run.app`)와 Web(`grapit-web-*.run.app`)이 서로 다른 도메인(cross-site)으로 동작.
`run.app`는 Public Suffix List에 등재되어 있어 두 서비스는 cross-site로 취급됨.

`setRefreshTokenCookie`에서 `sameSite: 'lax'`로 설정된 쿠키는 cross-site POST fetch 요청(`/auth/refresh`)에서 브라우저가 전송하지 않아 401 발생.

## Changes

| File | Change |
|------|--------|
| `apps/api/src/modules/auth/auth.controller.ts` | `sameSite: 'lax'` → `'none'`, `secure` 무조건 `true`, `clearCookie`에도 동일 옵션 |
| `apps/api/src/modules/auth/auth.controller.spec.ts` | 기존 테스트 기대값 업데이트 + logout clearCookie 테스트 추가 |

## Commit

- `21eb3d6` fix(quick-260409-os1): SameSite=None + Secure=true for cross-site Cloud Run cookie

## Verification

- All auth.controller.spec.ts tests pass
- Full API test suite pass
- TypeScript typecheck pass
