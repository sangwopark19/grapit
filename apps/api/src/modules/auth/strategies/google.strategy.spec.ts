import { describe, it, expect, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';

describe('GoogleStrategy', () => {
  it('should extract provider, providerId, email, name from Google profile', async () => {
    const { GoogleStrategy } = await import('./google.strategy.js');

    const mockConfigService = {
      get: vi.fn().mockImplementation((key: string) => {
        const config: Record<string, string> = {
          GOOGLE_CLIENT_ID: 'test-google-client-id',
          GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
          GOOGLE_CALLBACK_URL: 'http://localhost:8080/api/v1/auth/social/google/callback',
        };
        return config[key];
      }),
    } as unknown as ConfigService;

    const strategy = new GoogleStrategy(mockConfigService);

    const mockProfile = {
      id: 'google-id-789',
      displayName: 'Google User',
      emails: [{ value: 'google@test.com', verified: true }],
    };

    const result = await strategy.extractProfile(mockProfile);

    expect(result).toEqual({
      provider: 'google',
      providerId: 'google-id-789',
      email: 'google@test.com',
      name: 'Google User',
    });
  });

  it('should handle missing email gracefully', async () => {
    const { GoogleStrategy } = await import('./google.strategy.js');

    const mockConfigService = {
      get: vi.fn().mockReturnValue('test-value'),
    } as unknown as ConfigService;

    const strategy = new GoogleStrategy(mockConfigService);

    const mockProfile = {
      id: 'google-id-000',
      displayName: 'Google No Email',
      emails: [],
    };

    const result = await strategy.extractProfile(mockProfile);

    expect(result.email).toBeUndefined();
    expect(result.provider).toBe('google');
  });
});
