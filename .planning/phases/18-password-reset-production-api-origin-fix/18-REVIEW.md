---
phase: 18-password-reset-production-api-origin-fix
reviewed: 2026-04-29T05:53:25Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - .github/workflows/deploy.yml
  - apps/web/app/auth/reset-password/__tests__/reset-password.test.tsx
  - apps/web/app/auth/reset-password/page.tsx
  - apps/web/components/auth/login-form.tsx
  - apps/web/lib/__tests__/api-url.test.ts
  - apps/web/lib/__tests__/next-config.test.ts
  - apps/web/lib/api-client.ts
  - apps/web/lib/api-url.ts
  - apps/web/lib/auth.ts
  - apps/web/next.config.ts
findings:
  critical: 3
  warning: 2
  info: 0
  total: 5
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-04-29T05:53:25Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

지정된 production API origin 수정 범위와 관련 테스트를 표준 깊이로 검토했다. 주요 리스크는 배포 workflow가 `workflow_run`에서 CI가 검증한 commit을 고정하지 않는 점, production origin 검증이 API 배포 이후에 일부 값에만 적용되는 점, password reset request 화면이 enumeration 방지 의도와 달리 전역 API toast를 그대로 노출하는 점이다.

## Critical Issues

### CR-01: [BLOCKER] workflow_run 배포가 CI가 검증한 commit이 아닌 코드를 배포할 수 있음

**File:** `.github/workflows/deploy.yml:23`
**Issue:** `workflow_run` 트리거에서 `actions/checkout@v6`가 `github.event.workflow_run.head_sha`를 지정하지 않고, Docker image tag도 여러 곳에서 `${{ github.sha }}`를 사용한다. `workflow_run` 이벤트의 기본 checkout/SHA는 완료된 CI run의 head commit과 달라질 수 있어, main이 이동한 사이 이전 CI 완료 이벤트가 도착하면 테스트를 통과하지 않은 commit을 build/deploy할 수 있다. 이는 production 배포 무결성 문제다.
**Fix:**
```yaml
env:
  DEPLOY_SHA: ${{ github.event.workflow_run.head_sha }}

steps:
  - uses: actions/checkout@v6
    with:
      ref: ${{ env.DEPLOY_SHA }}

  - name: Build API image
    run: |
      docker build -f apps/api/Dockerfile \
        -t ${{ env.GCP_REGION }}-docker.pkg.dev/${{ env.GCP_PROJECT_ID }}/${{ env.AR_REPO }}/${{ env.API_SERVICE }}:${{ env.DEPLOY_SHA }} \
        .
```
동일한 `DEPLOY_SHA`를 API/Web build, push, deploy image 값 전체에 사용해야 한다.

### CR-02: [BLOCKER] production origin 검증이 API 배포 후에만 일부 값에 적용됨

**File:** `.github/workflows/deploy.yml:100`
**Issue:** API 서비스는 `FRONTEND_URL`, `KAKAO_CALLBACK_URL`, `NAVER_CALLBACK_URL`, `GOOGLE_CALLBACK_URL`을 `vars.CLOUD_RUN_WEB_URL`/`vars.CLOUD_RUN_API_URL`로 배포하지만, 해당 값 검증은 `deploy-web` job의 web build 직전에만 실행된다. 따라서 API는 빈 값, scheme 없는 값, 잘못된 host로 먼저 배포될 수 있고 password reset email link 및 OAuth callback이 깨진 production 상태가 된다. 또한 web 검증은 empty/localhost만 막아 `api.heygrabit.com` 같은 non-absolute 값도 통과시키며, 이는 `apiUrl()`의 production absolute URL 요구와 충돌한다.
**Fix:**
```yaml
- name: Validate production origins
  run: |
    node - <<'NODE'
    const values = {
      CLOUD_RUN_API_URL: process.env.CLOUD_RUN_API_URL,
      CLOUD_RUN_WEB_URL: process.env.CLOUD_RUN_WEB_URL,
    };
    for (const [name, value] of Object.entries(values)) {
      if (!value || value.trim() !== value) throw new Error(`${name} must be set without surrounding whitespace`);
      const url = new URL(value);
      if (url.protocol !== 'https:') throw new Error(`${name} must be an https URL`);
      if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(url.hostname.replace(/^\[|\]$/g, '').toLowerCase())) {
        throw new Error(`${name} must not point to localhost`);
      }
    }
    NODE
  env:
    CLOUD_RUN_API_URL: ${{ vars.CLOUD_RUN_API_URL }}
    CLOUD_RUN_WEB_URL: ${{ vars.CLOUD_RUN_WEB_URL }}
```
이 검증을 `deploy-api`보다 앞선 공통 job 또는 `deploy-api` 첫 단계에 두고, web build 검증과 중복되지 않게 공유해야 한다.

