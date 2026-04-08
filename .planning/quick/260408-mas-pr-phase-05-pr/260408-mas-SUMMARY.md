# Quick Task 260408-mas: PR 코드리뷰 반영

**Date:** 2026-04-08
**PR:** #5 (Phase 5: Polish + Launch)

## Changes

### Issue 1: Sentry DSN 서버 환경변수 분리
- `apps/web/sentry.server.config.ts`: `NEXT_PUBLIC_SENTRY_DSN` -> `SENTRY_DSN`
- `apps/web/sentry.edge.config.ts`: `NEXT_PUBLIC_SENTRY_DSN` -> `SENTRY_DSN`
- **Why:** `NEXT_PUBLIC_*` 환경변수는 빌드타임에 클라이언트 번들에 인라인됨. Docker 빌드에서 `--build-arg`로 전달하지 않으면 빈 값이 됨. 서버/엣지 런타임은 `SENTRY_DSN`을 런타임에 읽어야 Cloud Run 환경변수로 주입 가능.

### Issue 2: HttpExceptionFilter 5xx 전용 캡처
- `apps/api/src/common/filters/http-exception.filter.ts`
  - `@SentryExceptionCaptured()` 데코레이터 제거
  - `import * as Sentry from '@sentry/nestjs'` 추가
  - `status >= 500` 조건부 `Sentry.captureException(exception)` 호출
- **Why:** 모든 HttpException(400, 401, 403, 404 포함) 캡처 시 Sentry 이벤트 쿼터 낭비 + 5xx 이슈가 클라이언트 에러 노이즈에 묻힘.

### Issue 3: deploy.yml CI 게이트 추가
- `.github/workflows/deploy.yml`: `on: push` -> `on: workflow_run` (CI 완료 후 트리거)
- `deploy-api` job에 `conclusion == 'success'` 조건 추가
- `.github/workflows/ci.yml`: `push: branches: [main]` 트리거 추가
- **Why:** CI 실패와 무관하게 `drizzle-kit migrate`가 프로덕션 DB에 실행될 위험 제거. 흐름: main push -> CI 실행 -> 성공 시에만 Deploy 트리거.

## Commits

| Hash | Message |
|------|---------|
| 18ec38f | fix(web,api): Sentry DSN 서버 환경변수 분리 및 5xx 전용 캡처 |
| 4bb34ba | fix(ci): deploy.yml에 CI 통과 게이트 추가 |

## Files Modified

- `apps/web/sentry.server.config.ts`
- `apps/web/sentry.edge.config.ts`
- `apps/api/src/common/filters/http-exception.filter.ts`
- `.github/workflows/deploy.yml`
- `.github/workflows/ci.yml`
