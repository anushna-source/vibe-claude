import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { SystemStatusCard } from '@/components/shared/system-status-card';
import { isApiError } from '@/lib/api-client';
import { getHealth } from '@/lib/health';

// The dashboard reads live data, so it must not be prerendered at build time.
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const health = await getHealth().catch((error: unknown) => (isApiError(error) ? error : null));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Asset counts and activity appear here once the asset module is built."
      />

      {health === null ? (
        <ErrorState
          title="Could not reach the API"
          description="An unexpected error occurred while loading the system status."
        />
      ) : isApiError(health) ? (
        <ErrorState
          title="Could not reach the API"
          description={health.message}
          {...(health.requestId ? { requestId: health.requestId } : {})}
        />
      ) : (
        <SystemStatusCard health={health} />
      )}

      <EmptyState
        title="No asset data yet"
        description="The database schema and the asset module are the next build steps."
      />
    </div>
  );
}
