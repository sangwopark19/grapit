import type { NextConfig } from 'next';
import { resolve } from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@grapit/shared'],
  turbopack: {
    root: resolve(__dirname, '../../'),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8080',
        pathname: '/api/v1/admin/upload/local/**',
      },
    ],
  },
};

export default nextConfig;
