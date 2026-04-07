import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { TossPaymentError } from '../../modules/payment/toss-payments.client.js';

const CLIENT_ERROR_CODES = new Set([
  'PAY_PROCESS_CANCELED',
  'PAY_PROCESS_ABORTED',
  'REJECT_CARD_PAYMENT',
  'BELOW_MINIMUM_AMOUNT',
  'INVALID_CARD_LOST_OR_STOLEN',
  'NOT_AVAILABLE_PAYMENT',
  'EXCEED_MAX_CARD_INSTALLMENT_PLAN',
  'NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT',
]);

const CONFLICT_CODES = new Set([
  'ALREADY_PROCESSED_PAYMENT',
  'DUPLICATED_ORDER_ID',
]);

@Catch(TossPaymentError)
export class TossPaymentExceptionFilter implements ExceptionFilter {
  catch(exception: TossPaymentError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode: number;
    if (CLIENT_ERROR_CODES.has(exception.code)) {
      statusCode = 400;
    } else if (CONFLICT_CODES.has(exception.code)) {
      statusCode = 409;
    } else {
      statusCode = 502;
    }

    response.status(statusCode).json({
      statusCode,
      code: exception.code,
      message: exception.message,
      timestamp: new Date().toISOString(),
    });
  }
}
