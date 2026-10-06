import { listQuerySchema } from '@inventory/shared';
import { z } from 'zod';

export { categorySchema, createCategorySchema, updateCategorySchema } from '@inventory/shared';
export type { Category, CreateCategoryInput, UpdateCategoryInput } from '@inventory/shared';

export const categoryIdParamsSchema = z.object({
  id: z.string().uuid('Not a valid category id'),
});
export type CategoryIdParams = z.infer<typeof categoryIdParamsSchema>;

export const categoryListQuerySchema = listQuerySchema;
export type CategoryListQuery = z.infer<typeof categoryListQuerySchema>;
