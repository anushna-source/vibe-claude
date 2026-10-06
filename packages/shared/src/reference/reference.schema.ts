import { z } from 'zod';
import { listQuerySchema } from '../common/api.js';
import { locationTypeSchema } from '../common/enums.js';

/**
 * Reference data: the departments, locations and categories that staff, assets
 * and assignments hang off. One definition, used by the forms and the API, so
 * the browser and the server cannot disagree about what is acceptable.
 */

const name = z.string().trim().min(2, 'Enter a name of at least 2 characters').max(120);
const optionalText = z.string().trim().max(60).optional();

/** Must have at least one field, or a PATCH is a silent no-op. */
function atLeastOneField<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide at least one field to update',
  });
}

/* Departments ------------------------------------------------------------- */

export const departmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Department = z.infer<typeof departmentSchema>;

export const createDepartmentSchema = z.object({ name });
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = atLeastOneField(z.object({ name: name.optional() }));
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

/* Locations --------------------------------------------------------------- */

export const locationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: locationTypeSchema,
  building: z.string().nullable(),
  floor: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Location = z.infer<typeof locationSchema>;

export const createLocationSchema = z.object({
  name,
  type: locationTypeSchema,
  building: optionalText,
  floor: optionalText,
});
export type CreateLocationInput = z.infer<typeof createLocationSchema>;

export const updateLocationSchema = atLeastOneField(
  z.object({
    name: name.optional(),
    type: locationTypeSchema.optional(),
    building: optionalText,
    floor: optionalText,
  }),
);
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

export const locationListQuerySchema = listQuerySchema.extend({
  type: locationTypeSchema.optional(),
});
export type LocationListQuery = z.infer<typeof locationListQuerySchema>;

/* Categories -------------------------------------------------------------- */

/** The middle of every asset tag: BI-<CODE>-<NNNN>. */
export const categoryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2,6}$/, 'Use 2 to 6 letters, for example LAP');

export const categorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string(),
  /** Read only: the next number tag generation will hand out. */
  nextTagNumber: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Category = z.infer<typeof categorySchema>;

export const createCategorySchema = z.object({ name, code: categoryCodeSchema });
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = atLeastOneField(
  z.object({ name: name.optional(), code: categoryCodeSchema.optional() }),
);
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
