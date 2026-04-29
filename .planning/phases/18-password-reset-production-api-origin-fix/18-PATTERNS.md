# Phase 18: Password reset production API origin fix - Pattern Map

**Mapped:** 2026-04-29  
**Files analyzed:** 10  
**Analogs found:** 10 / 10  
**Primary inputs:** `18-RESEARCH.md`, `18-VALIDATION.md`, `AGENTS.md`

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/lib/api-url.ts` | utility | transform + request-response URL construction | `apps/web/lib/api-client.ts`, `apps/web/app/legal/robots.ts` | role-match |
| `apps/web/lib/__tests__/api-url.test.ts` | test | transform + env-driven module import | `apps/web/app/legal/__tests__/metadata.test.ts` | role-match |
| `apps/web/lib/api-client.ts` | utility/service | request-response | `apps/web/lib/api-client.ts` | exact |
| `apps/web/lib/auth.ts` | utility/service | request-response | `apps/web/lib/auth.ts` | exact |
| `apps/web/components/auth/login-form.tsx` | component | request-response + browser redirect | `apps/web/components/auth/login-form.tsx` | exact |
| `apps/web/app/auth/reset-password/page.tsx` | component/page | request-response + token UX | `apps/web/app/auth/reset-password/page.tsx` | exact |
| `apps/web/app/auth/reset-password/__tests__/reset-password.test.tsx` | test | component request-response mocking | `apps/web/app/auth/reset-password/__tests__/reset-password.test.tsx` | exact |
| `apps/web/next.config.ts` | config | request-routing | `apps/web/next.config.ts` | exact |
| `apps/web/lib/__tests__/next-config.test.ts` | test | config/static import + env-driven module import | `apps/web/app/legal/__tests__/metadata.test.ts`, `apps/web/next.config.ts` | role-match |
| `.planning/phases/18-password-reset-production-api-origin-fix/18-HUMAN-UAT.md` | manual UAT artifact | operator-driven production smoke | `.planning/phases/15-resend-heygrabit-com-cutover-transactional-email-secret-mana/15-HUMAN-UAT.md` | exact |

## Pattern Assignments

### `apps/web/lib/api-url.ts` (utility, transform + request-response URL construction)

**Analog:** `apps/web/lib/api-client.ts` and `apps/web/app/legal/robots.ts`

**Current API origin duplication to consolidate** (`apps/web/lib/api-client.ts` lines 8, 34-38, 81):
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
});

let res = await fetch(`${API_URL}${path}`, config);
```

**Runtime env helper pattern** (`apps/web/app/legal/robots.ts` lines 1-9):
```typescript
export function getLegalRobots() {
  const isProd =
    process.env.GRABIT_ENV === 'production' ||
    (process.env.GRABIT_ENV == null && process.env.NODE_ENV === 'production');

  return {
    index: isProd,
    follow: isProd,
  };
}
```

**Supporting analog for env-based URL construction** (`apps/web/lib/socket-client.ts` lines 3-14):
```typescript
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || '';

export function createBookingSocket(): Socket {
  return io(`${WS_URL}/booking`, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
}
```

**Planner instruction:** create `getApiBaseUrl()` and `apiUrl(path)` as named exports. Preserve relative `/api/...` output when `NEXT_PUBLIC_API_URL` is empty for local dev rewrites, trim trailing slashes when configured, and reject localhost API origins under `NODE_ENV=production`.

---

### `apps/web/lib/__tests__/api-url.test.ts` (test, transform + env-driven module import)

**Analog:** `apps/web/app/legal/__tests__/metadata.test.ts`

**Vitest env setup pattern** (lines 1-27):
```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('GRABIT_ENV', 'production');
});

afterEach(() => {
  vi.unstubAllEnvs();
});
```

