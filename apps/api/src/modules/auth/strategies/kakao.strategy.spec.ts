import { describe, it, expect, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';

// We will test the validate method extracted from KakaoStrategy
// Since PassportStrategy mixin makes direct instantiation complex,
// we test the profile extraction logic via the validate method
describe('KakaoStrategy', () => {
  it('should extract provider, providerId, email, name from Kakao profile', async () => {
    // Dynamic import to ensure module exists
    const { KakaoStrategy } = await import('./kakao.strategy.js');

    const mockConfigService = {
      get: vi.fn().mockImplementation((key: string) => {
        const config: Record<string, string> = {
          KAKAO_CLIENT_ID: 'test-kakao-client-id',
          KAKAO_CLIENT_SECRET: 'test-kakao-client-secret',
          KAKAO_CALLBACK_URL: 'http://localhost:8080/api/v1/auth/social/kakao/callback',
        };
        return config[key];
      }),
    } as unknown as ConfigService;

    const strategy = new KakaoStrategy(mockConfigService);

    const mockProfile = {
      id: '12345678',
      displayName: 'Kakao User',
      _json: {
        kakao_account: {
          email: 'kakao@test.com',
        },
        properties: {
          nickname: 'Kakao Nickname',
        },
      },
    };

    const result = await strategy.extractProfile(mockProfile);

    expect(result).toEqual({
      provider: 'kakao',
      providerId: '12345678',
      email: 'kakao@test.com',
      name: 'Kakao User',
    });
  });

  it('should fallback to nickname from properties if displayName is empty', async () => {
    const { KakaoStrategy } = await import('./kakao.strategy.js');

    const mockConfigService = {
      get: vi.fn().mockReturnValue('test-value'),
    } as unknown as ConfigService;

    const strategy = new KakaoStrategy(mockConfigService);

    const mockProfile = {
      id: '12345678',
      displayName: '',
      _json: {
        kakao_account: {
          email: 'kakao@test.com',
        },
        properties: {
          nickname: 'Kakao Nickname',
        },
      },
    };

    const result = await strategy.extractProfile(mockProfile);

    expect(result.name).toBe('Kakao Nickname');
  });
});
