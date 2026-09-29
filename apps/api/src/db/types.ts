import type {
  AssetCondition,
  AssetEventType,
  AssetStatus,
  AssigneeType,
  LocationType,
  StaffStatus,
  UserRole,
} from '@inventory/shared';
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

/**
 * Hand-written to match apps/api/migrations. The integration tests select from
 * every table, so drift between this and the database fails the build.
 *
 * Columns are snake_case here; the mapping to camelCase happens in the service
 * layer (AGENTS.md, "API conventions").
 */

/** Set by the database on insert, never written by the application. */
type CreatedAt = ColumnType<Date, never, never>;
/** Maintained by the set_updated_at trigger. */
type UpdatedAt = ColumnType<Date, never, never>;
/** numeric comes back as a string so no precision is lost (rule 7). */
type Numeric = ColumnType<string, string | number, string | number>;

export interface UsersTable {
  id: Generated<string>;
  email: string;
  full_name: string;
  password_hash: string;
  role: Generated<UserRole>;
  is_active: Generated<boolean>;
  last_login_at: Date | null;
  created_by: string | null;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
  deleted_at: Date | null;
}

export interface DepartmentsTable {
  id: Generated<string>;
  name: string;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
  deleted_at: Date | null;
}

export interface LocationsTable {
  id: Generated<string>;
  name: string;
  type: LocationType;
  building: string | null;
  floor: string | null;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
  deleted_at: Date | null;
}

export interface CategoriesTable {
  id: Generated<string>;
  name: string;
  code: string;
  next_tag_number: Generated<number>;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
  deleted_at: Date | null;
}

export interface StaffTable {
  id: Generated<string>;
  employee_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  department_id: string | null;
  status: Generated<StaffStatus>;
  joined_on: Date | null;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
  deleted_at: Date | null;
}

export interface AssetsTable {
  id: Generated<string>;
  /** Immutable after insert; a trigger rejects any change (rule 1). */
  asset_tag: string;
  category_id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  status: Generated<AssetStatus>;
  condition: Generated<AssetCondition>;
  purchase_date: Date | null;
  purchase_price: Numeric | null;
  vendor: string | null;
  warranty_expires_on: Date | null;
  notes: string | null;
  current_assignment_id: string | null;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
  deleted_at: Date | null;
}

export interface AssignmentsTable {
  id: Generated<string>;
  asset_id: string;
  assignee_type: AssigneeType;
  staff_id: string | null;
  location_id: string | null;
  assigned_at: Generated<Date>;
  assigned_by: string | null;
  /** Null means this is the live assignment (rule 2). */
  returned_at: Date | null;
  returned_by: string | null;
  notes: string | null;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
  deleted_at: Date | null;
}

/** Append-only (rule 4): no update, no delete, no deleted_at. */
export interface AssetEventsTable {
  id: Generated<string>;
  asset_id: string;
  event_type: AssetEventType;
  assignment_id: string | null;
  actor_id: string | null;
  payload: Generated<unknown>;
  note: string | null;
  occurred_at: Generated<Date>;
}

/** Append-only (rule 4). */
export interface AuditLogsTable {
  id: Generated<string>;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before: unknown | null;
  after: unknown | null;
  request_id: string | null;
  created_at: Generated<Date>;
}

export interface Database {
  users: UsersTable;
  departments: DepartmentsTable;
  locations: LocationsTable;
  categories: CategoriesTable;
  staff: StaffTable;
  assets: AssetsTable;
  assignments: AssignmentsTable;
  asset_events: AssetEventsTable;
  audit_logs: AuditLogsTable;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

export type Asset = Selectable<AssetsTable>;
export type NewAsset = Insertable<AssetsTable>;
export type AssetUpdate = Updateable<AssetsTable>;

export type Assignment = Selectable<AssignmentsTable>;
export type NewAssignment = Insertable<AssignmentsTable>;

export type Staff = Selectable<StaffTable>;
export type Category = Selectable<CategoriesTable>;
export type Location = Selectable<LocationsTable>;
export type Department = Selectable<DepartmentsTable>;
export type AssetEvent = Selectable<AssetEventsTable>;
export type AuditLog = Selectable<AuditLogsTable>;