**Env-specific dynamic import pattern** (lines 117-132):
```typescript
it('GRABIT_ENV 가 없고 NODE_ENV=production 이면 index/follow 를 허용한다', async () => {
  vi.stubEnv('GRABIT_ENV', undefined);
  vi.stubEnv('NODE_ENV', 'production');
  const { getLegalRobots } = await import('../robots');

  expect(getLegalRobots()).toEqual({ index: true, follow: true });
});

it('preview 환경은 noindex/nofollow 를 유지한다', async () => {
  vi.stubEnv('GRABIT_ENV', 'preview');
  vi.stubEnv('NODE_ENV', 'production');
  const { getLegalRobots } = await import('../robots');

  expect(getLegalRobots()).toEqual({ index: false, follow: false });
});
```

**Planner instruction:** use `vi.stubEnv('NEXT_PUBLIC_API_URL', ...)`, `vi.stubEnv('NODE_ENV', ...)`, `vi.resetModules()`, and dynamic `await import('../api-url')` so each test observes a fresh env snapshot.

---

### `apps/web/lib/api-client.ts` (utility/service, request-response)

**Analog:** `apps/web/lib/api-client.ts`

**Imports and current origin constant** (lines 1-8):
```typescript
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/use-auth-store';
import {
  STATUS_MESSAGES,
  DEFAULT_ERROR_MESSAGE,
} from './error-messages';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
```

**Refresh request pattern** (lines 32-50):
```typescript
refreshPromise = (async () => {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as { accessToken: string };
    return data.accessToken;
  } catch {
    return null;
  } finally {
    refreshPromise = null;
  }
})();
```

**Core request pattern** (lines 71-82):
```typescript
const config: RequestInit = {
  method,
  headers,
  credentials: 'include',
};

if (body !== undefined) {
  config.body = JSON.stringify(body);
}

let res = await fetch(`${API_URL}${path}`, config);
```

**401 refresh and redirect behavior** (lines 83-105):
```typescript
// On 401, attempt silent refresh and retry once
if (res.status === 401 && accessToken) {
  const newToken = await refreshAccessToken();

  if (newToken) {
    // Update store with new token
    const { user } = useAuthStore.getState();
    if (user) {
      useAuthStore.getState().setAuth(newToken, user);
    }

    // Retry with new token
    headers['Authorization'] = `Bearer ${newToken}`;
    res = await fetch(`${API_URL}${path}`, { ...config, headers });
  } else {
    // Refresh failed -- clear auth and redirect
    useAuthStore.getState().clearAuth();
    if (typeof window !== 'undefined') {
      window.location.href = '/auth';
    }
    throw new ApiClientError('인증이 만료되었습니다. 다시 로그인해주세요.', 401);
  }
}
```

**Error handling pattern** (lines 107-125):
```typescript
if (!res.ok) {
  const status = res.status;
  let errorMessage = STATUS_MESSAGES[status] ?? DEFAULT_ERROR_MESSAGE;
  try {
    const errorData = (await res.json()) as ApiError;
    if (errorData.message) errorMessage = errorData.message;
  } catch {
    // Use default message
  }

  // 401 is handled above (redirect). No toast needed here.
  if (status !== 401) {
    toast.error(errorMessage, {
      description: `오류 코드: ERR-${status}`,
      duration: 5000,
    });
  }

  throw new ApiClientError(errorMessage, status);
}
```

**Planner instruction:** replace URL construction only: import `apiUrl` from `@/lib/api-url`, then call `fetch(apiUrl('/api/v1/auth/refresh'), ...)`, `fetch(apiUrl(path), config)`, and retry with `fetch(apiUrl(path), ...)`. Preserve refresh deduplication, credentials, toast, and redirect behavior exactly.

---

### `apps/web/lib/auth.ts` (utility/service, request-response)

**Analog:** `apps/web/lib/auth.ts`

**Imports and current origin constant** (lines 1-5):
```typescript
import { useAuthStore } from '@/stores/use-auth-store';
import type { UserProfile } from '@grabit/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
```

**Refresh request pattern** (lines 6-18):
```typescript
export async function initializeAuth(): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.ok) {
      const data = (await res.json()) as { accessToken: string };

      // Fetch user profile with new token
      const userRes = await fetch(`${API_URL}/api/v1/users/me`, {
```

