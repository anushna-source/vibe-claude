import { z } from 'zod';
import { userRoleSchema } from '../common/enums.js';

/**
 * The sign-up form and the API validate against exactly these schemas, so the
 * browser and the server can never disagree about what is acceptable.
 */

export const PASSWORD_MIN_LENGTH = 12;

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .max(254)
  .email('Enter a valid email address')
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  // bcrypt-style length caps bite at 72 bytes; argon2 has no such limit, but a
  // ceiling keeps a huge input from burning CPU.
  .max(200, 'Password must be at most 200 characters');

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(120),
  email: emailSchema,
  password: passwordSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  // Not `passwordSchema`: an old password that predates a rule change must still
  // be able to log in, and the length hint would leak policy to an attacker.
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** What the API returns about a user. Deliberately has no password field. */
export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  fullName: z.string(),
  role: userRoleSchema,
  isActive: z.boolean(),
  createdAt: z.string(),
  lastLoginAt: z.string().nullable(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const sessionSchema = z.object({
  user: authUserSchema,
  accessToken: z.string().min(1),
  /** Seconds until the access token expires. */
  expiresIn: z.number().int().positive(),
});
export type Session = z.infer<typeof sessionSchema>;

export const sessionResponseSchema = z.object({ data: sessionSchema });
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const authUserResponseSchema = z.object({ data: authUserSchema });
export type AuthUserResponse = z.infer<typeof authUserResponseSchema>;

/** Admin-only changes to another account. */
export const updateUserSchema = z
  .object({
    role: userRoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => value.role !== undefined || value.isActive !== undefined, {
    message: 'Provide role or isActive',
  });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
