import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import type { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  private schema?: ZodSchema;

  constructor(schema?: ZodSchema) {
    this.schema = schema;
  }

  transform(value: unknown) {
    if (!this.schema) {
      return value;
    }

    const result = this.schema.safeParse(value);
    if (!result.success) {
      const zodError = result.error as ZodError;
      throw new BadRequestException({
        message: 'Validation failed',
        errors: zodError.flatten().fieldErrors,
      });
    }
    return result.data;
  }
}
