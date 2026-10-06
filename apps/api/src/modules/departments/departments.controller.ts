import { toApiListResponse, toApiResponse } from '@inventory/shared';
import type { RequestHandler } from 'express';
import { requireUser } from '../../middleware/authenticate.js';
import { getRequestId } from '../../middleware/request-id.js';
import { validated } from '../../middleware/validate.js';
import type {
  CreateDepartmentInput,
  DepartmentIdParams,
  DepartmentListQuery,
  UpdateDepartmentInput,
} from './departments.schema.js';
import {
  createDepartment,
  deleteDepartment,
  listDepartments,
  updateDepartment,
} from './departments.service.js';

export const listDepartmentsHandler: RequestHandler = (_req, res, next) => {
  const { query } = validated<unknown, DepartmentListQuery>(res);

  listDepartments(query)
    .then(({ data, meta }) => {
      res.status(200).json(toApiListResponse(data, meta));
    })
    .catch(next);
};

export const createDepartmentHandler: RequestHandler = (_req, res, next) => {
  const { body } = validated<CreateDepartmentInput>(res);
  const actor = requireUser(res);

  createDepartment(body, actor.userId, getRequestId(res))
    .then((department) => {
      res.status(201).json(toApiResponse(department));
    })
    .catch(next);
};

export const updateDepartmentHandler: RequestHandler = (_req, res, next) => {
  const { body, params } = validated<UpdateDepartmentInput, unknown, DepartmentIdParams>(res);
  const actor = requireUser(res);

  updateDepartment(params.id, body, actor.userId, getRequestId(res))
    .then((department) => {
      res.status(200).json(toApiResponse(department));
    })
    .catch(next);
};

export const deleteDepartmentHandler: RequestHandler = (_req, res, next) => {
  const { params } = validated<unknown, unknown, DepartmentIdParams>(res);
  const actor = requireUser(res);

  deleteDepartment(params.id, actor.userId, getRequestId(res))
    .then(() => {
      res.status(204).end();
    })
    .catch(next);
};
