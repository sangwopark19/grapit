import type { NextConfig } from 'next';
import { resolve } from 'path';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.0.78'],
  output: 'standalone',
  transpilePackages: ['@grapit/shared'],
  turbopack: {
    root: resolve(__dirname, '../../'),
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8080/api/:path*',
      },
    ];
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
