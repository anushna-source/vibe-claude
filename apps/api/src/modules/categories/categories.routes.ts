import { Router } from 'express';
import { requireAuth } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
  createCategoryHandler,
  deleteCategoryHandler,
  listCategoriesHandler,
  updateCategoryHandler,
} from './categories.controller.js';
import {
  categoryIdParamsSchema,
  categoryListQuerySchema,
  createCategorySchema,
  updateCategorySchema,
} from './categories.schema.js';

export const categoriesRouter: Router = Router();

categoriesRouter.use(requireAuth);

categoriesRouter.get('/', validate({ query: categoryListQuerySchema }), listCategoriesHandler);

categoriesRouter.post(
  '/',
  requireRole('admin', 'it_staff'),
  validate({ body: createCategorySchema }),
  createCategoryHandler,
);

categoriesRouter.patch(
  '/:id',
  requireRole('admin', 'it_staff'),
  validate({ params: categoryIdParamsSchema, body: updateCategorySchema }),
  updateCategoryHandler,
);

categoriesRouter.delete(
  '/:id',
  requireRole('admin'),
  validate({ params: categoryIdParamsSchema }),
  deleteCategoryHandler,
);
