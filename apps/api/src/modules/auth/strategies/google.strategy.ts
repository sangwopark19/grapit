import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import type { SocialProfile } from '../interfaces/social-profile.interface.js';

interface GoogleProfile {
  id: string;
  displayName: string;
  emails?: Array<{ value: string; verified?: boolean }>;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID', 'not-configured'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET', 'not-configured'),
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL', 'http://localhost:8080/api/v1/auth/social/google/callback'),
      scope: ['email', 'profile'],
    });
  }

  extractProfile(profile: GoogleProfile): SocialProfile {
    const email = profile.emails?.[0]?.value;
    const name = profile.displayName || '';

    return {
      provider: 'google',
      providerId: String(profile.id),
      email,
      name,
    };
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: GoogleProfile,
  ): Promise<SocialProfile> {
    return this.extractProfile(profile);
  }
}
