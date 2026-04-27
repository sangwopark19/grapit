import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as Sentry from '@sentry/nestjs';
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

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL');
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    // Tighten production check: anything except development/test requires the key.
    // Prevents staging/preview environments (NODE_ENV=staging) from silently
    // falling back to dev-mock and writing reset tokens to shared logs.
    const isNonDev = nodeEnv !== 'development' && nodeEnv !== 'test';

    // Phase 7 REDIS_URL hard-fail 원칙 복제 (RESEARCH §Example 3).
    // Silent console.log fallback in production would swallow missed password
    // reset emails and make misconfiguration look like a transient issue.
    if (isNonDev && !apiKey) {
      throw new Error(
        '[email] RESEND_API_KEY is required outside development/test environments. ' +
          'Silent console.log fallback is disabled to prevent missed password reset emails. ' +
          'Check Cloud Run secret binding.',
      );
    }

    // REVIEWS.md MED: RESEND_FROM_EMAIL must also be hard-required outside dev/test.
    // onboarding@resend.dev fallback is dev-only (phishing + deliverability risk).
    if (isNonDev) {
      if (!fromEmail || !EMAIL_PATTERN.test(fromEmail)) {
        throw new Error(
          '[email] RESEND_FROM_EMAIL must be a valid email outside development/test. ' +
            `Received: ${fromEmail ?? '<unset>'}. ` +
            'Phishing/deliverability risk — configure a verified sender in Resend dashboard.',
        );
      }
      this.from = fromEmail;
    } else {
      this.from = fromEmail ?? 'onboarding@resend.dev';
    }

    if (apiKey === undefined) {
      this.resend = null;
      this.logger.warn('Email Service running in DEV MOCK mode (no RESEND_API_KEY)');
    } else {
      this.resend = new Resend(apiKey);
    }
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<SendEmailResult> {
    if (this.resend === null) {
      this.logger.log(`DEV EMAIL: password reset link for ${to}: ${resetLink}`);
      return { success: true };
    }

    // Resend returns { data, error } — it does NOT throw (RESEARCH §Pitfall 2).
    // Do not wrap in try/catch; branch on `error` instead.
    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: '[Grabit] 비밀번호 재설정',
      react: PasswordResetEmail({ resetLink }),
    });

    if (error) {
      this.logger.error(`Resend send failed for ${to}: ${error.message}`);
      // [Phase 15 D-11] auth.service intentionally swallows result for enumeration defense; capture here for ops visibility.
      Sentry.withScope((scope) => {
        scope.setTag('component', 'email-service');
        scope.setTag('provider', 'resend');
        scope.setLevel('error');
        scope.setContext('email', {
          from: this.from,
          toDomain: to.split('@')[1] ?? 'unknown',
        });
        Sentry.captureException(new Error(`Resend send failed: ${error.message}`));
      });
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  }
}
