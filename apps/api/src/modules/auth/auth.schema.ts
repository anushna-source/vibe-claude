/**
 * The auth contract lives in packages/shared so the sign-up form and the API
 * validate identically. Re-exported here to keep the four-file module layout.
 */
export {
  authUserSchema,
  loginSchema,
  PASSWORD_MIN_LENGTH,
  passwordSchema,
  sessionSchema,
  signupSchema,
  updateUserSchema,
} from '@inventory/shared';
export type {
  AuthUser,
  LoginInput,
  Session,
  SignupInput,
  UpdateUserInput,
} from '@inventory/shared';
