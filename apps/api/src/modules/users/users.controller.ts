import { toApiListResponse, toApiResponse } from '@inventory/shared';
import type { RequestHandler } from 'express';
import { requireUser } from '../../middleware/authenticate.js';
import { getRequestId } from '../../middleware/request-id.js';
import { validated } from '../../middleware/validate.js';
import type { ListUsersQuery, UpdateUserInput, UserIdParams } from './users.schema.js';
import { listUsers, updateUser } from './users.service.js';

export const listUsersHandler: RequestHandler = (_req, res, next) => {
  const { query } = validated<unknown, ListUsersQuery>(res);

  listUsers(query)
    .then(({ data, meta }) => {
      res.status(200).json(toApiListResponse(data, meta));
    })
    .catch(next);
};

export const updateUserHandler: RequestHandler = (_req, res, next) => {
  const { body, params } = validated<UpdateUserInput, unknown, UserIdParams>(res);
  const actor = requireUser(res);

  updateUser(params.id, body, actor.userId, getRequestId(res))
    .then((user) => {
      res.status(200).json(toApiResponse(user));
    })
    .catch(next);
};
