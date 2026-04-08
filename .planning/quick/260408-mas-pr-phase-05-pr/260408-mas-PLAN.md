---
phase: quick-260408-mas
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/sentry.server.config.ts
  - apps/web/sentry.edge.config.ts
  - apps/api/src/common/filters/http-exception.filter.ts
  - .github/workflows/deploy.yml
  - .github/workflows/ci.yml
autonomous: true
must_haves:
  truths:
    - "서버/엣지 Sentry config가 SENTRY_DSN 환경변수를 사용한다"
    - "HttpExceptionFilter가 5xx 에러만 Sentry에 캡처한다"
    - "deploy.yml이 CI 성공 후에만 실행된다"
  artifacts:
    - path: "apps/web/sentry.server.config.ts"
      provides: "서버 Sentry 초기화"
      contains: "process.env.SENTRY_DSN"
    - path: "apps/web/sentry.edge.config.ts"
      provides: "엣지 Sentry 초기화"
      contains: "process.env.SENTRY_DSN"
    - path: "apps/api/src/common/filters/http-exception.filter.ts"
      provides: "선택적 Sentry 캡처 (5xx만)"
      contains: "captureException"
    - path: ".github/workflows/deploy.yml"
      provides: "CI 게이트가 있는 배포 워크플로우"
      contains: "workflow_run"
  key_links:
    - from: "deploy.yml"
      to: "ci.yml"
      via: "workflow_run gate"
      pattern: "workflow_run.*CI"
---

<objective>
PR #5 코드리뷰에서 지적된 3가지 이슈를 수정한다:
1. 서버/엣지 Sentry DSN 환경변수를 NEXT_PUBLIC_ 접두사 없이 사용
2. HttpExceptionFilter에서 5xx 에러만 Sentry에 캡처
3. deploy.yml에 CI 통과 게이트 추가

Purpose: 프로덕션 Sentry 초기화 실패 방지, Sentry 이벤트 쿼터 절약, 안전한 배포 파이프라인 확보
Output: 수정된 5개 파일
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/web/sentry.server.config.ts
@apps/web/sentry.edge.config.ts
@apps/web/instrumentation-client.ts
@apps/api/src/common/filters/http-exception.filter.ts
@apps/api/src/instrument.ts
@.github/workflows/deploy.yml
@.github/workflows/ci.yml
</context>

<tasks>

<task type="auto">
  <name>Task 1: Sentry DSN 환경변수 수정 + HttpExceptionFilter 5xx 전용 캡처</name>
  <files>apps/web/sentry.server.config.ts, apps/web/sentry.edge.config.ts, apps/api/src/common/filters/http-exception.filter.ts</files>
  <action>
**Sentry DSN 환경변수 (Issue 1):**
- `apps/web/sentry.server.config.ts` line 4: `process.env.NEXT_PUBLIC_SENTRY_DSN` -> `process.env.SENTRY_DSN`
- `apps/web/sentry.edge.config.ts` line 4: `process.env.NEXT_PUBLIC_SENTRY_DSN` -> `process.env.SENTRY_DSN`
- 클라이언트 파일(`instrumentation-client.ts`)은 이미 올바르게 `NEXT_PUBLIC_SENTRY_DSN` 사용 중이므로 변경하지 않는다.
- 서버/엣지 런타임은 `NEXT_PUBLIC_*` 접두사가 필요 없다. `NEXT_PUBLIC_*`는 빌드타임에 클라이언트 번들에 인라인되는 용도이며, 서버에서는 일반 환경변수로 런타임에 읽어야 Docker 빌드 시 DSN 없이도 빌드 가능하고 런타임에 Cloud Run 환경변수로 주입할 수 있다.

**HttpExceptionFilter Sentry 캡처 범위 (Issue 2):**
- `apps/api/src/common/filters/http-exception.filter.ts`에서:
  1. `@SentryExceptionCaptured()` 데코레이터를 제거한다 (line 12). 이 데코레이터는 모든 HttpException을 무차별 캡처한다.
  2. `SentryExceptionCaptured` import를 제거한다 (line 7).
  3. 대신 `import * as Sentry from '@sentry/nestjs';`를 추가한다.
  4. catch 메서드 내에서 `status >= 500`일 때만 `Sentry.captureException(exception);`을 호출한다.
  5. 조건문은 `response.status(status).json(errorBody)` 직전에 배치한다.

수정 후 http-exception.filter.ts 전체 구조:
```typescript
import {
  ExceptionFilter,
  Catch,
  HttpException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    if (status >= 500) {
      Sentry.captureException(exception);
    }

    const errorBody = {
      statusCode: status,
      message: exception.message,
      ...(typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? { errors: (exceptionResponse as Record<string, unknown>)['errors'] }
        : {}),
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(errorBody);
  }
}
```
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && grep -c "process.env.SENTRY_DSN" apps/web/sentry.server.config.ts apps/web/sentry.edge.config.ts && grep -c "NEXT_PUBLIC" apps/web/sentry.server.config.ts apps/web/sentry.edge.config.ts | grep ":0" | wc -l && grep -c "captureException" apps/api/src/common/filters/http-exception.filter.ts && grep -c "SentryExceptionCaptured" apps/api/src/common/filters/http-exception.filter.ts</automated>
  </verify>
  <done>
