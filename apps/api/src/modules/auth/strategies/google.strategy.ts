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
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL'),
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
    done: (error: Error | null, user?: SocialProfile) => void,
  ): Promise<void> {
    const socialProfile = this.extractProfile(profile);
    done(null, socialProfile);
  }
}
