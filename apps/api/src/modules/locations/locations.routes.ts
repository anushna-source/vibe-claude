import { Router } from 'express';
import { requireAuth } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
  createLocationHandler,
  deleteLocationHandler,
  listLocationsHandler,
  updateLocationHandler,
} from './locations.controller.js';
import {
  createLocationSchema,
  locationIdParamsSchema,
  locationListQuerySchema,
  updateLocationSchema,
} from './locations.schema.js';

export const locationsRouter: Router = Router();

locationsRouter.use(requireAuth);

locationsRouter.get('/', validate({ query: locationListQuerySchema }), listLocationsHandler);

locationsRouter.post(
  '/',
  requireRole('admin', 'it_staff'),
  validate({ body: createLocationSchema }),
  createLocationHandler,
);

locationsRouter.patch(
  '/:id',
  requireRole('admin', 'it_staff'),
  validate({ params: locationIdParamsSchema, body: updateLocationSchema }),
  updateLocationHandler,
);

locationsRouter.delete(
  '/:id',
  requireRole('admin'),
  validate({ params: locationIdParamsSchema }),
  deleteLocationHandler,
);
