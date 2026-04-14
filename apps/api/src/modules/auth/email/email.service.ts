import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PasswordResetEmail } from './templates/password-reset.js';

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly isDevMode: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL');
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const isProd = nodeEnv === 'production';

    // Phase 7 REDIS_URL hard-fail 원칙 복제 (RESEARCH §Example 3).
    // Silent console.log fallback in production would swallow missed password
    // reset emails and make misconfiguration look like a transient issue.
    if (isProd && !apiKey) {
      throw new Error(
        '[email] RESEND_API_KEY is required in production environment. ' +
          'Silent console.log fallback is disabled to prevent missed password reset emails. ' +
          'Check Cloud Run secret binding.',
      );
    }

    // REVIEWS.md MED: RESEND_FROM_EMAIL must also be hard-required in production.
    // onboarding@resend.dev fallback is dev-only (phishing + deliverability risk).
    if (isProd) {
      if (!fromEmail || !EMAIL_PATTERN.test(fromEmail)) {
        throw new Error(
          '[email] RESEND_FROM_EMAIL must be a valid email in production. ' +
            `Received: ${fromEmail ?? '<unset>'}. ` +
            'Phishing/deliverability risk — configure a verified sender in Resend dashboard.',
        );
      }
      this.from = fromEmail;
    } else {
      this.from = fromEmail ?? 'onboarding@resend.dev';
    }

    this.isDevMode = !apiKey;
    if (this.isDevMode) {
      this.resend = null;
      this.logger.warn('Email Service running in DEV MOCK mode (no RESEND_API_KEY)');
    } else {
      this.resend = new Resend(apiKey!);
    }
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<SendEmailResult> {
    if (this.isDevMode) {
      this.logger.log(`DEV EMAIL: password reset link for ${to}: ${resetLink}`);
      return { success: true };
    }

    // Resend returns { data, error } — it does NOT throw (RESEARCH §Pitfall 2).
    // Do not wrap in try/catch; branch on `error` instead.
    const { data, error } = await this.resend!.emails.send({
      from: this.from,
      to,
      subject: '[Grapit] 비밀번호 재설정',
      react: PasswordResetEmail({ resetLink }),
    });

    if (error) {
      this.logger.error(`Resend send failed for ${to}: ${error.message}`);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  }
}
