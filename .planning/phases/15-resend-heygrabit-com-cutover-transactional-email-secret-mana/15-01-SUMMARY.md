---
phase: 15
plan: 01
status: complete
completed: 2026-04-27
commits:
  - f792ae4 feat(15-01): add Sentry.captureException to email.service Resend error branch
  - 9cf784b test(15-01): add @sentry/nestjs mock + Sentry assertion tests
requirements: [CUTOVER-04, CUTOVER-06]
---

# Plan 15-01 Summary — email.service.ts Sentry 통합

## What was built

`email.service.ts` 의 Resend error branch (`if (error)`) 안에 `Sentry.withScope` + `Sentry.captureException` 호출을 삽입했다. 기존 `this.logger.error` + `return { success: false, ... }` 흐름은 변경 없이 유지하고, Sentry 호출만 두 줄 사이에 끼워 넣었다.

PII masking — `scope.setContext('email', { from, toDomain })` — 으로 full email address 대신 도메인만 Sentry로 전송. tag: `component=email-service`, `provider=resend`, level=`error`. captureException 인자는 `new Error('Resend send failed: ' + error.message)` 로 wrap 하여 stack trace 보존.

`auth.service.ts` 는 변경 없음 (D-12, enumeration 방어 fire-and-forget 구조 유지).

## Tests

`email.service.spec.ts` 에 `@sentry/nestjs` 전역 mock 추가 + 신규 2 테스트 (Test 7: Error wrapping 검증, Test 8: PII masking 검증). 기존 6 테스트는 회귀 없이 green, DEV/SUCCESS 경로에 `__captureExceptionMock` not-called 어설션을 추가하여 회귀 방어.

- email.service.spec: 8/8 ✅ (기존 6 + 신규 2)
- 전체 suite: 307/307 ✅ (이전 305 + 2)
- typecheck: ✅
- lint: ✅

## key-files.created

[]

## key-files.modified

- apps/api/src/modules/auth/email/email.service.ts (12 insertions)
- apps/api/src/modules/auth/email/email.service.spec.ts (76 insertions)

## Deviations

없음. 플랜 그대로 실행.

## Self-Check: PASSED

- Acceptance criteria all green:
  - import * as Sentry from '@sentry/nestjs' (1 line)
  - Sentry.withScope (1 line)
  - Sentry.captureException(new Error (1 line)
  - scope.setTag('component', 'email-service') (1 line)
  - scope.setTag('provider', 'resend') (1 line)
  - toDomain: (1 line)
  - No new try/catch in diff (REVIEWS L1)
  - git diff auth.service.ts empty (D-12)
  - vi.mock('@sentry/nestjs' (1 occurrence)
  - __captureExceptionMock (6 occurrences ≥ 4)
  - toDomain: 'example.com' (1 occurrence)
  - typecheck/lint clean

## Next

Plan 15-01 코드는 main merge 시 `.github/workflows/deploy.yml` 이 자동으로 Cloud Run `grabit-api` 신규 revision 을 빌드/배포한다. Plan 15-03 Task 0 의 pre-gate (REVIEWS HIGH H1) 가 이 신규 revision 의 image digest 를 검증한다.

Wave 1 의 Plan 15-02 (Resend 도메인 등록 + DNS) 는 본 plan 과 독립적으로 병행 진행 가능 (D-08 sequence invariant 는 Plan 02 → Plan 03 만 강제).
