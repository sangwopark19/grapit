import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => ({
  jwtSecret: process.env['JWT_SECRET'],
  jwtRefreshSecret: process.env['JWT_REFRESH_SECRET'],
  jwtExpiresIn: '15m',
  jwtRefreshExpiresIn: '7d',
}));
