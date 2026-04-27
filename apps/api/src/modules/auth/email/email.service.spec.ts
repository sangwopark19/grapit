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

vi.mock('@sentry/nestjs', () => {
  const captureExceptionMock = vi.fn();
  const scopeStub = {
    setTag: vi.fn(),
    setLevel: vi.fn(),
    setContext: vi.fn(),
  };
  const withScopeMock = vi.fn((cb: (scope: typeof scopeStub) => void) => {
    cb(scopeStub);
  });
  return {
    captureException: captureExceptionMock,
    withScope: withScopeMock,
    __captureExceptionMock: captureExceptionMock,
    __withScopeMock: withScopeMock,
    __scopeStub: scopeStub,
  };
});

import * as resendModule from 'resend';
import * as sentryModule from '@sentry/nestjs';

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
  const sentryMod = sentryModule as unknown as {
    __captureExceptionMock: ReturnType<typeof vi.fn>;
    __withScopeMock: ReturnType<typeof vi.fn>;
    __scopeStub: {
      setTag: ReturnType<typeof vi.fn>;
      setLevel: ReturnType<typeof vi.fn>;
      setContext: ReturnType<typeof vi.fn>;
    };
  };

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
    expect(sentryMod.__captureExceptionMock).not.toHaveBeenCalled();
  });

  it('PROD mode: RESEND_API_KEY + RESEND_FROM_EMAIL set + NODE_ENV=production → calls Resend.emails.send with react template and correct from', async () => {
    const config = makeConfig({
      RESEND_API_KEY: 're_test_key',
      RESEND_FROM_EMAIL: 'no-reply@heygrabit.com',
      NODE_ENV: 'production',
    });
    const mod = resendModule as unknown as { __sendMock: ReturnType<typeof vi.fn> };
    mod.__sendMock.mockResolvedValueOnce({ data: { id: 'mock-id' }, error: null });

    const svc = new EmailService(config);
    const result = await svc.sendPasswordResetEmail('user@example.com', 'https://app.test/reset?t=abc');

    expect(mod.__sendMock).toHaveBeenCalledTimes(1);
    const callArg = mod.__sendMock.mock.calls[0]?.[0] as { from: string; to: string; subject: string; react: unknown };
    expect(callArg.from).toBe('no-reply@heygrabit.com');
    expect(callArg.to).toBe('user@example.com');
    expect(callArg.subject).toContain('비밀번호 재설정');
    expect(callArg.react).toBeDefined();
    expect(result).toEqual({ success: true, id: 'mock-id' });
    expect(sentryMod.__captureExceptionMock).not.toHaveBeenCalled();
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
      RESEND_FROM_EMAIL: 'no-reply@heygrabit.com',
      NODE_ENV: 'production',
    });
    const mod = resendModule as unknown as { __sendMock: ReturnType<typeof vi.fn> };
    mod.__sendMock.mockResolvedValueOnce({ data: null, error: { message: 'rate limit exceeded' } });

    const svc = new EmailService(config);
    const result = await svc.sendPasswordResetEmail('user@example.com', 'https://app.test/reset?t=abc');

    expect(result).toEqual({ success: false, error: 'rate limit exceeded' });
  });

  it('PROD SDK error: Sentry.captureException called with Error wrapping Resend error.message', async () => {
    const config = makeConfig({
      RESEND_API_KEY: 're_test_key',
      RESEND_FROM_EMAIL: 'no-reply@heygrabit.com',
      NODE_ENV: 'production',
    });
    const mod = resendModule as unknown as { __sendMock: ReturnType<typeof vi.fn> };
    mod.__sendMock.mockResolvedValueOnce({ data: null, error: { message: 'rate limit exceeded' } });

    const svc = new EmailService(config);
    await svc.sendPasswordResetEmail('user@example.com', 'https://app.test/reset?t=abc');

    expect(sentryMod.__withScopeMock).toHaveBeenCalledTimes(1);
    expect(sentryMod.__captureExceptionMock).toHaveBeenCalledTimes(1);
    const capturedArg = sentryMod.__captureExceptionMock.mock.calls[0]?.[0];
    expect(capturedArg).toBeInstanceOf(Error);
    expect((capturedArg as Error).message).toContain('Resend send failed');
    expect((capturedArg as Error).message).toContain('rate limit exceeded');
  });

  it('PROD SDK error: PII masking — setContext receives toDomain only, not full address', async () => {
    const config = makeConfig({
      RESEND_API_KEY: 're_test_key',
      RESEND_FROM_EMAIL: 'no-reply@heygrabit.com',
      NODE_ENV: 'production',
    });
    const mod = resendModule as unknown as { __sendMock: ReturnType<typeof vi.fn> };
    mod.__sendMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const svc = new EmailService(config);
    await svc.sendPasswordResetEmail('user@example.com', 'https://app.test/reset?t=abc');

    expect(sentryMod.__scopeStub.setContext).toHaveBeenCalledWith('email', {
      from: 'no-reply@heygrabit.com',
      toDomain: 'example.com',
    });
    const allSetContextCalls = sentryMod.__scopeStub.setContext.mock.calls;
    const allSetTagCalls = sentryMod.__scopeStub.setTag.mock.calls;
    const serialized = JSON.stringify([allSetContextCalls, allSetTagCalls]);
    expect(serialized).not.toContain('user@example.com');
    expect(sentryMod.__scopeStub.setTag).toHaveBeenCalledWith('component', 'email-service');
    expect(sentryMod.__scopeStub.setTag).toHaveBeenCalledWith('provider', 'resend');
    expect(sentryMod.__scopeStub.setLevel).toHaveBeenCalledWith('error');
  });
});
