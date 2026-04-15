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

  // 1. Hit the real login endpoint via the shared request fixture.
  const res = await page.request.post(`${apiURL}/api/v1/auth/login`, {
    data: { email, password },
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok()) {
    throw new Error(
      `[loginAsTestUser] Login failed: ${res.status()} ${res.statusText()}. ` +
        `Run 'pnpm --filter @grapit/api seed' and ensure TEST_USER_* env matches seed.mjs:39-50.`,
    );
  }
  // Touch the body once to make sure the response is fully consumed before we
  // inspect cookies (otherwise the Set-Cookie header may not have landed in
  // storage state yet on some platforms).
  (await res.json()) as LoginResponse;

  // 2. Verify refreshToken cookie landed in the shared browser context. If it
  //    did not, AuthGuard will redirect /booking/.../complete to /auth and the
  //    confirm API intercept will never fire.
  const cookies = await page.context().cookies();
  const refresh = cookies.find((c) => c.name === 'refreshToken');
  if (!refresh) {
    throw new Error(
      '[loginAsTestUser] refreshToken cookie missing after login — check auth.controller.ts setRefreshTokenCookie.',
    );
  }
  // AuthInitializer will now POST /api/v1/auth/refresh on first page render,
  // exchange the refreshToken cookie for a fresh accessToken, and call setAuth.
  // AuthGuard then allows the protected page to mount.
}
