import type { Category } from '@inventory/shared';
import type { Metadata } from 'next';
import { DataTable, type Column } from '@/components/shared/data-table';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { SearchInput } from '@/components/shared/search-input';
import { isApiError } from '@/lib/api-client';
import { listCategories } from '@/lib/reference';
import { getCurrentUser } from '@/lib/session';
import { CreateCategory, DeleteCategory, EditCategory } from './_components/category-actions';

export const metadata: Metadata = { title: 'Categories' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CategoriesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Number(single(params.page) ?? '1');
  const q = single(params.q);

  const [user, result] = await Promise.all([
    getCurrentUser(),
    listCategories({
      page: Number.isFinite(page) && page > 0 ? page : 1,
      ...(q ? { q } : {}),
    }).catch((error: unknown) => (isApiError(error) ? error : null)),
  ]);

  const canWrite = user?.role === 'admin' || user?.role === 'it_staff';
  const canDelete = user?.role === 'admin';

  if (result === null || isApiError(result)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Categories" />
        <ErrorState
          title="Could not load categories"
          description={isApiError(result) ? result.message : 'An unexpected error occurred.'}
          {...(isApiError(result) && result.requestId ? { requestId: result.requestId } : {})}
        />
      </div>
    );
  }

  const columns: readonly Column<Category>[] = [
    {
      key: 'code',
      header: 'Code',
      cell: (row) => <span className="font-mono text-sm font-medium">{row.code}</span>,
    },
    { key: 'name', header: 'Name', cell: (row) => row.name },
    {
      key: 'nextTag',
      header: 'Next tag',
      hideOnMobile: true,
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground">
          BI-{row.code}-{String(row.nextTagNumber).padStart(4, '0')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          {canWrite ? <EditCategory category={row} /> : null}
          {canDelete ? <DeleteCategory category={row} /> : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Each category's code becomes part of every asset tag in it."
        actions={canWrite ? <CreateCategory /> : null}
      />

      <SearchInput placeholder="Search categories" label="Search categories" />

      <DataTable
        caption="Categories"
        columns={columns}
        rows={result.data}
        rowKey={(row) => row.id}
        empty={{
          title: q ? 'No categories match that search' : 'No categories yet',
          description: q
            ? 'Try a different term.'
            : 'Add the kinds of equipment you track, such as Laptop (LAP).',
          ...(canWrite && !q ? { action: <CreateCategory /> } : {}),
        }}
      />

      <Pagination
        meta={result.meta}
        basePath="/dashboard/categories"
        params={{ ...(q ? { q } : {}) }}
      />
    </div>
  );
}
