import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'node:crypto';
import { AuthService } from './auth.service.js';
import type { RegisterBody } from './dto/register.dto.js';

// Hash password once (argon2 is expensive)
let preHashedPassword: string;

const mockRegisterDto: RegisterBody = {
  email: 'new@test.com',
  password: 'Test1234!',
  name: 'New User',
  gender: 'male',
  country: 'KR',
  birthDate: '1995-05-15',
  phone: '010-9876-5432',
  phoneVerificationCode: '000000',
  termsOfService: true,
  privacyPolicy: true,
  marketingConsent: false,
};

function createMockUser() {
  return {
    id: randomUUID(),
    email: 'test@test.com',
    passwordHash: preHashedPassword,
    name: 'Test User',
    phone: '010-1234-5678',
    gender: 'male' as const,
    country: 'KR',
    birthDate: '1990-01-01',
    isPhoneVerified: false,
    isEmailVerified: false,
    marketingConsent: false,
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Drizzle mock: insert().values() returns a thenable promise
function makeMockInsertChain() {
  return {
    values: vi.fn().mockReturnValue(
      Object.assign(Promise.resolve([]), {
        returning: vi.fn().mockResolvedValue([{ id: randomUUID() }]),
      }),
    ),
  };
}

describe('AuthService', () => {
  let authService: AuthService;
  let mockUser: ReturnType<typeof createMockUser>;
  let mockUserRepo: {
    findByEmail: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    updatePassword: ReturnType<typeof vi.fn>;
  };
  let mockJwtService: {
    signAsync: ReturnType<typeof vi.fn>;
    verifyAsync: ReturnType<typeof vi.fn>;
  };
  let mockDb: {
    insert: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeAll(async () => {
    preHashedPassword = await argon2.hash('Test1234!', {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }, 30000);

  beforeEach(() => {
    mockUser = createMockUser();

    mockUserRepo = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updatePassword: vi.fn(),
    };

    mockJwtService = {
      signAsync: vi.fn().mockResolvedValue('mock-access-token'),
      verifyAsync: vi.fn(),
    };

    const mockConfigService = {
      get: vi.fn().mockImplementation((key: string) => {
        const config: Record<string, string> = {
          'auth.jwtSecret': 'test-jwt-secret',
          'auth.jwtRefreshSecret': 'test-refresh-secret',
          'auth.jwtExpiresIn': '15m',
          'auth.jwtRefreshExpiresIn': '7d',
          FRONTEND_URL: 'http://localhost:3000',
        };
        return config[key];
      }),
    };

    mockDb = {
      insert: vi.fn().mockImplementation(() => makeMockInsertChain()),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    };

    const mockSmsService = {
      verifyCode: vi.fn().mockResolvedValue({ verified: true }),
      sendVerificationCode: vi.fn().mockResolvedValue({ success: true, message: '' }),
    };

    // Instantiate AuthService directly (no NestJS DI overhead)
    authService = new AuthService(
      mockJwtService as unknown as JwtService,
      mockConfigService as unknown as ConfigService,
      mockUserRepo as any,
      mockSmsService as any,
      mockDb as any,
    );
  });

  describe('register', () => {
    it('should create a user with argon2-hashed password and return AuthResponse', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.create.mockResolvedValue({
        ...mockUser,
        id: randomUUID(),
        email: mockRegisterDto.email,
        name: mockRegisterDto.name,
      });

      const result = await authService.register(mockRegisterDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(mockRegisterDto.email);

      // Verify password was hashed with argon2
      const createCall = mockUserRepo.create.mock.calls[0]?.[0];
      expect(createCall).toBeDefined();
      expect(createCall?.passwordHash).toBeDefined();
      expect(createCall?.passwordHash).not.toBe(mockRegisterDto.password);
      const isArgon2 = await argon2.verify(
        createCall!.passwordHash as string,
        mockRegisterDto.password,
      );
      expect(isArgon2).toBe(true);
    }, 15000);

    it('should throw ConflictException (409) if email already exists', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);

      await expect(authService.register(mockRegisterDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('validateUser', () => {
    it('should return user without passwordHash for valid credentials', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);

      const result = await authService.validateUser('test@test.com', 'Test1234!');

      expect(result).toBeDefined();
      expect(result.email).toBe('test@test.com');
      expect(result).not.toHaveProperty('passwordHash');
    }, 10000);

    it('should throw UnauthorizedException for wrong password', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);

      await expect(
        authService.validateUser('test@test.com', 'WrongPassword1!'),
      ).rejects.toThrow(UnauthorizedException);
    }, 10000);

    it('should throw UnauthorizedException for non-existent email', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);

      await expect(
        authService.validateUser('nouser@test.com', 'Test1234!'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should return AuthResponse with accessToken and refreshToken', async () => {
      const result = await authService.login({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        name: mockUser.name,
        phone: mockUser.phone,
        gender: mockUser.gender,
        country: mockUser.country,
        birthDate: mockUser.birthDate,
        isPhoneVerified: mockUser.isPhoneVerified,
        createdAt: mockUser.createdAt,
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(mockUser.email);
    });
  });

  describe('refreshTokens', () => {
    it('should return new accessToken and refreshToken when valid token provided', async () => {
      const rawToken = 'valid-raw-refresh-token';
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const family = randomUUID();

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: randomUUID(),
              userId: mockUser.id,
              tokenHash,
              family,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              createdAt: new Date(),
              revokedAt: null,
            },
          ]),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      mockUserRepo.findById.mockResolvedValue(mockUser);

      const result = await authService.refreshTokens(rawToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.refreshToken).not.toBe(rawToken);
    });

    it('should revoke entire token family on reuse (theft detection)', async () => {
      const rawToken = 'reused-token';
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const family = randomUUID();

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: randomUUID(),
              userId: mockUser.id,
              tokenHash,
              family,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              createdAt: new Date(),
              revokedAt: new Date(), // already revoked!
            },
          ]),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await expect(authService.refreshTokens(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for expired token', async () => {
      const rawToken = 'expired-token';
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: randomUUID(),
              userId: mockUser.id,
              tokenHash,
              family: randomUUID(),
              expiresAt: new Date(Date.now() - 1000), // expired
              createdAt: new Date(),
              revokedAt: null,
            },
          ]),
        }),
      });

      await expect(authService.refreshTokens(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('revokeRefreshToken', () => {
    it('should mark token as revoked in DB', async () => {
      const rawToken = 'token-to-revoke';

      const updateWhereMock = vi.fn().mockResolvedValue([]);
      const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock });
      mockDb.update.mockReturnValue({ set: updateSetMock });

      await authService.revokeRefreshToken(rawToken);

      expect(mockDb.update).toHaveBeenCalled();
      expect(updateSetMock).toHaveBeenCalledWith(
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });
  });

  describe('requestPasswordReset', () => {
    it('should not reveal whether email exists (always returns silently)', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);

      await expect(
        authService.requestPasswordReset('nonexistent@test.com'),
      ).resolves.not.toThrow();
    });

    it('should generate a reset token for valid email (mock email send)', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);

      await expect(
        authService.requestPasswordReset('test@test.com'),
      ).resolves.not.toThrow();

      expect(mockJwtService.signAsync).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should update password hash with valid token', async () => {
      const userId = mockUser.id;

      // Build a fake JWT with a valid base64url-encoded payload
      const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: userId, purpose: 'password-reset' })).toString('base64url');
      const fakeToken = `${header}.${payload}.fake-signature`;

      mockJwtService.verifyAsync.mockResolvedValue({
        sub: userId,
        purpose: 'password-reset',
      });
      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockUserRepo.updatePassword.mockResolvedValue(undefined);

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await authService.resetPassword(fakeToken, 'NewPass123!');

      expect(mockUserRepo.updatePassword).toHaveBeenCalledWith(
        userId,
        expect.any(String),
      );

      const newHash = mockUserRepo.updatePassword.mock.calls[0]?.[1];
      expect(newHash).toBeDefined();
      const isValid = await argon2.verify(newHash!, 'NewPass123!');
      expect(isValid).toBe(true);
    }, 15000);
  });

  describe('findOrCreateSocialUser', () => {
    it('should return needs_registration with registrationToken for new social user', async () => {
      // No existing social account
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      // No existing user with this email
      mockUserRepo.findByEmail.mockResolvedValue(null);

      // Mock JWT sign for registration token
      mockJwtService.signAsync.mockResolvedValue('mock-registration-token');

      const result = await authService.findOrCreateSocialUser({
        provider: 'kakao',
        providerId: '12345',
        email: 'kakao@test.com',
        name: 'Kakao User',
      });

      expect(result.status).toBe('needs_registration');
      expect(result.registrationToken).toBe('mock-registration-token');
      expect(result.socialProfile).toEqual({
        provider: 'kakao',
        providerId: '12345',
        email: 'kakao@test.com',
        name: 'Kakao User',
      });
    });

    it('should return authenticated with tokens for existing social user', async () => {
      const existingUser = createMockUser();

      // Existing social account found
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: randomUUID(),
              userId: existingUser.id,
              provider: 'kakao',
              providerId: '12345',
              providerEmail: 'kakao@test.com',
              createdAt: new Date(),
            },
          ]),
        }),
      });

      // findById returns existing user
      mockUserRepo.findById.mockResolvedValue(existingUser);

      const result = await authService.findOrCreateSocialUser({
        provider: 'kakao',
        providerId: '12345',
        email: 'kakao@test.com',
        name: 'Kakao User',
      });

      expect(result.status).toBe('authenticated');
      expect(result.accessToken).toBeDefined();
      expect(result.user).toBeDefined();
    });
  });

  describe('completeSocialRegistration', () => {
    it('should create user + social account + terms with valid registrationToken', async () => {
      const newUserId = randomUUID();

      // Verify registration token
      mockJwtService.verifyAsync.mockResolvedValue({
        provider: 'kakao',
        providerId: '12345',
        email: 'kakao@test.com',
        name: 'Kakao User',
        purpose: 'social-registration',
      });

      // No existing user with this email
      mockUserRepo.findByEmail.mockResolvedValue(null);

      // Create user
      mockUserRepo.create.mockResolvedValue({
        ...createMockUser(),
        id: newUserId,
        email: 'kakao@test.com',
        name: 'Registered Name',
        passwordHash: null,
      });

      const result = await authService.completeSocialRegistration(
        'valid-registration-token',
        {
          name: 'Registered Name',
          gender: 'male',
          country: 'KR',
          birthDate: '1995-05-15',
          phone: '010-1234-5678',
          termsOfService: true,
          privacyPolicy: true,
          marketingConsent: false,
        },
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(mockUserRepo.create).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for expired registrationToken', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(
        authService.completeSocialRegistration('expired-token', {
          name: 'Name',
          gender: 'male',
          country: 'KR',
          birthDate: '1995-05-15',
          phone: '010-1234-5678',
          termsOfService: true,
          privacyPolicy: true,
          marketingConsent: false,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should link accounts when social email matches existing user without social link', async () => {
      const existingUser = createMockUser();

      // Verify registration token
      mockJwtService.verifyAsync.mockResolvedValue({
        provider: 'google',
        providerId: 'google-789',
        email: existingUser.email,
        name: 'Google User',
        purpose: 'social-registration',
      });

      // Existing user found with same email
      mockUserRepo.findByEmail.mockResolvedValue(existingUser);

      const result = await authService.completeSocialRegistration(
        'valid-registration-token',
        {
          name: existingUser.name,
          gender: existingUser.gender,
          country: existingUser.country,
          birthDate: existingUser.birthDate,
          phone: existingUser.phone,
          termsOfService: true,
          privacyPolicy: true,
          marketingConsent: false,
        },
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('user');
      // Should NOT create a new user -- should link to existing
      expect(mockUserRepo.create).not.toHaveBeenCalled();
      // Should insert social account link
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });
});
