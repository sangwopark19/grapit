import {
  resetPasswordRequestSchema,
  resetPasswordSchema,
} from '@grapit/shared/schemas/auth.schema.js';

export const resetPasswordRequestBodySchema = resetPasswordRequestSchema;
export type ResetPasswordRequestBody = {
  email: string;
};

export const resetPasswordBodySchema = resetPasswordSchema;
export type ResetPasswordBody = {
  token: string;
  newPassword: string;
  newPasswordConfirm: string;
};
