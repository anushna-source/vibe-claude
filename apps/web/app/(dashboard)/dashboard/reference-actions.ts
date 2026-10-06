'use server';

import {
  createCategorySchema,
  createDepartmentSchema,
  createLocationSchema,
  updateCategorySchema,
  updateDepartmentSchema,
  updateLocationSchema,
} from '@inventory/shared';
import { revalidatePath } from 'next/cache';
import type { ZodType } from 'zod';
import { isApiError } from '@/lib/api-client';
import * as reference from '@/lib/reference';

/**
 * Mutations for the reference lists. The API enforces the roles; these actions
 * simply surface its answer, including the 409 refusals, which are the useful
 * ones: "Lab 1 still holds 12 assets".
 */

export interface ActionResult {
  error: string;
}

async function run(path: string, work: () => Promise<unknown>): Promise<ActionResult | undefined> {
  try {
    await work();
  } catch (error) {
    return { error: isApiError(error) ? error.message : 'Something went wrong' };
  }

  revalidatePath(path);
  return undefined;
}

function parse<T>(schema: ZodType<T>, values: unknown): T | ActionResult {
  const parsed = schema.safeParse(values);
  // The form validates with the same schema, so this is a tampered request.
  return parsed.success ? parsed.data : { error: 'Please check the details you entered' };
}

function isFailure(value: unknown): value is ActionResult {
  return typeof value === 'object' && value !== null && 'error' in value;
}

/* Departments ------------------------------------------------------------- */

export async function createDepartmentAction(values: unknown): Promise<ActionResult | undefined> {
  const input = parse(createDepartmentSchema, values);
  if (isFailure(input)) return input;

  return run('/dashboard/departments', () => reference.createDepartment(input));
}

export async function updateDepartmentAction(
  id: string,
  values: unknown,
): Promise<ActionResult | undefined> {
  const input = parse(updateDepartmentSchema, values);
  if (isFailure(input)) return input;

  return run('/dashboard/departments', () => reference.updateDepartment(id, input));
}

export async function deleteDepartmentAction(id: string): Promise<ActionResult | undefined> {
  return run('/dashboard/departments', () => reference.deleteDepartment(id));
}

/* Locations --------------------------------------------------------------- */

export async function createLocationAction(values: unknown): Promise<ActionResult | undefined> {
  const input = parse(createLocationSchema, values);
  if (isFailure(input)) return input;

  return run('/dashboard/locations', () => reference.createLocation(input));
}

export async function updateLocationAction(
  id: string,
  values: unknown,
): Promise<ActionResult | undefined> {
  const input = parse(updateLocationSchema, values);
  if (isFailure(input)) return input;

  return run('/dashboard/locations', () => reference.updateLocation(id, input));
}

export async function deleteLocationAction(id: string): Promise<ActionResult | undefined> {
  return run('/dashboard/locations', () => reference.deleteLocation(id));
}

/* Categories -------------------------------------------------------------- */

export async function createCategoryAction(values: unknown): Promise<ActionResult | undefined> {
  const input = parse(createCategorySchema, values);
  if (isFailure(input)) return input;

  return run('/dashboard/categories', () => reference.createCategory(input));
}

export async function updateCategoryAction(
  id: string,
  values: unknown,
): Promise<ActionResult | undefined> {
  const input = parse(updateCategorySchema, values);
  if (isFailure(input)) return input;

  return run('/dashboard/categories', () => reference.updateCategory(id, input));
}

export async function deleteCategoryAction(id: string): Promise<ActionResult | undefined> {
  return run('/dashboard/categories', () => reference.deleteCategory(id));
}
