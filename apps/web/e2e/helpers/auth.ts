import { request as playwrightRequest } from '@playwright/test';
import type { Page } from '@playwright/test';

interface LoginResponse {
  accessToken: string;
  user: { id: string; email: string; name: string; role: 'user' | 'admin' };
}

/**
 * Log the test user in via the real POST /api/v1/auth/login endpoint and propagate
 * the resulting httpOnly refreshToken cookie into the Playwright browser context.
 *
 * Implementation notes:
 * - `useAuthStore` in apps/web/stores/use-auth-store.ts does NOT use zustand
 *   `persist`. Attempting to seed accessToken via localStorage has no effect.
 *   Instead, the client-side `AuthInitializer` (apps/web/components/auth/
 *   auth-initializer.tsx) calls `initializeAuth()` on first render, which POSTs
 *   /api/v1/auth/refresh using the httpOnly refreshToken cookie and then hydrates
 *   the store via setAuth. Therefore we only need to land the refreshToken cookie
 *   in page.context() before navigation; the store will be initialized naturally.
 * - Playwright's `page.request` fixture shares cookie storage with the browser
 *   context, so Set-Cookie from the login response flows through automatically.
 *
 * Env: TEST_USER_EMAIL / TEST_USER_PASSWORD. If unset, falls back to the admin
 * seed credentials from apps/api/src/database/seed.mjs:39-50.
 *
 * Blocker B2 (revision-2): previous implementation left page.context().addCookies([])
 * empty, which caused /booking/[id]/complete → /auth redirect and permanently stuck
 * `confirmIntercepted` at false.
 */
export async function loginAsTestUser(page: Page): Promise<void> {
  const email = process.env['TEST_USER_EMAIL'] ?? 'admin@grapit.test';
  const password = process.env['TEST_USER_PASSWORD'] ?? 'TestAdmin2026!';

  // Hit the API directly (bypass Next.js rewrites). Next.js 16 dev-mode
  // rewrites do not reliably forward POST bodies, causing passport-local
  // to receive empty credentials and return 401 even when the user exists.
  // Cookies with domain=localhost are port-agnostic in the Playwright
  // browser context, so the refreshToken set by :8080 is still visible to
  // :3000 pages (verified via context().cookies() check below).
  const apiURL = process.env['E2E_API_URL'] ?? 'http://localhost:8080';

  // 1. Hit the real login endpoint via an INDEPENDENT request context.
  // Using `page.request` (which shares state with the browser context)
  // produced a Passport-level "Unauthorized" — body wasn't reaching
  // req.body.email/password. A fresh request.newContext() bypasses any
  // browser-origin-bound header mangling and matches the shape curl uses.
  const loginURL = `${apiURL}/api/v1/auth/login`;
  console.log(`[loginAsTestUser] POST ${loginURL} email=${email}`);
  const requestCtx = await playwrightRequest.newContext();
  const res = await requestCtx.post(loginURL, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    data: { email, password },
  });
  if (!res.ok()) {
    const body = await res.text().catch(() => '<unable to read body>');
    const resHeaders = res.headers();
    throw new Error(
      `[loginAsTestUser] Login failed: ${res.status()} ${res.statusText()}.\n` +
        `  URL: ${loginURL}\n` +
        `  Response body: ${body}\n` +
        `  Response headers: ${JSON.stringify(resHeaders)}\n` +
        `  Hint: Run 'pnpm --filter @grapit/api seed' and ensure TEST_USER_* env matches seed.mjs:39-50.`,
    );
  }
  (await res.json()) as LoginResponse;

  // 2. Copy refreshToken from the isolated requestCtx storage into the
  //    browser context that the page uses. Since the login was made with
  //    a fresh context, its Set-Cookie landed only there; we must replay
  //    it on page.context() so AuthInitializer can exchange it on mount.
  const rawStorage = await requestCtx.storageState();
  const refreshFromApi = rawStorage.cookies.find(
    (c) => c.name === 'refreshToken',
  );
  await requestCtx.dispose();

  if (!refreshFromApi) {
    throw new Error(
      '[loginAsTestUser] refreshToken cookie missing after login — check auth.controller.ts setRefreshTokenCookie.',
    );
  }

  // Replay onto the browser context with domain=localhost (port-agnostic)
  // so it's visible to both :3000 (web) and :8080 (api) page navigations.
  await page.context().addCookies([
    {
      name: refreshFromApi.name,
      value: refreshFromApi.value,
      domain: 'localhost',
      path: '/',
      httpOnly: refreshFromApi.httpOnly,
      secure: refreshFromApi.secure,
      sameSite: refreshFromApi.sameSite,
      expires: refreshFromApi.expires,
    },
  ]);
  // AuthInitializer will now POST /api/v1/auth/refresh on first page render,
  // exchange the refreshToken cookie for a fresh accessToken, and call setAuth.
}
