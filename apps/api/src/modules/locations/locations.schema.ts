import { z } from 'zod';

export {
  createLocationSchema,
  locationListQuerySchema,
  locationSchema,
  updateLocationSchema,
} from '@inventory/shared';
export type {
  CreateLocationInput,
  Location,
  LocationListQuery,
  UpdateLocationInput,
} from '@inventory/shared';

export const locationIdParamsSchema = z.object({
  id: z.string().uuid('Not a valid location id'),
});
export type LocationIdParams = z.infer<typeof locationIdParamsSchema>;
