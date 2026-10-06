'use client';

import {
  createDepartmentSchema,
  updateDepartmentSchema,
  type CreateDepartmentInput,
  type Department,
} from '@inventory/shared';
import { Plus } from 'lucide-react';
import { ConfirmDelete } from '@/components/shared/confirm-delete';
import { Button } from '@/components/ui/button';
import {
  createDepartmentAction,
  deleteDepartmentAction,
  updateDepartmentAction,
} from '../../reference-actions';
import { RecordFormDialog, type FieldSpec } from '../../_components/record-form-dialog';

const FIELDS: readonly FieldSpec[] = [{ name: 'name', label: 'Name', placeholder: 'Academics' }];

export function CreateDepartment() {
  return (
    <RecordFormDialog<CreateDepartmentInput>
      title="Add a department"
      description="Staff are grouped by department."
      trigger={
        <Button size="sm">
          <Plus className="size-4" aria-hidden="true" />
          Add department
        </Button>
      }
      schema={createDepartmentSchema}
      fields={FIELDS}
      defaultValues={{ name: '' }}
      submitLabel="Add department"
      action={async (values) => createDepartmentAction(values)}
    />
  );
}

export function EditDepartment({ department }: { department: Department }) {
  return (
    <RecordFormDialog
      title={`Edit ${department.name}`}
      trigger={
        <Button variant="ghost" size="sm">
          Edit
        </Button>
      }
      schema={updateDepartmentSchema}
      fields={FIELDS}
      defaultValues={{ name: department.name }}
      submitLabel="Save changes"
      action={async (values) => updateDepartmentAction(department.id, values)}
    />
  );
}

export function DeleteDepartment({ department }: { department: Department }) {
  return (
    <ConfirmDelete
      name={department.name}
      action={async () => deleteDepartmentAction(department.id)}
    />
  );
}
