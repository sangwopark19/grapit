import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.provider.js';
import * as schema from '../../database/schema/index.js';
import { UserRepository } from '../user/user.repository.js';
import { SmsService } from '../sms/sms.service.js';
import { EmailService } from './email/email.service.js';
import type { RegisterBody } from './dto/register.dto.js';
import type { SocialRegisterBody } from './dto/social-register.dto.js';
import type { SocialProfile } from './interfaces/social-profile.interface.js';
import type { UserProfile } from '@grapit/shared/types/user.types.js';
import type { SocialAuthResult } from '@grapit/shared/types/auth.types.js';
import {
  REFRESH_TOKEN_EXPIRY_DAYS,
} from '@grapit/shared/constants/index.js';

// UUID v4 형식 검증용 regex. resetPassword 경로에서 DB lookup 전
// sub 클레임이 실제 UUID임을 보장하여 payload-amplification DoS와
// PostgreSQL 22P02(invalid uuid) 예외 누출을 차단한다.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ValidatedUser {
  id: string;
  email: string;
  role: string;
  name: string;
  phone: string;
  gender: 'male' | 'female' | 'unspecified';
  country: string;
  birthDate: string;
  isPhoneVerified: boolean;
  createdAt: Date;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AuthResult extends TokenPair {
  user: UserProfile;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userRepository: UserRepository,
    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async register(dto: RegisterBody): Promise<AuthResult> {
    // 0. Verify phone number
    const verifyResult = await this.smsService.verifyCode(dto.phone, dto.phoneVerificationCode);
    if (!verifyResult.verified) {
      throw new BadRequestException('전화번호 인증이 완료되지 않았습니다');
    }

    // 1. Check email uniqueness
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('이미 사용 중인 이메일입니다');
    }

    // 2. Hash password with argon2id
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    // 3. Insert user
    const user = await this.userRepository.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      phone: dto.phone,
      gender: dto.gender,
      country: dto.country,
      birthDate: dto.birthDate,
      marketingConsent: dto.marketingConsent,
      isPhoneVerified: true,
    });

    // 4. Insert terms agreement
    await this.db.insert(schema.termsAgreements).values({
      userId: user.id,
      termsOfService: dto.termsOfService,
      privacyPolicy: dto.privacyPolicy,
      marketingConsent: dto.marketingConsent,
    });

    // 5-6. Generate tokens
    const tokens = await this.generateTokenPair(user.id, user.email, user.role);

    // 7. Return AuthResult
    return {
      ...tokens,
      user: this.mapToProfile(user),
    };
  }

  async login(user: ValidatedUser): Promise<AuthResult> {
    const tokens = await this.generateTokenPair(user.id, user.email, user.role);

    return {
      ...tokens,
      user: this.mapToProfile(user),
    };
  }

  async validateUser(email: string, password: string): Promise<ValidatedUser> {
    const user = await this.userRepository.findByEmail(email);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 일치하지 않습니다');
    }

    const isValid = await argon2.verify(user.passwordHash, password);
    if (!isValid) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 일치하지 않습니다');
    }

    // Return user without passwordHash
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword as ValidatedUser;
  }

  async refreshTokens(
    oldRawToken: string,
  ): Promise<TokenPair> {
    // 1. Hash the incoming raw token
    const tokenHash = createHash('sha256').update(oldRawToken).digest('hex');

    // 2. Find refresh token by hash
    const tokens = await this.db
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.tokenHash, tokenHash));

    const tokenRecord = tokens[0];

    // 3. Token not found
    if (!tokenRecord) {
      throw new UnauthorizedException('유효하지 않은 리프레시 토큰입니다');
    }

    // 4. Token already revoked -- possible theft! Revoke entire family
    if (tokenRecord.revokedAt) {
      await this.db
        .update(schema.refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(schema.refreshTokens.family, tokenRecord.family));

      throw new UnauthorizedException('토큰이 재사용되었습니다. 보안을 위해 모든 세션이 종료됩니다.');
    }

    // 5. Check expiration
    if (tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('리프레시 토큰이 만료되었습니다');
    }

    // 6. Revoke old token
    await this.db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(schema.refreshTokens.id, tokenRecord.id));

    // 7. Generate new refresh token with same family
    const newRawToken = randomBytes(32).toString('hex');
    const newTokenHash = createHash('sha256').update(newRawToken).digest('hex');

    await this.db.insert(schema.refreshTokens).values({
      userId: tokenRecord.userId,
      tokenHash: newTokenHash,
      family: tokenRecord.family,
      expiresAt: new Date(
        Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      ),
    });

    // 8. Fetch current user for up-to-date role/email
    const user = await this.userRepository.findById(tokenRecord.userId);
    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다');
    }

    // 9. Generate new access token with full claims
    const accessToken = await this.jwtService.signAsync({
      sub: tokenRecord.userId,
      email: user.email,
      role: user.role,
    });

    return { accessToken, refreshToken: newRawToken };
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    await this.db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(schema.refreshTokens.tokenHash, tokenHash));
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);

    // 소셜 전용 계정(passwordHash === null)은 리셋 링크를 발송하지 않는다.
    // - 발송 시: 유저가 링크를 따라 비밀번호를 설정하면 소셜 전용 → 비밀번호 계정으로
    //   의도치 않게 전환되고, 첫 회전 entropy 가 빈 문자열이 되어 one-time 토큰 보장이 약화된다.
    // - 미발송 시: enumeration 방지를 위해 에러를 노출하지 않고 silent return.
    // 유저에게 "소셜로 로그인하세요" UX는 프론트엔드 레벨에서 별도로 제공되어야 한다.
    if (!user || !user.passwordHash) {
      return;
    }

    // Generate reset token with user's password hash as additional entropy
    const secret =
      this.configService.get<string>('auth.jwtSecret') + user.passwordHash;

    const resetToken = await this.jwtService.signAsync(
      { sub: user.id, purpose: 'password-reset' },
      { secret, expiresIn: '1h' },
    );

    // Dispatch reset link via EmailService (dev: console.log mock, prod: Resend).
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const resetLink = `${frontendUrl}/auth/reset-password?token=${resetToken}`;

    await this.emailService.sendPasswordResetEmail(email, resetLink);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // 1. Preliminary verify: jwtSecret-only 서명 검증으로 위조 토큰을 DB lookup 전에 차단한다.
    //    ignoreExpiration: true 는 secret 회전(passwordHash 포함) 재검증을 아래 3단계에서 수행하기 위한 의도적 허용이다.
    //    이 단계에서 서명이 실패하면(공격자가 임의 payload를 base64 인코딩한 위조 토큰) 즉시 401을 던져
    //    payload-amplification DoS와 DB 에러(22P02 invalid uuid) 누출을 모두 방지한다.
    const jwtSecret = this.configService.get<string>('auth.jwtSecret');
    if (!jwtSecret) {
      // 설정 누락은 500이 적절하지만, 외부에 상태를 알리지 않도록 401로 통일.
      throw new UnauthorizedException('유효하지 않은 재설정 토큰입니다');
    }

    let preliminarySub: string;
    try {
      const decoded = await this.jwtService.verifyAsync<{ sub: unknown }>(
        token,
        { secret: jwtSecret, ignoreExpiration: true },
      );
      if (typeof decoded.sub !== 'string' || !UUID_REGEX.test(decoded.sub)) {
        throw new Error('invalid sub');
      }
      preliminarySub = decoded.sub;
    } catch {
      throw new UnauthorizedException('유효하지 않은 재설정 토큰입니다');
    }

    // 2. sub가 UUID로 확정된 뒤에만 DB lookup 수행.
    const user = await this.userRepository.findById(preliminarySub);
    if (!user) {
      throw new UnauthorizedException('유효하지 않은 재설정 토큰입니다');
    }

    // 3. 최종 검증: jwtSecret + passwordHash 로 서명 + 만료 재확인.
    //    passwordHash가 바뀌면 이 단계에서 실패 → one-time token 불변조건 유지.
    const secret = jwtSecret + (user.passwordHash ?? '');

    let payload: { sub: string; purpose: string };
    try {
      payload = await this.jwtService.verifyAsync<{
        sub: string;
        purpose: string;
      }>(token, { secret });
    } catch {
      throw new UnauthorizedException('유효하지 않은 재설정 토큰입니다');
    }

    if (payload.purpose !== 'password-reset') {
      throw new UnauthorizedException('유효하지 않은 재설정 토큰입니다');
    }

    // 4. Hash new password
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    // 5. Update password
    await this.userRepository.updatePassword(payload.sub, passwordHash);

    // 6. Revoke all refresh tokens (force re-login)
    await this.db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(schema.refreshTokens.userId, payload.sub));
  }

  // -- Social auth methods --

  async findOrCreateSocialUser(profile: SocialProfile): Promise<SocialAuthResult> {
    this.logger.log(`findOrCreateSocialUser: provider=${profile.provider}, providerId=${profile.providerId}`);

    // 1. Look up social_accounts by (provider, providerId)
    const existingSocial = await this.db
      .select()
      .from(schema.socialAccounts)
      .where(
        and(
          eq(schema.socialAccounts.provider, profile.provider),
          eq(schema.socialAccounts.providerId, profile.providerId),
        ),
      );

    const socialAccount = existingSocial[0];

    // 2. If found: user already registered, generate JWT tokens
    if (socialAccount) {
      this.logger.log(`Social user found: userId=${socialAccount.userId}`);
      const user = await this.userRepository.findById(socialAccount.userId);
      if (!user) {
        throw new UnauthorizedException('연결된 사용자 계정을 찾을 수 없습니다');
      }

      const tokens = await this.generateTokenPair(user.id, user.email, user.role);

      return {
        status: 'authenticated',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: this.mapToProfile(user),
      };
    }

    // 3. Not found -- generate registrationToken for frontend to collect additional info
    this.logger.log(`New social user, registration required: provider=${profile.provider}`);
    const registrationToken = await this.jwtService.signAsync(
      {
        provider: profile.provider,
        providerId: profile.providerId,
        email: profile.email,
        name: profile.name,
        purpose: 'social-registration',
      },
      { expiresIn: '30m' },
    );

    return {
      status: 'needs_registration',
      registrationToken,
      socialProfile: {
        provider: profile.provider,
        providerId: profile.providerId,
        email: profile.email,
        name: profile.name,
      },
    };
  }

  async completeSocialRegistration(
    registrationToken: string,
    dto: SocialRegisterBody,
  ): Promise<AuthResult> {
    this.logger.log('completeSocialRegistration: started');

    // 0. Verify phone number
    const verifyResult = await this.smsService.verifyCode(dto.phone, dto.phoneVerificationCode);
    if (!verifyResult.verified) {
      throw new BadRequestException('전화번호 인증이 완료되지 않았습니다');
    }

    // 1. Verify registrationToken JWT
    let payload: {
      provider: string;
      providerId: string;
      email?: string;
      name?: string;
      purpose: string;
    };

    try {
      payload = await this.jwtService.verifyAsync(registrationToken);
    } catch {
      throw new UnauthorizedException('등록 토큰이 만료되었거나 유효하지 않습니다');
    }

    if (payload.purpose !== 'social-registration') {
      throw new UnauthorizedException('유효하지 않은 등록 토큰입니다');
    }

    // 2. Check if user with that email already exists (account linking)
    const email = payload.email ?? `${payload.provider}_${payload.providerId}@social.grapit.com`;
    const existingUser = await this.userRepository.findByEmail(email);

    let userId: string;

    if (existingUser) {
      // Account linking: create social_account link to existing user
      userId = existingUser.id;

      await this.db.insert(schema.socialAccounts).values({
        userId,
        provider: payload.provider,
        providerId: payload.providerId,
        providerEmail: payload.email,
      });

      // Create terms agreement for social login
      await this.db.insert(schema.termsAgreements).values({
        userId,
        termsOfService: dto.termsOfService,
        privacyPolicy: dto.privacyPolicy,
        marketingConsent: dto.marketingConsent,
      });

      const tokens = await this.generateTokenPair(existingUser.id, existingUser.email, existingUser.role);

      return {
        ...tokens,
        user: this.mapToProfile(existingUser),
      };
    }

    // 3. Create new user (passwordHash = null for social-only accounts)
    const user = await this.userRepository.create({
      email,
      passwordHash: null, // social-only accounts have no password
      name: dto.name,
      phone: dto.phone,
      gender: dto.gender,
      country: dto.country,
      birthDate: dto.birthDate,
      marketingConsent: dto.marketingConsent,
      isPhoneVerified: true,
    });

    // 4. Create social account link
    await this.db.insert(schema.socialAccounts).values({
      userId: user.id,
      provider: payload.provider,
      providerId: payload.providerId,
      providerEmail: payload.email,
    });

    // 5. Create terms agreement
    await this.db.insert(schema.termsAgreements).values({
      userId: user.id,
      termsOfService: dto.termsOfService,
      privacyPolicy: dto.privacyPolicy,
      marketingConsent: dto.marketingConsent,
    });

    // 6. Generate JWT tokens
    const tokens = await this.generateTokenPair(user.id, user.email, user.role);

    this.logger.log(`completeSocialRegistration: completed for userId=${user.id}`);

    return {
      ...tokens,
      user: this.mapToProfile(user),
    };
  }

  // -- Private helpers --

  private async generateTokenPair(
    userId: string,
    email: string,
    role: string,
  ): Promise<TokenPair> {
    // Access token
    const accessToken = await this.jwtService.signAsync({
      sub: userId,
      email,
      role,
    });

    // Refresh token: random bytes, hashed for storage
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const family = randomUUID();

    await this.db.insert(schema.refreshTokens).values({
      userId,
      tokenHash,
      family,
      expiresAt: new Date(
        Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      ),
    });

    return { accessToken, refreshToken: rawToken };
  }

  private mapToProfile(user: {
    id: string;
    email: string;
    name: string;
    phone: string;
    gender: 'male' | 'female' | 'unspecified';
    country: string;
    birthDate: string;
    isPhoneVerified: boolean;
    role: string;
    createdAt: Date;
  }): UserProfile {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      gender: user.gender,
      country: user.country,
      birthDate: user.birthDate,
      isPhoneVerified: user.isPhoneVerified,
      role: user.role as 'user' | 'admin',
      createdAt: user.createdAt.toISOString(),
    };
  }
}
