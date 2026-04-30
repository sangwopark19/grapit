import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  withSentryConfig: (config: unknown) => config,
}));

async function loadRewrites() {
  vi.resetModules();
  const mod = await import('../../next.config');
  const nextConfig = mod.default as {
    rewrites?: () => unknown | Promise<unknown>;
  };

  if (typeof nextConfig.rewrites !== 'function') {
    throw new Error('nextConfig.rewrites must be a function');
  }

  return nextConfig.rewrites();
}

describe('nextConfig rewrites', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('does not route production API traffic to localhost', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const rewrites = await loadRewrites();

    expect(JSON.stringify(rewrites)).not.toContain('localhost:8080');
  });

  it('keeps local API and Socket.IO rewrites in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const rewrites = await loadRewrites();
    const serialized = JSON.stringify(rewrites);

    expect(serialized).toContain('localhost:8080/api/:path*');
    expect(serialized).toContain('localhost:8080/socket.io/:path*');
  });
});
