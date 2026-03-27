import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    root: './src',
  },
  resolve: {
    alias: {
      '@grapit/shared': resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
