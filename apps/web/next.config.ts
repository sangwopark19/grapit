import type { NextConfig } from 'next';
import { resolve } from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@grapit/shared'],
  turbopack: {
    root: resolve(__dirname, '../../'),
  },
};

export default nextConfig;
