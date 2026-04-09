import { Injectable, type ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

function handleSocialAuthRequest<T>(
  err: Error | null,
  user: T,
  context: ExecutionContext,
  configService: ConfigService,
  providerName: string,
  logger: Logger,
): T {
  if (err || !user) {
    const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const errorCode =
      err?.message?.toLowerCase().includes('denied') ||
      err?.message?.toLowerCase().includes('cancel')
        ? 'oauth_denied'
        : 'oauth_failed';

    logger.warn(`${providerName} OAuth failed: ${err?.message ?? 'no user returned'}`);

    const res = context.switchToHttp().getResponse<Response>();
    res.redirect(`${frontendUrl}/auth/callback?error=${errorCode}&provider=${providerName}`);
    return null as T;
  }

  return user;
}

@Injectable()
export class KakaoAuthGuard extends AuthGuard('kakao') {
  private readonly logger = new Logger('KakaoAuthGuard');

  constructor(private readonly configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<T>(err: Error | null, user: T, _info: unknown, context: ExecutionContext): T {
    return handleSocialAuthRequest(err, user, context, this.configService, 'kakao', this.logger);
  }
}

@Injectable()
export class NaverAuthGuard extends AuthGuard('naver') {
  private readonly logger = new Logger('NaverAuthGuard');

  constructor(private readonly configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<T>(err: Error | null, user: T, _info: unknown, context: ExecutionContext): T {
    return handleSocialAuthRequest(err, user, context, this.configService, 'naver', this.logger);
  }
}

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  private readonly logger = new Logger('GoogleAuthGuard');

  constructor(private readonly configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<T>(err: Error | null, user: T, _info: unknown, context: ExecutionContext): T {
    return handleSocialAuthRequest(err, user, context, this.configService, 'google', this.logger);
  }
}
