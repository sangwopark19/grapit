import {
  Controller,
  Get,
  Patch,
  Body,
} from '@nestjs/common';
import { CurrentUser, type RequestUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { UserService } from './user.service.js';
import { updateProfileSchema, type UpdateProfileInput } from '@grapit/shared/schemas/user.schema.js';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getProfile(@CurrentUser() user: RequestUser) {
    return this.userService.getUserProfile(user.id);
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) dto: UpdateProfileInput,
  ) {
    return this.userService.updateProfile(user.id, dto);
  }
}
