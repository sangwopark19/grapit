import type { NextConfig } from 'next';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env from monorepo root (convention: single .env at monorepo root)
// Next.js only loads .env from its own project dir (apps/web/),
// so we manually load the root .env to populate process.env before config runs.
const rootEnvPath = resolve(__dirname, '../../.env');
try {
  const envContent = readFileSync(rootEnvPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch {
  // .env not found — ok in CI/production where env vars are injected directly
}

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
