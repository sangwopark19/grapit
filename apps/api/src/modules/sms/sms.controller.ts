import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { z } from 'zod';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { SmsService, type SendResult, type VerifyResult } from './sms.service.js';

const sendCodeSchema = z.object({
  phone: z.string().regex(/^01[016789]\d{7,8}$/, '올바른 휴대폰 번호를 입력해주세요'),
});

const verifyCodeSchema = z.object({
  phone: z.string().min(1, '전화번호를 입력해주세요'),
  code: z.string().length(6, '인증번호는 6자리입니다'),
});

type SendCodeBody = z.infer<typeof sendCodeSchema>;
type VerifyCodeBody = z.infer<typeof verifyCodeSchema>;

@Controller('sms')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('send-code')
  async sendCode(
    @Body(new ZodValidationPipe(sendCodeSchema)) dto: SendCodeBody,
  ): Promise<SendResult> {
    return this.smsService.sendVerificationCode(dto.phone);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('verify-code')
  async verifyCode(
    @Body(new ZodValidationPipe(verifyCodeSchema)) dto: VerifyCodeBody,
  ): Promise<VerifyResult> {
    return this.smsService.verifyCode(dto.phone, dto.code);
  }
}
