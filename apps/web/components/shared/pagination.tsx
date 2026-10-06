import Link from 'next/link';
import type { PaginationMeta } from '@inventory/shared';
import { Button } from '@/components/ui/button';

export interface PaginationProps {
  meta: PaginationMeta;
  /** Current query, so paging keeps the search and filters. */
  params: Record<string, string | undefined>;
  basePath: string;
}

function hrefFor(basePath: string, params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value && key !== 'page') search.set(key, value);
  }
  if (page > 1) search.set('page', String(page));

  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/**
 * Paging lives in the URL, so a filtered page is linkable and the back button
 * behaves. Disabled ends render as text, never as a link to nowhere.
 */
export function Pagination({ meta, params, basePath }: PaginationProps) {
  const lastPage = Math.max(1, Math.ceil(meta.total / meta.limit));
  const first = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const last = Math.min(meta.page * meta.limit, meta.total);

  const hasPrevious = meta.page > 1;
  const hasNext = meta.page < lastPage;

  if (meta.total === 0) return null;

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing {first}–{last} of {meta.total}
      </p>

      <div className="flex items-center gap-2">
        {hasPrevious ? (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefFor(basePath, params, meta.page - 1)} rel="prev">
              Previous
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
        )}

        {hasNext ? (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefFor(basePath, params, meta.page + 1)} rel="next">
              Next
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        )}
      </div>
    </nav>
  );
}
