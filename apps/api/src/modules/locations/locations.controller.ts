import { toApiListResponse, toApiResponse } from '@inventory/shared';
import type { RequestHandler } from 'express';
import { requireUser } from '../../middleware/authenticate.js';
import { getRequestId } from '../../middleware/request-id.js';
import { validated } from '../../middleware/validate.js';
import type {
  CreateLocationInput,
  LocationIdParams,
  LocationListQuery,
  UpdateLocationInput,
} from './locations.schema.js';
import {
  createLocation,
  deleteLocation,
  listLocations,
  updateLocation,
} from './locations.service.js';

export const listLocationsHandler: RequestHandler = (_req, res, next) => {
  const { query } = validated<unknown, LocationListQuery>(res);

  listLocations(query)
    .then(({ data, meta }) => {
      res.status(200).json(toApiListResponse(data, meta));
    })
    .catch(next);
};

export const createLocationHandler: RequestHandler = (_req, res, next) => {
  const { body } = validated<CreateLocationInput>(res);
  const actor = requireUser(res);

  createLocation(body, actor.userId, getRequestId(res))
    .then((location) => {
      res.status(201).json(toApiResponse(location));
    })
    .catch(next);
};

export const updateLocationHandler: RequestHandler = (_req, res, next) => {
  const { body, params } = validated<UpdateLocationInput, unknown, LocationIdParams>(res);
  const actor = requireUser(res);

  updateLocation(params.id, body, actor.userId, getRequestId(res))
    .then((location) => {
      res.status(200).json(toApiResponse(location));
    })
    .catch(next);
};

export const deleteLocationHandler: RequestHandler = (_req, res, next) => {
  const { params } = validated<unknown, unknown, LocationIdParams>(res);
  const actor = requireUser(res);

  deleteLocation(params.id, actor.userId, getRequestId(res))
    .then(() => {
      res.status(204).end();
    })
    .catch(next);
};
