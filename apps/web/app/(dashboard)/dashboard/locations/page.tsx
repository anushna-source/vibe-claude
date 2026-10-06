import type { Location } from '@inventory/shared';
import type { Metadata } from 'next';
import { DataTable, type Column } from '@/components/shared/data-table';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { SearchInput } from '@/components/shared/search-input';
import { Badge } from '@/components/ui/badge';
import { isApiError } from '@/lib/api-client';
import { listLocations } from '@/lib/reference';
import { getCurrentUser } from '@/lib/session';
import {
  CreateLocation,
  DeleteLocation,
  EditLocation,
  TYPE_LABELS,
} from './_components/location-actions';

export const metadata: Metadata = { title: 'Locations' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LocationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Number(single(params.page) ?? '1');
  const q = single(params.q);

  const [user, result] = await Promise.all([
    getCurrentUser(),
    listLocations({
      page: Number.isFinite(page) && page > 0 ? page : 1,
      ...(q ? { q } : {}),
    }).catch((error: unknown) => (isApiError(error) ? error : null)),
  ]);

  // The server decides; this only keeps controls out of the way of someone who
  // cannot use them. The API refuses regardless.
  const canWrite = user?.role === 'admin' || user?.role === 'it_staff';
  const canDelete = user?.role === 'admin';

  if (result === null || isApiError(result)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Locations" />
        <ErrorState
          title="Could not load locations"
          description={isApiError(result) ? result.message : 'An unexpected error occurred.'}
          {...(isApiError(result) && result.requestId ? { requestId: result.requestId } : {})}
        />
      </div>
    );
  }

  const columns: readonly Column<Location>[] = [
    { key: 'name', header: 'Name', cell: (row) => <span className="font-medium">{row.name}</span> },
    {
      key: 'type',
      header: 'Type',
      cell: (row) => <Badge variant="muted">{TYPE_LABELS[row.type]}</Badge>,
    },
    {
      key: 'building',
      header: 'Building',
      hideOnMobile: true,
      cell: (row) => row.building ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'floor',
      header: 'Floor',
      hideOnMobile: true,
      cell: (row) => row.floor ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          {canWrite ? <EditLocation location={row} /> : null}
          {canDelete ? <DeleteLocation location={row} /> : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Locations"
        description="Rooms and areas that hold shared equipment."
        actions={canWrite ? <CreateLocation /> : null}
      />

      <SearchInput placeholder="Search locations" label="Search locations" />

      <DataTable
        caption="Locations"
        columns={columns}
        rows={result.data}
        rowKey={(row) => row.id}
        empty={{
          title: q ? 'No locations match that search' : 'No locations yet',
          description: q
            ? 'Try a different term.'
            : 'Add the rooms and areas that hold equipment, such as Lab 1 or the store.',
          ...(canWrite && !q ? { action: <CreateLocation /> } : {}),
        }}
      />

      <Pagination
        meta={result.meta}
        basePath="/dashboard/locations"
        params={{ ...(q ? { q } : {}) }}
      />
    </div>
  );
}
