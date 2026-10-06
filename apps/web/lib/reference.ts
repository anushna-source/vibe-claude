import 'server-only';
import {
  categorySchema,
  departmentSchema,
  locationSchema,
  type Category,
  type CreateCategoryInput,
  type CreateDepartmentInput,
  type CreateLocationInput,
  type Department,
  type Location,
  type UpdateCategoryInput,
  type UpdateDepartmentInput,
  type UpdateLocationInput,
} from '@inventory/shared';
import { z, type ZodType } from 'zod';
import { apiListRequest, apiRequest, type ApiListResult } from './api-client';
import { getAccessToken } from './session';

/**
 * Reference data read and written through lib/api-client.ts, with the bearer
 * token taken from the session cookie. Server side only: the token must never
 * reach the browser.
 */

export type PagedResult<T> = ApiListResult<T>;

export interface ListParams {
  page?: number | undefined;
  limit?: number | undefined;
  q?: string | undefined;
  type?: string | undefined;
}

function toQueryString(params: ListParams): string {
  const search = new URLSearchParams();

  if (params.page && params.page > 1) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));
  if (params.q) search.set('q', params.q);
  if (params.type) search.set('type', params.type);

  const query = search.toString();
  return query ? `?${query}` : '';
}

async function token(): Promise<string> {
  const value = await getAccessToken();
  // Middleware redirects a signed-out visitor long before this runs.
  return value ?? '';
}

async function list<T>(
  resource: string,
  item: ZodType<T>,
  params: ListParams,
): Promise<PagedResult<T>> {
  return apiListRequest<T>(`/${resource}${toQueryString(params)}`, {
    itemSchema: item,
    accessToken: await token(),
  });
}

async function create<TInput, TOut>(
  resource: string,
  item: ZodType<TOut>,
  input: TInput,
): Promise<TOut> {
  return apiRequest<TOut>(`/${resource}`, {
    method: 'POST',
    body: input,
    schema: z.object({ data: item }),
    accessToken: await token(),
  });
}

async function update<TInput, TOut>(
  resource: string,
  item: ZodType<TOut>,
  id: string,
  input: TInput,
): Promise<TOut> {
  return apiRequest<TOut>(`/${resource}/${id}`, {
    method: 'PATCH',
    body: input,
    schema: z.object({ data: item }),
    accessToken: await token(),
  });
}

async function remove(resource: string, id: string): Promise<void> {
  await apiRequest<void>(`/${resource}/${id}`, {
    method: 'DELETE',
    accessToken: await token(),
  });
}

/* Departments */
export const listDepartments = (params: ListParams = {}): Promise<PagedResult<Department>> =>
  list('departments', departmentSchema, params);
export const createDepartment = (input: CreateDepartmentInput): Promise<Department> =>
  create('departments', departmentSchema, input);
export const updateDepartment = (id: string, input: UpdateDepartmentInput): Promise<Department> =>
  update('departments', departmentSchema, id, input);
export const deleteDepartment = (id: string): Promise<void> => remove('departments', id);

/* Locations */
export const listLocations = (params: ListParams = {}): Promise<PagedResult<Location>> =>
  list('locations', locationSchema, params);
export const createLocation = (input: CreateLocationInput): Promise<Location> =>
  create('locations', locationSchema, input);
export const updateLocation = (id: string, input: UpdateLocationInput): Promise<Location> =>
  update('locations', locationSchema, id, input);
export const deleteLocation = (id: string): Promise<void> => remove('locations', id);

/* Categories */
export const listCategories = (params: ListParams = {}): Promise<PagedResult<Category>> =>
  list('categories', categorySchema, params);
export const createCategory = (input: CreateCategoryInput): Promise<Category> =>
  create('categories', categorySchema, input);
export const updateCategory = (id: string, input: UpdateCategoryInput): Promise<Category> =>
  update('categories', categorySchema, id, input);
export const deleteCategory = (id: string): Promise<void> => remove('categories', id);
