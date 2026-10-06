import { listQuerySchema } from '@inventory/shared';
import { z } from 'zod';

/**
 * The contract lives in packages/shared so the forms validate identically.
 * Re-exported here to keep the four-file module layout from AGENTS.md.
 */
export {
  createDepartmentSchema,
  departmentSchema,
  updateDepartmentSchema,
} from '@inventory/shared';
export type { CreateDepartmentInput, Department, UpdateDepartmentInput } from '@inventory/shared';

export const departmentIdParamsSchema = z.object({
  id: z.string().uuid('Not a valid department id'),
});
export type DepartmentIdParams = z.infer<typeof departmentIdParamsSchema>;

export const departmentListQuerySchema = listQuerySchema;
export type DepartmentListQuery = z.infer<typeof departmentListQuerySchema>;
