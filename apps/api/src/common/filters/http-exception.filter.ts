import {
  ExceptionFilter,
  Catch,
  HttpException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { SentryExceptionCaptured } from '@sentry/nestjs';
import type { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  @SentryExceptionCaptured()
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorBody = {
      statusCode: status,
      message: exception.message,
      ...(typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? { errors: (exceptionResponse as Record<string, unknown>)['errors'] }
        : {}),
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(errorBody);
  }
}
