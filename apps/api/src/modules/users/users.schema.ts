import { listQuerySchema, updateUserSchema } from '@inventory/shared';
import { z } from 'zod';

export { authUserSchema, updateUserSchema } from '@inventory/shared';
export type { AuthUser, UpdateUserInput } from '@inventory/shared';

export const userIdParamsSchema = z.object({
  id: z.string().uuid('Not a valid user id'),
});
export type UserIdParams = z.infer<typeof userIdParamsSchema>;

export const listUsersQuerySchema = listQuerySchema;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const updateUserBodySchema = updateUserSchema;
