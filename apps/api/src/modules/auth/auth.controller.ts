import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
import { registerBodySchema, type RegisterBody } from './dto/register.dto.js';
import {
  resetPasswordRequestBodySchema,
  type ResetPasswordRequestBody,
  resetPasswordBodySchema,
  type ResetPasswordBody,
} from './dto/reset-password.dto.js';
import { AUTH_COOKIE_NAME } from '@grapit/shared/constants/index.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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

    res.clearCookie(AUTH_COOKIE_NAME, { path: '/api/v1/auth' });

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

  private setRefreshTokenCookie(res: Response, token: string): void {
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/v1/auth',
    });
  }
}
