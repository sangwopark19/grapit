import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Param,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
import { registerBodySchema, type RegisterBody } from './dto/register.dto.js';
import {
  completeSocialRegistrationSchema,
  type CompleteSocialRegistrationBody,
} from './dto/social-register.dto.js';
import {
  resetPasswordRequestBodySchema,
  type ResetPasswordRequestBody,
  resetPasswordBodySchema,
  type ResetPasswordBody,
} from './dto/reset-password.dto.js';
import {
  KakaoAuthGuard,
  NaverAuthGuard,
  GoogleAuthGuard,
} from './guards/social-auth.guard.js';
import type { SocialProfile } from './interfaces/social-profile.interface.js';
import { AUTH_COOKIE_NAME } from '@grapit/shared/constants/index.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerBodySchema)) dto: RegisterBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);
    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Public()
  @UseGuards(AuthGuard('local'))
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(req.user as any);
    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = (req.cookies as Record<string, string>)?.[AUTH_COOKIE_NAME];
    if (!token) {
      throw new UnauthorizedException('리프레시 토큰이 없습니다');
    }

    const result = await this.authService.refreshTokens(token);
    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = (req.cookies as Record<string, string>)?.[AUTH_COOKIE_NAME];
    if (token) {
      await this.authService.revokeRefreshToken(token);
    }

    res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });

    return { message: 'Logged out' };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('password-reset/request')
  async requestReset(
    @Body(new ZodValidationPipe(resetPasswordRequestBodySchema))
    dto: ResetPasswordRequestBody,
  ) {
    await this.authService.requestPasswordReset(dto.email);
    return { message: '비밀번호 재설정 링크를 발송했습니다' };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('password-reset/confirm')
  async confirmReset(
    @Body(new ZodValidationPipe(resetPasswordBodySchema))
    dto: ResetPasswordBody,
  ) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: '비밀번호가 변경되었습니다' };
  }

  // -- Social OAuth endpoints --

  @Public()
  @UseGuards(KakaoAuthGuard)
  @Get('social/kakao')
  socialKakao(): void {
    // Guard redirects to Kakao OAuth consent page
  }

  @Public()
  @UseGuards(KakaoAuthGuard)
  @Get('social/kakao/callback')
  async socialKakaoCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.handleSocialCallback(req, res);
  }

  @Public()
  @UseGuards(NaverAuthGuard)
  @Get('social/naver')
  socialNaver(): void {
    // Guard redirects to Naver OAuth consent page
  }

  @Public()
  @UseGuards(NaverAuthGuard)
  @Get('social/naver/callback')
  async socialNaverCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.handleSocialCallback(req, res);
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('social/google')
  socialGoogle(): void {
    // Guard redirects to Google OAuth consent page
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('social/google/callback')
  async socialGoogleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.handleSocialCallback(req, res);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('social/complete-registration')
  async completeSocialRegistration(
    @Body(new ZodValidationPipe(completeSocialRegistrationSchema))
    dto: CompleteSocialRegistrationBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { registrationToken, ...registerData } = dto;
    const result = await this.authService.completeSocialRegistration(
      registrationToken,
      registerData,
    );
    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  // -- Private helpers --

  private async handleSocialCallback(req: Request, res: Response): Promise<void> {
    const profile = req.user as SocialProfile;
    const result = await this.authService.findOrCreateSocialUser(profile);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    if (result.status === 'authenticated') {
      if (result.refreshToken) {
        this.setRefreshTokenCookie(res, result.refreshToken);
      }
      res.redirect(
        `${frontendUrl}/auth/callback?accessToken=${result.accessToken}&status=authenticated`,
      );
    } else {
      res.redirect(
        `${frontendUrl}/auth/callback?registrationToken=${result.registrationToken}&status=needs_registration`,
      );
    }
  }

  private setRefreshTokenCookie(res: Response, token: string): void {
    const isProduction = process.env['NODE_ENV'] === 'production';
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });
  }
}
