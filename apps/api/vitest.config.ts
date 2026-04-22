import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    root: './src',
    hookTimeout: 30000,
    testTimeout: 30000,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.integration.spec.ts',
    ],
  },
  resolve: {
    alias: {
      '@grabit/shared': resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
