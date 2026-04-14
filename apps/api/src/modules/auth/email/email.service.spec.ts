import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service.js';

// Mock the resend module — hoisted by vitest so the import in email.service picks up the mock
vi.mock('resend', () => {
  const sendMock = vi.fn();
  return {
    Resend: vi.fn().mockImplementation(() => ({
      emails: { send: sendMock },
    })),
    __sendMock: sendMock,
  };
});

import * as resendModule from 'resend';

function makeConfig(env: Record<string, string | undefined>): ConfigService {
  return {
    get: vi.fn(<T>(key: string, defaultValue?: T): T | undefined => {
      const v = env[key];
      return (v !== undefined ? v : defaultValue) as T | undefined;
    }),
  } as unknown as ConfigService;
}

describe('EmailService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('DEV mode: no RESEND_API_KEY + NODE_ENV=development → returns success without calling Resend', async () => {
    const config = makeConfig({ NODE_ENV: 'development' });
    const svc = new EmailService(config);
    const result = await svc.sendPasswordResetEmail('user@example.com', 'https://app.test/reset?t=abc');
    expect(result).toEqual({ success: true });
    expect((resendModule as unknown as { Resend: ReturnType<typeof vi.fn> }).Resend).not.toHaveBeenCalled();
  });

  it('PROD mode: RESEND_API_KEY + RESEND_FROM_EMAIL set + NODE_ENV=production → calls Resend.emails.send with react template and correct from', async () => {
    const config = makeConfig({
      RESEND_API_KEY: 're_test_key',
      RESEND_FROM_EMAIL: 'no-reply@grapit.com',
      NODE_ENV: 'production',
    });
    const mod = resendModule as unknown as { __sendMock: ReturnType<typeof vi.fn> };
    mod.__sendMock.mockResolvedValueOnce({ data: { id: 'mock-id' }, error: null });

    const svc = new EmailService(config);
    const result = await svc.sendPasswordResetEmail('user@example.com', 'https://app.test/reset?t=abc');

    expect(mod.__sendMock).toHaveBeenCalledTimes(1);
    const callArg = mod.__sendMock.mock.calls[0]?.[0] as { from: string; to: string; subject: string; react: unknown };
    expect(callArg.from).toBe('no-reply@grapit.com');
    expect(callArg.to).toBe('user@example.com');
    expect(callArg.subject).toContain('비밀번호 재설정');
    expect(callArg.react).toBeDefined();
    expect(result).toEqual({ success: true, id: 'mock-id' });
  });

  it('PROD misconfig (API_KEY): no RESEND_API_KEY + NODE_ENV=production → throws on construction', () => {
    const config = makeConfig({ NODE_ENV: 'production' });
    expect(() => new EmailService(config)).toThrow(/RESEND_API_KEY is required in production/);
  });

  it('PROD misconfig (FROM_EMAIL unset): RESEND_API_KEY set + RESEND_FROM_EMAIL unset + NODE_ENV=production → throws on construction', () => {
    const config = makeConfig({ RESEND_API_KEY: 're_test_key', NODE_ENV: 'production' });
    expect(() => new EmailService(config)).toThrow(/RESEND_FROM_EMAIL must be a valid email in production/);
  });

  it('PROD misconfig (FROM_EMAIL invalid): RESEND_API_KEY set + RESEND_FROM_EMAIL is not an email + NODE_ENV=production → throws on construction', () => {
    const config = makeConfig({
      RESEND_API_KEY: 're_test_key',
      RESEND_FROM_EMAIL: 'not-an-email',
      NODE_ENV: 'production',
    });
    expect(() => new EmailService(config)).toThrow(/RESEND_FROM_EMAIL must be a valid email in production/);
  });

  it('PROD SDK error: Resend returns { error } → returns { success: false, error }', async () => {
    const config = makeConfig({
      RESEND_API_KEY: 're_test_key',
      RESEND_FROM_EMAIL: 'no-reply@grapit.com',
      NODE_ENV: 'production',
    });
    const mod = resendModule as unknown as { __sendMock: ReturnType<typeof vi.fn> };
    mod.__sendMock.mockResolvedValueOnce({ data: null, error: { message: 'rate limit exceeded' } });

    const svc = new EmailService(config);
    const result = await svc.sendPasswordResetEmail('user@example.com', 'https://app.test/reset?t=abc');

    expect(result).toEqual({ success: false, error: 'rate limit exceeded' });
  });
});
