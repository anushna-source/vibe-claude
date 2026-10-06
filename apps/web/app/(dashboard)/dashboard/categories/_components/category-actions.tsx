'use client';

import {
  createCategorySchema,
  updateCategorySchema,
  type Category,
  type CreateCategoryInput,
} from '@inventory/shared';
import { Plus } from 'lucide-react';
import { ConfirmDelete } from '@/components/shared/confirm-delete';
import { Button } from '@/components/ui/button';
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from '../../reference-actions';
import { RecordFormDialog, type FieldSpec } from '../../_components/record-form-dialog';

const FIELDS: readonly FieldSpec[] = [
  { name: 'name', label: 'Name', placeholder: 'Laptop' },
  {
    name: 'code',
    label: 'Code',
    hint: 'Two to six letters. Becomes part of every asset tag, e.g. BI-LAP-0042.',
    placeholder: 'LAP',
  },
];

export function CreateCategory() {
  return (
    <RecordFormDialog<CreateCategoryInput>
      title="Add a category"
      description="The code becomes part of every asset tag in this category."
      trigger={
        <Button size="sm">
          <Plus className="size-4" aria-hidden="true" />
          Add category
        </Button>
      }
      schema={createCategorySchema}
      fields={FIELDS}
      defaultValues={{ name: '', code: '' }}
      submitLabel="Add category"
      action={async (values) => createCategoryAction(values)}
    />
  );
}

export function EditCategory({ category }: { category: Category }) {
  return (
    <RecordFormDialog
      title={`Edit ${category.name}`}
      description="The code can only change while no asset carries it in a tag."
      trigger={
        <Button variant="ghost" size="sm">
          Edit
        </Button>
      }
      schema={updateCategorySchema}
      fields={FIELDS}
      defaultValues={{ name: category.name, code: category.code }}
      submitLabel="Save changes"
      action={async (values) => updateCategoryAction(category.id, values)}
    />
  );
}

export function DeleteCategory({ category }: { category: Category }) {
  return (
    <ConfirmDelete name={category.name} action={async () => deleteCategoryAction(category.id)} />
  );
}