### CR-03: [BLOCKER] password reset request가 enumeration 방지 의도와 달리 API 에러 toast를 노출함

**File:** `apps/web/app/auth/reset-password/page.tsx:64`
**Issue:** `RequestView`는 catch에서 모든 실패를 삼켜 항상 성공 화면을 보여주지만, 실제 호출은 `apiClient.post()`를 사용한다. `apiClient`는 non-401 응답에서 throw 전에 `toast.error(errorMessage)`를 표시하므로(`apps/web/lib/api-client.ts:117`), backend가 4xx/5xx 또는 provider 장애를 반환하면 사용자는 에러 toast와 성공 화면을 동시에 본다. 특히 password reset endpoint는 계정 존재 여부를 숨겨야 하는 흐름이므로, 서버 메시지나 existing-user-only email dispatch 실패가 UI에 노출되면 enumeration side channel이 된다.
**Fix:**
```tsx
try {
  await fetch(apiUrl('/api/v1/auth/password-reset/request'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
} catch {
  // Always show success to prevent email enumeration.
} finally {
  setSentEmail(data.email);
  setIsSent(true);
  setIsLoading(false);
}
```
또는 `apiClient.post(..., { suppressToast: true })` 같은 명시 옵션을 추가하고, request mode 테스트에 `toast.error`가 호출되지 않는 회귀 테스트를 추가해야 한다.

## Warnings

### WR-01: [WARNING] token query가 바뀌어도 form state의 reset token이 갱신되지 않음

**File:** `apps/web/app/auth/reset-password/page.tsx:162`
**Issue:** `useForm`의 `defaultValues.token`은 최초 mount 때만 반영된다. 같은 `/auth/reset-password` route 안에서 `?token=`만 바뀌는 client navigation이 발생하면 `ConfirmView` prop은 바뀌지만 form state에는 이전 token이 남아, 새 링크를 보고도 이전 token으로 submit할 수 있다.
**Fix:**
```tsx
if (token !== '') {
  return <ConfirmView key={token} token={token} />;
}
```
또는 `ConfirmView` 내부에서 `useEffect(() => form.reset({ token, newPassword: '', newPasswordConfirm: '' }), [token, form])`로 token 변경을 form state에 반영하고, token query 변경 테스트를 추가한다.

### WR-02: [WARNING] apiClient public API가 leading slash를 타입으로 강제하지 않아 malformed URL을 만들 수 있음

**File:** `apps/web/lib/api-client.ts:80`
**Issue:** `apiUrl()`는 `path: \`/${string}\`` 타입으로 leading slash를 요구하지만, `apiClient.get/post/put/patch/delete`는 `path: string`을 받은 뒤 `path as \`/${string}\``로 강제 캐스팅한다. 호출자가 실수로 `api/v1/...`를 넘겨도 TypeScript가 막지 못하고 production에서는 `https://api.example.comapi/v1/...` 같은 깨진 URL이 생성된다.
**Fix:**
```ts
type ApiPath = `/${string}`;

async function request<T>(
  method: string,
  path: ApiPath,
  body?: unknown,
): Promise<T> {
  let res = await fetch(apiUrl(path), config);
  // ...
}

export const apiClient = {
  get: <T>(path: ApiPath) => request<T>('GET', path),
  post: <T>(path: ApiPath, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: ApiPath, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: ApiPath, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: ApiPath) => request<T>('DELETE', path),
};
```
`apiUrl` type contract을 `apiClient` export 경계까지 유지해야 한다.

---

_Reviewed: 2026-04-29T05:53:25Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
