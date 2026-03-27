import { describe, it, expect, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';

describe('NaverStrategy', () => {
  it('should extract provider, providerId, email, name from Naver profile', async () => {
    const { NaverStrategy } = await import('./naver.strategy.js');

    const mockConfigService = {
      get: vi.fn().mockImplementation((key: string) => {
        const config: Record<string, string> = {
          NAVER_CLIENT_ID: 'test-naver-client-id',
          NAVER_CLIENT_SECRET: 'test-naver-client-secret',
          NAVER_CALLBACK_URL: 'http://localhost:8080/api/v1/auth/social/naver/callback',
        };
        return config[key];
      }),
    } as unknown as ConfigService;

    const strategy = new NaverStrategy(mockConfigService);

    const mockProfile = {
      id: 'naver-id-123',
      displayName: 'Naver User',
      emails: [{ value: 'naver@test.com' }],
    };

    const result = await strategy.extractProfile(mockProfile);

    expect(result).toEqual({
      provider: 'naver',
      providerId: 'naver-id-123',
      email: 'naver@test.com',
      name: 'Naver User',
    });
  });

  it('should handle missing email gracefully', async () => {
    const { NaverStrategy } = await import('./naver.strategy.js');

    const mockConfigService = {
      get: vi.fn().mockReturnValue('test-value'),
    } as unknown as ConfigService;

    const strategy = new NaverStrategy(mockConfigService);

    const mockProfile = {
      id: 'naver-id-456',
      displayName: 'Naver User No Email',
      emails: [],
    };

    const result = await strategy.extractProfile(mockProfile);

    expect(result.email).toBeUndefined();
    expect(result.providerId).toBe('naver-id-456');
  });
});