**Authorized user fetch pattern** (lines 18-29):
```typescript
const userRes = await fetch(`${API_URL}/api/v1/users/me`, {
  headers: {
    Authorization: `Bearer ${data.accessToken}`,
    'Content-Type': 'application/json',
  },
  credentials: 'include',
});

if (userRes.ok) {
  const user = (await userRes.json()) as UserProfile;
  useAuthStore.getState().setAuth(data.accessToken, user);
  return;
}
```

**Graceful session absence pattern** (lines 32-36):
```typescript
} catch {
  // No valid session -- that's fine
}

useAuthStore.getState().setInitialized();
```

**Planner instruction:** import `apiUrl` and replace only `${API_URL}/api/v1/...` strings. Keep the "no valid session" catch and `setInitialized()` semantics unchanged.

---

### `apps/web/components/auth/login-form.tsx` (component, request-response + browser redirect)

**Analog:** `apps/web/components/auth/login-form.tsx`

**Import conventions** (lines 3-24):
```typescript
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { loginSchema, type LoginInput, type AuthResponse } from '@grabit/shared';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/use-auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
```

**Current social URL construction** (lines 26, 87-90):
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function handleSocialLogin(provider: 'kakao' | 'naver' | 'google') {
  setSocialLoading(provider);
  window.location.href = `${API_URL}/api/v1/auth/social/${provider}`;
}
```

**Login submit error handling** (lines 68-85):
```typescript
async function onSubmit(data: LoginInput) {
  setIsLoading(true);
  setLoginError(null);

  try {
    const res = await apiClient.post<AuthResponse>('/api/v1/auth/login', data);
    setAuth(res.accessToken, res.user);
    router.push('/');
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 401) {
      setLoginError('이메일 또는 비밀번호가 일치하지 않습니다');
    } else {
      setLoginError('일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
  } finally {
    setIsLoading(false);
  }
}
```

**Planner instruction:** only social redirect URL should change to `apiUrl('/api/v1/auth/social/${provider}')`. Do not change login submit flow, `ApiClientError` copy, `useAuthStore`, or router behavior.

---

### `apps/web/app/auth/reset-password/page.tsx` (component/page, request-response + token UX)

**Analog:** `apps/web/app/auth/reset-password/page.tsx`

**Imports pattern** (lines 3-28):
```typescript
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  resetPasswordRequestSchema,
  resetPasswordSchema,
  type ResetPasswordRequestInput,
  type ResetPasswordInput,
} from '@grabit/shared';
import { apiClient } from '@/lib/api-client';
```

**Request mode enumeration-defense pattern** (lines 60-70):
```typescript
async function onSubmit(data: ResetPasswordRequestInput) {
  setIsLoading(true);
  try {
    await apiClient.post('/api/v1/auth/password-reset/request', data);
  } catch {
    // Always show success to prevent email enumeration
  } finally {
    setSentEmail(data.email);
    setIsSent(true);
    setIsLoading(false);
  }
}
```

**Confirm mode raw fetch semantics** (lines 168-176):
```typescript
async function onSubmit(data: ResetPasswordInput) {
  setIsLoading(true);
  try {
    const res = await fetch('/api/v1/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
```

**Token-specific 401 UX** (lines 178-206):
```typescript
if (res.ok) {
  toast.success('비밀번호가 변경되었습니다. 다시 로그인해주세요.');
  router.push('/auth');
  return;
}

if (res.status === 401) {
  setTokenError(true);
  return;
}

let message = '오류가 발생했습니다. 다시 시도해주세요.';
if (res.status === 429) {
  message = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
}
try {
  const errorData = (await res.json()) as { message?: string };
  if (res.status === 400 && errorData.message) {
    message = errorData.message;
  }
} catch {
  // ignore JSON parse errors
}
toast.error(message);
} catch {
  toast.error('오류가 발생했습니다. 다시 시도해주세요.');
} finally {
  setIsLoading(false);
}
```

**Invalid token screen** (lines 209-223):
```typescript
if (tokenError) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px] space-y-6">
        <div className="space-y-3">
          <h1 className="text-heading font-semibold text-gray-900">
            유효하지 않은 링크
          </h1>
          <p className="text-base text-gray-700">
            비밀번호 재설정 링크가 만료되었거나 이미 사용되었습니다. 다시 요청해주세요.
          </p>
        </div>
        <Button asChild size="lg" className="w-full">
          <Link href="/auth/reset-password">다시 요청하기</Link>
```

**Planner instruction:** import `apiUrl` from `@/lib/api-url` and change only the raw fetch URL to `apiUrl('/api/v1/auth/password-reset/confirm')`. Keep raw `fetch` rather than `apiClient.post`, because `apiClient` 401 behavior redirects authenticated sessions while this page needs reset-token-specific invalid link UI.

---

### `apps/web/app/auth/reset-password/__tests__/reset-password.test.tsx` (test, component request-response mocking)

**Analog:** `apps/web/app/auth/reset-password/__tests__/reset-password.test.tsx`

**Hoisted mocks pattern** (lines 1-39):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResetPasswordPage from '../page';

// --- next/navigation mock (hoisted so useSearchParams per-test can swap) ---
const mockSearchParams = { current: new URLSearchParams() };
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams.current,
  useRouter: () => ({ push: mockPush, replace: mockPush, refresh: vi.fn() }),
}));

// apiClient mock -- request mode uses apiClient.post, but we don't want network
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: vi.fn().mockResolvedValue({}),
    get: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));
```

**Per-test global fetch setup** (lines 41-50):
```typescript
describe('ResetPasswordPage', () => {
  beforeEach(() => {
    mockSearchParams.current = new URLSearchParams();
    mockPush.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
```

**Current confirm success test shape** (lines 74-106):
```typescript
it('confirm 제출 성공 시 fetch 가 올바른 path + body 로 호출된다', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ message: '비밀번호가 변경되었습니다' }),
  } as Response);
  vi.stubGlobal('fetch', fetchMock);

  render(<ResetPasswordPage />);
  const user = userEvent.setup();
  const pwInputs = document.querySelectorAll<HTMLInputElement>(
    'input[autocomplete="new-password"]',
  );
  await user.type(pwInputs[0], 'Test1234!');
  await user.type(pwInputs[1], 'Test1234!');
  await user.click(
    screen.getByRole('button', {
      name: /비밀번호 변경|변경하기|설정|확인/,
    }),
  );

  await vi.waitFor(() => {
    expect(fetchMock).toHaveBeenCalled();
  });

  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toContain('/api/v1/auth/password-reset/confirm');
```

**401 invalid-token UX test shape** (lines 108-137):
```typescript
it('401 응답 시 에러 UI + "다시 요청하기" 링크가 표시된다', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ message: '유효하지 않은 재설정 토큰입니다' }),
  } as Response);
  vi.stubGlobal('fetch', fetchMock);

  render(<ResetPasswordPage />);
  const user = userEvent.setup();
  const pwInputs = document.querySelectorAll<HTMLInputElement>(
    'input[autocomplete="new-password"]',
  );
  await user.type(pwInputs[0], 'Test1234!');
  await user.type(pwInputs[1], 'Test1234!');
  await user.click(
    screen.getByRole('button', {
      name: /비밀번호 변경|변경하기|설정|확인/,
    }),
  );

  await vi.waitFor(() => {
    const matches = screen.queryAllByText(/유효하지 않은|만료|다시 요청/);
    expect(matches.length).toBeGreaterThan(0);
  });
```

**Planner instruction:** add env cleanup (`vi.unstubAllEnvs()`) if `NEXT_PUBLIC_API_URL` is stubbed. Change success assertion from `.toContain(...)` to exact `https://api.heygrabit.com/api/v1/auth/password-reset/confirm` after `vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.heygrabit.com')`.

---

### `apps/web/next.config.ts` (config, request-routing)

**Analog:** `apps/web/next.config.ts`

**Config imports and monorepo env loading** (lines 1-9):
```typescript
import type { NextConfig } from 'next';
import { loadEnvConfig } from '@next/env';
import { withSentryConfig } from '@sentry/nextjs';
import { resolve } from 'path';

// Load .env from monorepo root (convention: single .env at monorepo root)
// Next.js only loads .env from its own project dir (apps/web/),
// so load the repo root with Next's dotenv-compatible parser before config runs.
loadEnvConfig(resolve(__dirname, '../..'));
```

**Current config object shape** (lines 23-35):
```typescript
const nextConfig: NextConfig = {
  allowedDevOrigins,
  output: 'standalone',
  outputFileTracingRoot: resolve(__dirname, '../../'),
  transpilePackages: ['@grabit/shared'],
  turbopack: {
    root: resolve(__dirname, '../../'),
    rules: {
      '*.md': { as: '*.js', loaders: ['raw-loader'] },
      '*.md?raw': { as: '*.js', loaders: ['raw-loader'] },
    },
  },
  async rewrites() {
```

**Current rewrite pattern to scope to dev only** (lines 35-46):
```typescript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: 'http://localhost:8080/api/:path*',
    },
    {
      source: '/socket.io/:path*',
      destination: 'http://localhost:8080/socket.io/:path*',
    },
  ];
},
```

**Export shape with Sentry wrapper** (lines 57-62):
```typescript
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
```

**Planner instruction:** keep `nextConfig` object and `withSentryConfig` export shape. Add a production guard inside `rewrites()` so production returns `[]` or otherwise contains no `localhost:8080` destination. Do not remove `loadEnvConfig` or standalone/tracing settings.

---

### `apps/web/lib/__tests__/next-config.test.ts` (test, config/static import + env-driven module import)

**Analog:** `apps/web/app/legal/__tests__/metadata.test.ts` and `apps/web/next.config.ts`

**Vitest env reset pattern** (`apps/web/app/legal/__tests__/metadata.test.ts` lines 20-27):
```typescript
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('GRABIT_ENV', 'production');
});

afterEach(() => {
  vi.unstubAllEnvs();
});
```

**Config default export shape to import** (`apps/web/next.config.ts` lines 57-62):
```typescript
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
```

**Planner instruction:** place the test under `apps/web/lib/__tests__/next-config.test.ts` as specified by validation. Use `vi.stubEnv('NODE_ENV', 'production')`, `vi.resetModules()`, dynamic import of `../../next.config`, then call `config.rewrites()` if it is a function. Assert serialized rewrites do not contain `localhost:8080`. If Sentry wrapper changes the config shape, unwrap only as needed in the test without changing production export.

---

### `.planning/phases/18-password-reset-production-api-origin-fix/18-HUMAN-UAT.md` (manual UAT artifact, operator-driven production smoke)

**Analog:** `.planning/phases/15-resend-heygrabit-com-cutover-transactional-email-secret-mana/15-HUMAN-UAT.md`

**Artifact header and goal pattern** (lines 1-5):
```markdown
# Phase 15 HUMAN-UAT -- Resend heygrabit.com cutover

**Created:** 2026-04-27 (KST) -- Task 0 실행 시점
**Goal:** 프로덕션 transactional email 경로가 `heygrabit.com` 로 cutover 되고 3사 inbox 수신이 검증됨.
**References:** 15-CONTEXT.md D-01~D-16, 15-RESEARCH.md §Implementation Approach, .planning/debug/password-reset-email-not-delivered-prod.md Resolution
```

**Preconditions pattern** (lines 9-15):
```markdown
## Pre-conditions

**Wave 1 (code):**
- [x] Plan 01 merged (email.service.ts Sentry.captureException 삽입 + spec 8 테스트 green) -- PR #20 merge commit `6c1388d` (2026-04-27 11:53 KST)
- [x] `pnpm --filter @grabit/api test` 전체 green -- 307/307
- [x] GitHub Actions deploy.yml -> Cloud Run `grabit-api` 새 revision 이 Ready (`grabit-api-00011-5c8` created 2026-04-27 11:58:38 KST, image `sha256:c26a4d32...`, traffic 100%)
```

**Manual scenario checklist pattern** (lines 28-52):
```markdown
## SC-1: 프로덕션 3사 inbox 수신 검증 (LOCKED D-14)

**Preconditions (REVIEWS HIGH H2):**
- [ ] UAT 에 사용할 Gmail / Naver / Daum(또는 Kakao) 3 개 주소가 prod grabit DB 에 가입된 계정임을 확인. `/auth/password-reset` 는 enumeration 방어로 미등록 이메일에도 200 을 반환하므로 미등록 주소로는 메일이 발송되지 않는다.

**Steps:**
1. https://heygrabit.com/auth/forgot-password 접속 (또는 직접 API 호출)
2. 수신 메일 주소 입력 -- 차례로 Gmail / Naver / Daum(또는 Kakao) 3개 계정 (위 Preconditions 에 등록된 주소)
3. "비밀번호 재설정 링크 받기" 클릭
4. 각 inbox 에서 아래 조건 모두 확인:
   - Subject: `[Grabit] 비밀번호 재설정`
   - From: `no-reply@heygrabit.com`
   - **Inbox (받은편지함) 수신 -- spam/정크 폴더 아님**
   - 본문 내 "비밀번호 재설정" 링크 존재
```

**Cloud Logging evidence pattern** (lines 55-82):
```markdown
## SC-2: Silent failure 관측성 확인 (Sentry + Cloud Logging)

**Purpose:** D-11 의 Sentry 통합이 production 에서 작동하고, D-13 의 gcloud logging 쿼리 조건이 충족됨을 확인.

**Steps:**
1. UAT 트리거 (SC-1) 가 끝난 후 최소 2 분 경과
2. Plan 03 Task 4 의 revision-scoped gcloud logging 쿼리 실행:
   ```
   gcloud logging read \
     "resource.type=cloud_run_revision \
      AND resource.labels.service_name=grabit-api \
      AND resource.labels.revision_name=\"<NEW_REVISION_NAME>\" \
      AND (textPayload:\"Resend send failed\" OR jsonPayload.message:\"Resend send failed\")" \
     --project=grapit-491806 --limit=50 --format=json
   ```
3. 결과가 empty 여야 함

**baseline (deploy + key fix 직후) -- 검증 완료:**
- `gcloud logging read` revision-scoped (`grabit-api-00011-5c8` & `grabit-api-00013-lkx`) "Resend send failed" -> empty ✅
- Cloud Run severity>=ERROR -> empty ✅
- 신규 revision 시작 시각: 2026-04-27 06:19:33Z UTC = 15:19:33 KST (`grabit-api-00013-lkx`)
- **Resend API direct smoke test:** id `4e53d589-8ea6-43b6-9ba0-66ff64a2a062`, to=sangwopark19icons@gmail.com, last_event=`delivered` ✅, **사용자 inbox 도착 확인 (spam 아님)** ✅ (2026-04-27 ~15:25 KST)
```

**Sign-off pattern** (lines 169-178):
```markdown
## Sign-off

- [x] Plan 02 Task 0/1/2/3 전부 PASS -- heygrabit.com Verified + audit shell 생성 (2026-04-27 11:41 KST)
- [x] Plan 03 Task 0/4 PASS, Tasks 1+2+5 SKIP (사실관계 변경 -- audit log 기록), pre-gate PASS, Cloud Run revision 갱신 PASS, smoke test PASS
- [~] Plan 03 Task 3 (3사 UAT) -- Gmail (직접 발송) ✅ inbox 수신 검증. Naver/Daum 은 운영 트래픽으로 자연 검증 (deferred, 48h window 동안 monitor)
- [x] **Resend API direct smoke test PASS** -- Gmail inbox 수신 확인 (2026-04-27 15:25 KST, spam 아님)
- [x] SC-2 baseline PASS (revision-scoped gcloud logging empty on `grabit-api-00013-lkx`)
- [x] 검증자: sangwopark19icons@gmail.com
- [x] 완료 날짜: 2026-04-27 (Wave 1+2 cutover 검증 완료, 48h 안정 관측 window 진행 중 ~2026-04-29)
```

**Planner instruction:** create Phase 18 UAT with sections for preconditions, production password reset email request, reset link open, confirm submit network evidence (`https://api.heygrabit.com/api/v1/auth/password-reset/confirm`), login success, Cloud Run/API log notes, and sign-off. Use the Phase 15 style but change checks to the full auth flow, not DNS cutover.

## Shared Patterns

### API Origin Contract

**Sources:** `apps/web/lib/api-client.ts`, `apps/web/lib/auth.ts`, `apps/web/components/auth/login-form.tsx`, `apps/web/next.config.ts`  
**Apply to:** `api-url.ts`, all changed web API callers, reset confirm raw fetch

```typescript
// Current duplicated pattern to replace with apiUrl(...)
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Existing local-dev rewrite target to preserve outside production only
{
  source: '/api/:path*',
  destination: 'http://localhost:8080/api/:path*',
}
```

Use a single helper so local dev can stay relative while production/preview uses the configured public API origin. Do not hard-code `https://api.heygrabit.com` inside component code.

### Authenticated API Error Handling

**Source:** `apps/web/lib/api-client.ts` lines 83-125  
**Apply to:** `api-client.ts` only; do not apply to reset confirm raw fetch

```typescript
if (res.status === 401 && accessToken) {
  const newToken = await refreshAccessToken();
  // retry or redirect to /auth
}

if (!res.ok) {
  // STATUS_MESSAGES + toast.error + ApiClientError
}
```

Reset confirm intentionally bypasses this because a 401 means invalid reset token, not expired logged-in session.

### Frontend Form Validation

**Source:** `apps/web/app/auth/reset-password/page.tsx` lines 53-58 and 161-166  
**Apply to:** reset password request/confirm code

```typescript
const form = useForm<ResetPasswordInput>({
  resolver: zodResolver(resetPasswordSchema),
  defaultValues: { token, newPassword: '', newPasswordConfirm: '' },
  mode: 'onBlur',
  reValidateMode: 'onChange',
});
```

Keep existing shared zod schemas from `@grabit/shared`; this phase does not need new validation libraries or DTO changes.

### Vitest Env and Module Isolation

**Source:** `apps/web/app/legal/__tests__/metadata.test.ts` lines 20-27 and 117-132  
**Apply to:** `api-url.test.ts`, `next-config.test.ts`, updated reset-password component test

```typescript
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('GRABIT_ENV', 'production');
});

afterEach(() => {
  vi.unstubAllEnvs();
});
```

Use dynamic imports after `vi.stubEnv()` whenever module code reads `process.env`.

### Manual Production Evidence

**Source:** `.planning/phases/15-resend-heygrabit-com-cutover-transactional-email-secret-mana/15-HUMAN-UAT.md` lines 55-82 and 169-178  
**Apply to:** `18-HUMAN-UAT.md`

```markdown
## SC-2: Silent failure 관측성 확인 (Sentry + Cloud Logging)

**Steps:**
1. UAT 트리거 (SC-1) 가 끝난 후 최소 2 분 경과
2. revision-scoped gcloud logging 쿼리 실행
3. 결과가 empty 여야 함
```

Phase 18 UAT should additionally record browser network host `api.heygrabit.com`, reset submit status, and login success after password change.

## No Analog Found

No file is fully without an analog. The only partial gap is that `apps/web/lib/api-url.ts` has no exact existing helper; use `apps/web/lib/api-client.ts` for the current API origin behavior, `apps/web/app/legal/robots.ts` for env-driven helper shape, and `18-RESEARCH.md` for the target contract.

## Metadata

**Analog search scope:** `apps/web/lib`, `apps/web/app/auth`, `apps/web/components/auth`, `apps/web/next.config.ts`, `apps/web/app/legal/__tests__`, Phase 15 UAT artifacts  
**Files scanned:** 23 web unit/component test files, 49 web auth/lib/app/component files, 1 Phase 15 UAT artifact  
**Key search terms:** `NEXT_PUBLIC_API_URL`, `vi.stubEnv`, `vi.resetModules`, `rewrites`, `localhost:8080`, `password-reset/confirm`, `HUMAN-UAT`  
**Pattern extraction date:** 2026-04-29  
**Output file:** `.planning/phases/18-password-reset-production-api-origin-fix/18-PATTERNS.md`

## PATTERN MAPPING COMPLETE
