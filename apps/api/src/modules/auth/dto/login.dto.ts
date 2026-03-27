import { loginSchema } from '@grapit/shared/schemas/auth.schema.js';

export const loginBodySchema = loginSchema;
export type LoginBody = {
  email: string;
  password: string;
};