- sentry.server.config.ts와 sentry.edge.config.ts가 `SENTRY_DSN`을 사용한다 (NEXT_PUBLIC_ 접두사 없음)
- http-exception.filter.ts에서 @SentryExceptionCaptured 데코레이터가 제거되고, status >= 500일 때만 Sentry.captureException이 호출된다
  </done>
</task>

<task type="auto">
  <name>Task 2: deploy.yml CI 게이트 추가</name>
  <files>.github/workflows/deploy.yml, .github/workflows/ci.yml</files>
  <action>
**deploy.yml 트리거 변경 (Issue 3):**

현재 `deploy.yml`은 `on: push: branches: [main]`으로 트리거되어 CI 실패와 무관하게 배포된다. 특히 `drizzle-kit migrate`가 프로덕션 DB에 실행되므로 위험하다.

수정 방법 - `workflow_run` 게이트 추가:
1. `deploy.yml`의 `on:` 섹션을 다음으로 변경:
```yaml
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]
```

2. 기존의 두 job (`deploy-api`, `deploy-web`) 모두에 CI 성공 조건을 추가:
- `deploy-api` job에 조건 추가: `if: ${{ github.event.workflow_run.conclusion == 'success' }}`
- `deploy-web` job은 이미 `needs: deploy-api`이므로 deploy-api가 skip되면 자동 skip된다.

3. `ci.yml`에 `push` 트리거도 추가하여 main 브랜치 push 시에도 CI가 실행되도록 한다:
```yaml
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
```
현재 ci.yml은 `pull_request`에서만 실행되는데, `workflow_run`이 CI 워크플로우 완료를 기다리려면 main push 시에도 CI가 트리거되어야 한다.

흐름: main에 push -> ci.yml 실행 -> 성공 -> deploy.yml의 workflow_run 트리거 -> deploy-api -> deploy-web
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && grep -A3 "^on:" .github/workflows/deploy.yml && echo "---" && grep "workflow_run" .github/workflows/deploy.yml && echo "---" && grep "conclusion.*success" .github/workflows/deploy.yml && echo "---" && grep -A4 "^on:" .github/workflows/ci.yml</automated>
  </verify>
  <done>
- deploy.yml이 `workflow_run` 게이트로 CI 완료 후에만 실행된다
- deploy-api job에 `conclusion == 'success'` 조건이 있다
- ci.yml이 pull_request와 push 양쪽에서 트리거된다
- 흐름: push to main -> CI 실행 -> 성공 시에만 Deploy 트리거
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| CI -> Deploy | CI 실패 시 프로덕션 배포 차단 |
| Client -> Server env | NEXT_PUBLIC_ 환경변수는 클라이언트 번들에 노출됨 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-01 | I (Information Disclosure) | sentry.server.config.ts | mitigate | SENTRY_DSN을 서버 전용 환경변수로 변경하여 클라이언트 번들 노출 방지 |
| T-quick-02 | D (Denial of Service) | http-exception.filter.ts | mitigate | 4xx 에러 Sentry 전송 제거로 이벤트 쿼터 낭비 방지 |
| T-quick-03 | T (Tampering) | deploy.yml | mitigate | CI 게이트 추가로 검증 실패 코드의 프로덕션 DB 마이그레이션 방지 |
</threat_model>

<verification>
1. `grep "SENTRY_DSN" apps/web/sentry.server.config.ts` -> `process.env.SENTRY_DSN` (NEXT_PUBLIC_ 없음)
2. `grep "SENTRY_DSN" apps/web/sentry.edge.config.ts` -> `process.env.SENTRY_DSN` (NEXT_PUBLIC_ 없음)
3. `grep "NEXT_PUBLIC" apps/web/instrumentation-client.ts` -> 여전히 NEXT_PUBLIC_SENTRY_DSN 사용 (클라이언트는 변경 없음)
4. `grep "captureException" apps/api/src/common/filters/http-exception.filter.ts` -> 존재
5. `grep "SentryExceptionCaptured" apps/api/src/common/filters/http-exception.filter.ts` -> 없음
6. `grep "workflow_run" .github/workflows/deploy.yml` -> 존재
7. `grep "push:" .github/workflows/ci.yml` -> 존재
8. typecheck 통과: `pnpm typecheck`
9. lint 통과: `pnpm lint`
</verification>

<success_criteria>
- 서버/엣지 Sentry config가 런타임 환경변수 SENTRY_DSN을 사용한다
- HttpExceptionFilter가 400/401/403/404 등 클라이언트 에러를 Sentry에 보내지 않는다
- HttpExceptionFilter가 500+ 에러만 Sentry.captureException으로 캡처한다
- deploy.yml이 CI 워크플로우 성공 후에만 트리거된다
- ci.yml이 PR과 main push 양쪽에서 실행된다
</success_criteria>

<output>
After completion, create `.planning/quick/260408-mas-pr-phase-05-pr/260408-mas-SUMMARY.md`
</output>
