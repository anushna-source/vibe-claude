import { Router } from 'express';
import { requireAuth } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
  createDepartmentHandler,
  deleteDepartmentHandler,
  listDepartmentsHandler,
  updateDepartmentHandler,
} from './departments.controller.js';
import {
  createDepartmentSchema,
  departmentIdParamsSchema,
  departmentListQuerySchema,
  updateDepartmentSchema,
} from './departments.schema.js';

/**
 * Everyone signed in can read. Admin and IT Staff maintain the list; only Admin
 * can delete. Enforced here, on the server.
 */
export const departmentsRouter: Router = Router();

departmentsRouter.use(requireAuth);

departmentsRouter.get('/', validate({ query: departmentListQuerySchema }), listDepartmentsHandler);

departmentsRouter.post(
  '/',
  requireRole('admin', 'it_staff'),
  validate({ body: createDepartmentSchema }),
  createDepartmentHandler,
);

departmentsRouter.patch(
  '/:id',
  requireRole('admin', 'it_staff'),
  validate({ params: departmentIdParamsSchema, body: updateDepartmentSchema }),
  updateDepartmentHandler,
);

departmentsRouter.delete(
  '/:id',
  requireRole('admin'),
  validate({ params: departmentIdParamsSchema }),
  deleteDepartmentHandler,
);
