import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * Integration test config for tests that spin up real Valkey/Redis containers
 * via testcontainers. Run with `pnpm test:integration`.
 *
 * These tests require Docker to be running on the host. CI/CD should only
 * invoke them on branches/workflows where Docker-in-Docker is available.
 * The default `pnpm test` script uses vitest.config.ts which excludes them
 * so that the unit-test feedback loop stays fast.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    root: './src',
    hookTimeout: 120000, // testcontainers pull + startup can take ~60s on cold cache
    testTimeout: 60000,
    include: ['**/*.integration.spec.ts'],
  },
  resolve: {
    alias: {
      '@grapit/shared': resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
