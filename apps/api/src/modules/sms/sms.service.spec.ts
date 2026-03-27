import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';

describe('SmsService', () => {
  describe('Production mode (Twilio mocked)', () => {
    let smsService: Awaited<ReturnType<typeof createProductionSmsService>>;
    let mockVerificationsCreate: ReturnType<typeof vi.fn>;
    let mockVerificationChecksCreate: ReturnType<typeof vi.fn>;

    async function createProductionSmsService() {
      const { SmsService } = await import('./sms.service.js');

      mockVerificationsCreate = vi.fn().mockResolvedValue({ status: 'pending', sid: 'VE123' });
      mockVerificationChecksCreate = vi.fn().mockResolvedValue({ status: 'approved' });

      const mockTwilioClient = {
        verify: {
          v2: {
            services: vi.fn().mockReturnValue({
              verifications: { create: mockVerificationsCreate },
              verificationChecks: { create: mockVerificationChecksCreate },
            }),
          },
        },
      };

      const mockConfigService = {
        get: vi.fn().mockImplementation((key: string) => {
          const config: Record<string, string> = {
            TWILIO_ACCOUNT_SID: 'AC_test_sid',
            TWILIO_AUTH_TOKEN: 'test_auth_token',
            TWILIO_VERIFY_SERVICE_SID: 'VA_test_service_sid',
            NODE_ENV: 'production',
          };
          return config[key];
        }),
      } as unknown as ConfigService;

      const service = new SmsService(mockConfigService);
      // Replace the internal Twilio client with the mock
      (service as any).twilioClient = mockTwilioClient;
      (service as any).verifySid = 'VA_test_service_sid';

      return service;
    }

    beforeEach(async () => {
      smsService = await createProductionSmsService();
    });

    it('should send verification code via Twilio and return success', async () => {
      const result = await smsService.sendVerificationCode('01012345678');

      expect(result.success).toBe(true);
      expect(result.message).toContain('인증번호');
      expect(mockVerificationsCreate).toHaveBeenCalledWith({
        to: '+8210-1234-5678',
        channel: 'sms',
      });
    });

    it('should verify code and return verified true when Twilio approves', async () => {
      const result = await smsService.verifyCode('01012345678', '123456');

      expect(result.verified).toBe(true);
      expect(mockVerificationChecksCreate).toHaveBeenCalledWith({
        to: '+8210-1234-5678',
        code: '123456',
      });
    });

    it('should return verified false when Twilio rejects the code', async () => {
      mockVerificationChecksCreate.mockResolvedValue({ status: 'pending' });

      const result = await smsService.verifyCode('01012345678', '999999');

      expect(result.verified).toBe(false);
      expect(result.message).toContain('인증번호가 일치하지 않습니다');
    });
  });

  describe('Dev mode (no Twilio credentials)', () => {
    let smsService: any;

    beforeEach(async () => {
      const { SmsService } = await import('./sms.service.js');

      const mockConfigService = {
        get: vi.fn().mockImplementation((key: string) => {
          const config: Record<string, string | undefined> = {
            TWILIO_ACCOUNT_SID: undefined,
            TWILIO_AUTH_TOKEN: undefined,
            TWILIO_VERIFY_SERVICE_SID: undefined,
            NODE_ENV: 'development',
          };
          return config[key];
        }),
      } as unknown as ConfigService;

      smsService = new SmsService(mockConfigService);
    });

    it('should return success without calling Twilio in dev mode', async () => {
      const result = await smsService.sendVerificationCode('01012345678');

      expect(result.success).toBe(true);
      expect(result.message).toContain('인증번호');
    });

    it('should accept 000000 as valid code in dev mode', async () => {
      const result = await smsService.verifyCode('01012345678', '000000');

      expect(result.verified).toBe(true);
    });

    it('should reject non-000000 codes in dev mode', async () => {
      const result = await smsService.verifyCode('01012345678', '123456');

      expect(result.verified).toBe(false);
      expect(result.message).toContain('인증번호가 일치하지 않습니다');
    });
  });
});
