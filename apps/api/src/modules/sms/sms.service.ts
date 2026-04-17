import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Twilio from 'twilio';

export interface SendResult {
  success: boolean;
  message: string;
}

export interface VerifyResult {
  verified: boolean;
  message?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly twilioClient: Twilio.Twilio | null;
  private readonly verifySid: string;
  private readonly isDevMode: boolean;

  constructor(private readonly configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.verifySid = this.configService.get<string>('TWILIO_VERIFY_SERVICE_SID') ?? '';
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    // Dev mock mode: no Twilio credentials or development environment without SID
    this.isDevMode = !accountSid || (nodeEnv === 'development' && !accountSid);

    if (this.isDevMode) {
      this.twilioClient = null;
      this.logger.warn('SMS Service running in DEV MOCK mode (no Twilio credentials)');
    } else {
      this.twilioClient = Twilio(accountSid!, authToken!);
    }
  }

  /**
   * Normalize Korean phone number to E.164 format.
   * 01012345678 -> +821012345678
   * Already E.164 format passes through.
   */
  private normalizePhone(phone: string): string {
    // Remove all non-digit characters except leading +
    const cleaned = phone.replace(/[^+\d]/g, '');

    // Already in E.164 format
    if (cleaned.startsWith('+')) {
      return cleaned;
    }

    // Korean number starting with 0: replace leading 0 with +82
    if (cleaned.startsWith('0')) {
      return `+82${cleaned.slice(1)}`;
    }

    // Fallback: assume Korean number
    return `+82${cleaned}`;
  }

  async sendVerificationCode(phone: string): Promise<SendResult> {
    const normalizedPhone = this.normalizePhone(phone);

    // Dev mock mode
    if (this.isDevMode) {
      this.logger.log(`DEV SMS: code 000000 sent to ${normalizedPhone}`);
      return {
        success: true,
        message: '인증번호가 발송되었습니다',
      };
    }

    // Production mode with Twilio
    try {
      await this.twilioClient!.verify.v2
        .services(this.verifySid)
        .verifications.create({
          to: normalizedPhone,
          channel: 'sms',
        });

      return {
        success: true,
        message: '인증번호가 발송되었습니다',
      };
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${normalizedPhone}`, error);
      throw new BadRequestException('인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  }

  async verifyCode(phone: string, code: string): Promise<VerifyResult> {
    const normalizedPhone = this.normalizePhone(phone);

    // Dev mock mode: accept 000000 as universal valid code
    if (this.isDevMode) {
      if (code === '000000') {
        return { verified: true };
      }
      return {
        verified: false,
        message: '인증번호가 일치하지 않습니다',
      };
    }

    // Production mode with Twilio
    try {
      const check = await this.twilioClient!.verify.v2
        .services(this.verifySid)
        .verificationChecks.create({
          to: normalizedPhone,
          code,
        });

      if (check.status === 'approved') {
        return { verified: true };
      }

      return {
        verified: false,
        message: '인증번호가 일치하지 않습니다',
      };
    } catch (error) {
      this.logger.error(`Failed to verify code for ${normalizedPhone}`, error);
      return {
        verified: false,
        message: '인증번호 확인에 실패했습니다. 잠시 후 다시 시도해주세요.',
      };
    }
  }
}
