import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Two servers — api (8080) + web (3000). Playwright waits for both to be
  // ready before running tests. Locally, `reuseExistingServer: !CI` lets a
  // developer's already-running `pnpm dev` satisfy both checks. In CI, both
  // are spawned fresh.
  webServer: [
    {
      command: 'pnpm --filter @grapit/api dev',
      port: 8080,
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        // NestJS ConfigModule reads root .env locally; in CI these are
        // injected at job level and forwarded here.
        DATABASE_URL: process.env['DATABASE_URL'] ?? '',
        JWT_SECRET: process.env['JWT_SECRET'] ?? '',
        JWT_REFRESH_SECRET: process.env['JWT_REFRESH_SECRET'] ?? '',
        FRONTEND_URL: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
        NODE_ENV: process.env['NODE_ENV'] ?? 'test',
      },
    },
    {
      command: 'pnpm --filter @grapit/web dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        // Propagate Toss test key to the dev server so the SDK can initialize.
        // Phase 9 DEBT-05 / REVIEWS.md HIGH-01.
        NEXT_PUBLIC_TOSS_CLIENT_KEY:
          process.env['TOSS_CLIENT_KEY_TEST'] ??
          process.env['NEXT_PUBLIC_TOSS_CLIENT_KEY'] ??
          '',
      },
    },
  ],
});
