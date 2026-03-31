import type { NextConfig } from 'next';
import { resolve } from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@grapit/shared'],
  turbopack: {
    root: resolve(__dirname, '../../'),
  },
  images: {
    unoptimized: process.env.NODE_ENV !== 'production',
    remotePatterns: [
      // Production: R2 CDN domain (add when R2 is configured)
      // { protocol: 'https', hostname: 'cdn.grapit.kr' },
    ],
  },
};

export default nextConfig;
