import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-naver-v2';
import { ConfigService } from '@nestjs/config';
import type { SocialProfile } from '../interfaces/social-profile.interface.js';

interface NaverProfile {
  id: string;
  displayName: string;
  emails?: Array<{ value: string }>;
}

@Injectable()
export class NaverStrategy extends PassportStrategy(Strategy, 'naver') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('NAVER_CLIENT_ID'),
      clientSecret: configService.get<string>('NAVER_CLIENT_SECRET'),
      callbackURL: configService.get<string>('NAVER_CALLBACK_URL'),
    });
  }

  extractProfile(profile: NaverProfile): SocialProfile {
    const email = profile.emails?.[0]?.value;
    const name = profile.displayName || '';

    return {
      provider: 'naver',
      providerId: String(profile.id),
      email,
      name,
    };
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: NaverProfile,
    done: (error: Error | null, user?: SocialProfile) => void,
  ): Promise<void> {
    const socialProfile = this.extractProfile(profile);
    done(null, socialProfile);
  }
}
