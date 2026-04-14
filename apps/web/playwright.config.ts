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
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env['CI'],
    env: {
      // Propagate Toss test key to the dev server so the SDK can initialize.
      // Phase 9 DEBT-05 / REVIEWS.md HIGH-01.
      NEXT_PUBLIC_TOSS_CLIENT_KEY:
        process.env['TOSS_CLIENT_KEY_TEST'] ??
        process.env['NEXT_PUBLIC_TOSS_CLIENT_KEY'] ??
        '',
    },
  },
});
