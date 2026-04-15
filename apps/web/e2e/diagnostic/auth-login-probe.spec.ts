import { test, request as playwrightRequest } from '@playwright/test';

test('diagnostic: POST /auth/login via playwrightRequest.newContext()', async () => {
  const email = process.env['TEST_USER_EMAIL'] ?? 'admin@grapit.test';
  const password = process.env['TEST_USER_PASSWORD'] ?? 'TestAdmin2026!';
  const apiURL = process.env['E2E_API_URL'] ?? 'http://localhost:8080';
  const loginURL = `${apiURL}/api/v1/auth/login`;

  const ctx = await playwrightRequest.newContext();
  const res = await ctx.post(loginURL, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    data: { email, password },
  });
  const status = res.status();
  const body = await res.text().catch(() => '<unreadable>');
  const headers = res.headers();
  console.log(`[PROBE] status=${status}`);
  console.log(`[PROBE] body=${body}`);
  console.log(`[PROBE] headers=${JSON.stringify(headers)}`);
  await ctx.dispose();
});
