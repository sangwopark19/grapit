import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.provider.js';
import * as schema from '../../database/schema/index.js';
import { UserRepository } from '../user/user.repository.js';
import type { RegisterBody } from './dto/register.dto.js';
import type { UserProfile } from '@grapit/shared/types/user.types.js';
import {
  REFRESH_TOKEN_EXPIRY_DAYS,
} from '@grapit/shared/constants/index.js';

interface ValidatedUser {
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
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userRepository: UserRepository,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async register(dto: RegisterBody): Promise<AuthResult> {
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

    // 8. Generate new access token
    const accessToken = await this.jwtService.signAsync({
      sub: tokenRecord.userId,
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

    // Silently return if user not found (prevent email enumeration)
    if (!user) {
      return;
    }

    // Generate reset token with user's password hash as additional entropy
    const secret =
      this.configService.get<string>('auth.jwtSecret') + (user.passwordHash ?? '');

    const resetToken = await this.jwtService.signAsync(
      { sub: user.id, purpose: 'password-reset' },
      { secret, expiresIn: '1h' },
    );

    // Send email (in production, use nodemailer/SES)
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const resetLink = `${frontendUrl}/auth/reset-password?token=${resetToken}`;

    // TODO: Wire up nodemailer transport in production
    // For now, log the link (will be replaced with actual email service)
    console.log(`[Password Reset] Link for ${email}: ${resetLink}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // 1. Verify JWT reset token
    let payload: { sub: string; purpose: string };
    try {
      // First verify without extra secret to get sub, then re-verify with full secret
      const decoded = await this.jwtService.verifyAsync<{
        sub: string;
        purpose: string;
      }>(token, {
        secret: undefined, // Will try in two steps
      });
      payload = decoded;
    } catch {
      // Try with user's password hash as additional entropy
      try {
        const partialDecoded = JSON.parse(
          Buffer.from(token.split('.')[1]!, 'base64').toString(),
        ) as { sub: string };

        const user = await this.userRepository.findById(partialDecoded.sub);
        if (!user) {
          throw new UnauthorizedException('유효하지 않은 재설정 토큰입니다');
        }

        const secret =
          this.configService.get<string>('auth.jwtSecret') +
          (user.passwordHash ?? '');

        payload = await this.jwtService.verifyAsync<{
          sub: string;
          purpose: string;
        }>(token, { secret });
      } catch {
        throw new UnauthorizedException('유효하지 않은 재설정 토큰입니다');
      }
    }

    if (payload.purpose !== 'password-reset') {
      throw new UnauthorizedException('유효하지 않은 재설정 토큰입니다');
    }

    // 2. Hash new password
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    // 3. Update password
    await this.userRepository.updatePassword(payload.sub, passwordHash);

    // 4. Revoke all refresh tokens (force re-login)
    await this.db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(schema.refreshTokens.userId, payload.sub));
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
