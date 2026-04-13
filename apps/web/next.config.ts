import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
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

const r2Hostname = process.env.NEXT_PUBLIC_R2_HOSTNAME;

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.0.78', 'craig-paravail-yee.ngrok-free.dev'],
  output: 'standalone',
  outputFileTracingRoot: resolve(__dirname, '../../'),
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
      {
        source: '/socket.io/:path*',
        destination: 'http://localhost:8080/socket.io/:path*',
      },
    ];
  },
  images: {
    unoptimized: process.env.NODE_ENV !== 'production',
    remotePatterns: [
      ...(r2Hostname
        ? [{ protocol: 'https' as const, hostname: r2Hostname }]
        : []),
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
