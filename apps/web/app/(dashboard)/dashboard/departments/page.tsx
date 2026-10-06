import type { Department } from '@inventory/shared';
import type { Metadata } from 'next';
import { DataTable, type Column } from '@/components/shared/data-table';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { SearchInput } from '@/components/shared/search-input';
import { isApiError } from '@/lib/api-client';
import { listDepartments } from '@/lib/reference';
import { getCurrentUser } from '@/lib/session';
import {
  CreateDepartment,
  DeleteDepartment,
  EditDepartment,
} from './_components/department-actions';

export const metadata: Metadata = { title: 'Departments' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DepartmentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Number(single(params.page) ?? '1');
  const q = single(params.q);

  const [user, result] = await Promise.all([
    getCurrentUser(),
    listDepartments({
      page: Number.isFinite(page) && page > 0 ? page : 1,
      ...(q ? { q } : {}),
    }).catch((error: unknown) => (isApiError(error) ? error : null)),
  ]);

  const canWrite = user?.role === 'admin' || user?.role === 'it_staff';
  const canDelete = user?.role === 'admin';

  if (result === null || isApiError(result)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Departments" />
        <ErrorState
          title="Could not load departments"
          description={isApiError(result) ? result.message : 'An unexpected error occurred.'}
          {...(isApiError(result) && result.requestId ? { requestId: result.requestId } : {})}
        />
      </div>
    );
  }

  const columns: readonly Column<Department>[] = [
    { key: 'name', header: 'Name', cell: (row) => <span className="font-medium">{row.name}</span> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          {canWrite ? <EditDepartment department={row} /> : null}
          {canDelete ? <DeleteDepartment department={row} /> : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Staff are grouped by department."
        actions={canWrite ? <CreateDepartment /> : null}
      />

      <SearchInput placeholder="Search departments" label="Search departments" />

      <DataTable
        caption="Departments"
        columns={columns}
        rows={result.data}
        rowKey={(row) => row.id}
        empty={{
          title: q ? 'No departments match that search' : 'No departments yet',
          description: q ? 'Try a different term.' : 'Add the departments staff belong to.',
          ...(canWrite && !q ? { action: <CreateDepartment /> } : {}),
        }}
      />

      <Pagination
        meta={result.meta}
        basePath="/dashboard/departments"
        params={{ ...(q ? { q } : {}) }}
      />
    </div>
  );
}
