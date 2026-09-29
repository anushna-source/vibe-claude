import { z } from 'zod';

/**
 * Domain enumerations, defined once and used by both apps. Each mirrors a
 * PostgreSQL enum created in apps/api/migrations.
 */

export const USER_ROLES = ['admin', 'it_staff', 'viewer'] as const;
export const userRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof userRoleSchema>;

export const STAFF_STATUSES = ['active', 'on_leave', 'left'] as const;
export const staffStatusSchema = z.enum(STAFF_STATUSES);
export type StaffStatus = z.infer<typeof staffStatusSchema>;

export const LOCATION_TYPES = ['office', 'lab', 'classroom', 'server_room', 'store'] as const;
export const locationTypeSchema = z.enum(LOCATION_TYPES);
export type LocationType = z.infer<typeof locationTypeSchema>;

export const ASSET_STATUSES = [
  'in_stock',
  'assigned',
  'in_repair',
  'retired',
  'disposed',
  'lost',
] as const;
export const assetStatusSchema = z.enum(ASSET_STATUSES);
export type AssetStatus = z.infer<typeof assetStatusSchema>;

export const ASSET_CONDITIONS = ['new', 'good', 'fair', 'poor', 'damaged'] as const;
export const assetConditionSchema = z.enum(ASSET_CONDITIONS);
export type AssetCondition = z.infer<typeof assetConditionSchema>;

/** An asset is assigned to a person OR a location, never both (AGENTS.md rule 6). */
export const ASSIGNEE_TYPES = ['staff', 'location'] as const;
export const assigneeTypeSchema = z.enum(ASSIGNEE_TYPES);
export type AssigneeType = z.infer<typeof assigneeTypeSchema>;

export const ASSET_EVENT_TYPES = [
  'created',
  'updated',
  'assigned',
  'returned',
  'transferred',
  'status_changed',
  'repair_started',
  'repair_completed',
  'retired',
  'disposed',
  'lost',
] as const;
export const assetEventTypeSchema = z.enum(ASSET_EVENT_TYPES);
export type AssetEventType = z.infer<typeof assetEventTypeSchema>;
