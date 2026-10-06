import { toApiListResponse, toApiResponse } from '@inventory/shared';
import type { RequestHandler } from 'express';
import { requireUser } from '../../middleware/authenticate.js';
import { getRequestId } from '../../middleware/request-id.js';
import { validated } from '../../middleware/validate.js';
import type {
  CategoryIdParams,
  CategoryListQuery,
  CreateCategoryInput,
  UpdateCategoryInput,
} from './categories.schema.js';
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from './categories.service.js';

export const listCategoriesHandler: RequestHandler = (_req, res, next) => {
  const { query } = validated<unknown, CategoryListQuery>(res);

  listCategories(query)
    .then(({ data, meta }) => {
      res.status(200).json(toApiListResponse(data, meta));
    })
    .catch(next);
};

export const createCategoryHandler: RequestHandler = (_req, res, next) => {
  const { body } = validated<CreateCategoryInput>(res);
  const actor = requireUser(res);

  createCategory(body, actor.userId, getRequestId(res))
    .then((category) => {
      res.status(201).json(toApiResponse(category));
    })
    .catch(next);
};

export const updateCategoryHandler: RequestHandler = (_req, res, next) => {
  const { body, params } = validated<UpdateCategoryInput, unknown, CategoryIdParams>(res);
  const actor = requireUser(res);

  updateCategory(params.id, body, actor.userId, getRequestId(res))
    .then((category) => {
      res.status(200).json(toApiResponse(category));
    })
    .catch(next);
};

export const deleteCategoryHandler: RequestHandler = (_req, res, next) => {
  const { params } = validated<unknown, unknown, CategoryIdParams>(res);
  const actor = requireUser(res);

  deleteCategory(params.id, actor.userId, getRequestId(res))
    .then(() => {
      res.status(204).end();
    })
    .catch(next);
};
