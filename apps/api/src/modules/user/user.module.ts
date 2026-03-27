import { Module } from '@nestjs/common';
import { UserService } from './user.service.js';
import { UserRepository } from './user.repository.js';

@Module({
  providers: [UserService, UserRepository],
  exports: [UserService, UserRepository],
})
export class UserModule {}
