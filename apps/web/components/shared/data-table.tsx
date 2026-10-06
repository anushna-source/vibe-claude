import type { ReactNode } from 'react';
import { EmptyState } from '@/components/shared/empty-state';
import { cn } from '@/lib/utils';

/**
 * The table every list screen uses. Reuse it rather than rebuilding per page
 * (AGENTS.md), so empty states and alignment stay consistent.
 */

export interface Column<T> {
  key: string;
  header: string;
  /** Renders the cell. Keeps formatting out of the page. */
  cell: (row: T) => ReactNode;
  /** Right-align numeric columns and the actions column. */
  align?: 'left' | 'right';
  /** Hide below the small breakpoint, for secondary detail. */
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  caption?: string;
  empty: { title: string; description?: string; action?: ReactNode };
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  empty,
  className,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title={empty.title}
        {...(empty.description ? { description: empty.description } : {})}
        {...(empty.action ? { action: empty.action } : {})}
      />
    );
  }

  return (
    <div className={cn('overflow-x-auto rounded-lg border', className)}>
      <table className="w-full text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="bg-muted/50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'px-4 py-2.5 text-left text-xs font-medium text-muted-foreground',
                  column.align === 'right' && 'text-right',
                  column.hideOnMobile && 'hidden sm:table-cell',
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-t">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'px-4 py-2.5 align-middle',
                    column.align === 'right' && 'text-right',
                    column.hideOnMobile && 'hidden sm:table-cell',
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
