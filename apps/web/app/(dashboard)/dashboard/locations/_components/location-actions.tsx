'use client';

import {
  createLocationSchema,
  LOCATION_TYPES,
  updateLocationSchema,
  type CreateLocationInput,
  type Location,
} from '@inventory/shared';
import { Plus } from 'lucide-react';
import { ConfirmDelete } from '@/components/shared/confirm-delete';
import { Button } from '@/components/ui/button';
import {
  createLocationAction,
  deleteLocationAction,
  updateLocationAction,
} from '../../reference-actions';
import { RecordFormDialog, type FieldSpec } from '../../_components/record-form-dialog';

const TYPE_LABELS: Record<(typeof LOCATION_TYPES)[number], string> = {
  office: 'Office',
  lab: 'Lab',
  classroom: 'Classroom',
  server_room: 'Server room',
  store: 'Store',
};

const FIELDS: readonly FieldSpec[] = [
  { name: 'name', label: 'Name', placeholder: 'Lab 1' },
  {
    name: 'type',
    label: 'Type',
    options: LOCATION_TYPES.map((type) => ({ value: type, label: TYPE_LABELS[type] })),
  },
  { name: 'building', label: 'Building', hint: 'Optional' },
  { name: 'floor', label: 'Floor', hint: 'Optional' },
];

export function CreateLocation() {
  return (
    <RecordFormDialog<CreateLocationInput>
      title="Add a location"
      description="Rooms and areas that hold equipment."
      trigger={
        <Button size="sm">
          <Plus className="size-4" aria-hidden="true" />
          Add location
        </Button>
      }
      schema={createLocationSchema}
      fields={FIELDS}
      defaultValues={{ name: '', type: 'lab', building: '', floor: '' }}
      submitLabel="Add location"
      action={async (values) => createLocationAction(values)}
    />
  );
}

export function EditLocation({ location }: { location: Location }) {
  return (
    <RecordFormDialog
      title={`Edit ${location.name}`}
      trigger={
        <Button variant="ghost" size="sm">
          Edit
        </Button>
      }
      schema={updateLocationSchema}
      fields={FIELDS}
      defaultValues={{
        name: location.name,
        type: location.type,
        building: location.building ?? '',
        floor: location.floor ?? '',
      }}
      submitLabel="Save changes"
      action={async (values) => updateLocationAction(location.id, values)}
    />
  );
}

export function DeleteLocation({ location }: { location: Location }) {
  return (
    <ConfirmDelete name={location.name} action={async () => deleteLocationAction(location.id)} />
  );
}

export { TYPE_LABELS };
