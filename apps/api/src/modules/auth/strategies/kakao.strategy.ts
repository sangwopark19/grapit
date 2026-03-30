import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-kakao';
import { ConfigService } from '@nestjs/config';
import type { SocialProfile } from '../interfaces/social-profile.interface.js';

interface KakaoProfile {
  id: string;
  displayName: string;
  _json: {
    kakao_account?: {
      email?: string;
    };
    properties?: {
      nickname?: string;
    };
  };
}

@Injectable()
export class KakaoStrategy extends PassportStrategy(Strategy, 'kakao') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('KAKAO_CLIENT_ID', ''),
      clientSecret: configService.get<string>('KAKAO_CLIENT_SECRET', ''),
      callbackURL: configService.get<string>('KAKAO_CALLBACK_URL', ''),
    });
  }

  extractProfile(profile: KakaoProfile): SocialProfile {
    const email = profile._json?.kakao_account?.email;
    const name =
      profile.displayName || profile._json?.properties?.nickname || '';

    return {
      provider: 'kakao',
      providerId: String(profile.id),
      email,
      name,
    };
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: KakaoProfile,
    done: (error: Error | null, user?: SocialProfile) => void,
  ): Promise<void> {
    const socialProfile = this.extractProfile(profile);
    done(null, socialProfile);
  }
}
