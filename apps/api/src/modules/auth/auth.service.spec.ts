import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'node:crypto';
import { AuthService } from './auth.service.js';
import { UserRepository } from '../user/user.repository.js';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.provider.js';
import type { RegisterBody } from './dto/register.dto.js';

// Mock data
const mockUser = {
  id: randomUUID(),
  email: 'test@test.com',
  passwordHash: '', // will be set in beforeEach
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

const mockRegisterDto: RegisterBody = {
  email: 'new@test.com',
  password: 'Test1234!',
  name: 'New User',
  gender: 'male',
  country: 'KR',
  birthDate: '1995-05-15',
  phone: '010-9876-5432',
  termsOfService: true,
  privacyPolicy: true,
  marketingConsent: false,
};

// Mock Drizzle DB (simplified in-memory store)
function createMockDrizzle() {
  const refreshTokenStore: Array<{
    id: string;
    userId: string;
    tokenHash: string;
    family: string;
    expiresAt: Date;
    createdAt: Date;
    revokedAt: Date | null;
  }> = [];

  const termsStore: Array<{
    id: string;
    userId: string;
    termsOfService: boolean;
    privacyPolicy: boolean;
    marketingConsent: boolean;
    agreedAt: Date;
  }> = [];

  return {
    refreshTokenStore,
    termsStore,
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation(() => {
          return Promise.resolve([]);
        }),
      }),
    }),
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
}

describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: UserRepository;
  let jwtService: JwtService;
  let mockDb: ReturnType<typeof createMockDrizzle>;

  beforeEach(async () => {
    // Hash the test password for mockUser
    mockUser.passwordHash = await argon2.hash('Test1234!', {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    mockDb = createMockDrizzle();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserRepository,
          useValue: {
            findByEmail: vi.fn(),
            findById: vi.fn(),
            create: vi.fn(),
            updatePassword: vi.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: vi.fn().mockResolvedValue('mock-access-token'),
            verifyAsync: vi.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
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
          },
        },
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userRepository = module.get<UserRepository>(UserRepository);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('register', () => {
    it('should create a user with argon2-hashed password and return AuthResponse', async () => {
      vi.spyOn(userRepository, 'findByEmail').mockResolvedValue(null);
      vi.spyOn(userRepository, 'create').mockResolvedValue({
        ...mockUser,
        id: randomUUID(),
        email: mockRegisterDto.email,
        name: mockRegisterDto.name,
      });

      // Mock insert for terms_agreements and refresh_tokens
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: randomUUID() }]),
        }),
      });

      const result = await authService.register(mockRegisterDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(mockRegisterDto.email);

      // Verify password was hashed with argon2
      const createCall = vi.mocked(userRepository.create).mock.calls[0]?.[0];
      expect(createCall).toBeDefined();
      expect(createCall?.passwordHash).toBeDefined();
      expect(createCall?.passwordHash).not.toBe(mockRegisterDto.password);
      const isArgon2 = await argon2.verify(
        createCall!.passwordHash as string,
        mockRegisterDto.password,
      );
      expect(isArgon2).toBe(true);
    });

    it('should throw ConflictException (409) if email already exists', async () => {
      vi.spyOn(userRepository, 'findByEmail').mockResolvedValue(mockUser);

      await expect(authService.register(mockRegisterDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('validateUser', () => {
    it('should return user without passwordHash for valid credentials', async () => {
      vi.spyOn(userRepository, 'findByEmail').mockResolvedValue(mockUser);

      const result = await authService.validateUser('test@test.com', 'Test1234!');

      expect(result).toBeDefined();
      expect(result.email).toBe('test@test.com');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      vi.spyOn(userRepository, 'findByEmail').mockResolvedValue(mockUser);

      await expect(
        authService.validateUser('test@test.com', 'WrongPassword1!'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent email', async () => {
      vi.spyOn(userRepository, 'findByEmail').mockResolvedValue(null);

      await expect(
        authService.validateUser('nouser@test.com', 'Test1234!'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should return AuthResponse with accessToken and refreshToken', async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: randomUUID() }]),
        }),
      });

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

      // Mock: find existing valid refresh token
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

      // Mock update (revoke old token)
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      // Mock insert (new refresh token)
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: randomUUID() }]),
        }),
      });

      const result = await authService.refreshTokens(rawToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.refreshToken).not.toBe(rawToken); // new token
    });

    it('should revoke entire token family on reuse (theft detection)', async () => {
      const rawToken = 'reused-token';
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const family = randomUUID();

      // Mock: token found but already revoked
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

      // Mock update for family revocation
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await expect(authService.refreshTokens(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );

      // Verify that update was called (to revoke entire family)
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
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: randomUUID(),
              tokenHash,
              revokedAt: null,
            },
          ]),
        }),
      });

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
      vi.spyOn(userRepository, 'findByEmail').mockResolvedValue(null);

      // Should not throw even if email doesn't exist
      await expect(
        authService.requestPasswordReset('nonexistent@test.com'),
      ).resolves.not.toThrow();
    });

    it('should generate a reset token for valid email (mock email send)', async () => {
      vi.spyOn(userRepository, 'findByEmail').mockResolvedValue(mockUser);
      vi.spyOn(jwtService, 'signAsync').mockResolvedValue('mock-reset-token');

      await expect(
        authService.requestPasswordReset('test@test.com'),
      ).resolves.not.toThrow();

      // JwtService should have been called to generate the reset token
      expect(jwtService.signAsync).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should update password hash with valid token', async () => {
      const userId = mockUser.id;

      vi.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
        sub: userId,
        purpose: 'password-reset',
      });
      vi.spyOn(userRepository, 'findById').mockResolvedValue(mockUser);
      vi.spyOn(userRepository, 'updatePassword').mockResolvedValue(undefined);

      // Mock revoking all refresh tokens for user
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await authService.resetPassword('valid-reset-token', 'NewPass123!');

      expect(userRepository.updatePassword).toHaveBeenCalledWith(
        userId,
        expect.any(String),
      );

      // Verify the new password was hashed with argon2
      const newHash = vi.mocked(userRepository.updatePassword).mock.calls[0]?.[1];
      expect(newHash).toBeDefined();
      const isValid = await argon2.verify(newHash!, 'NewPass123!');
      expect(isValid).toBe(true);
    });
  });
});
