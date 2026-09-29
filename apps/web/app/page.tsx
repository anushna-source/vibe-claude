import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ErrorState } from '@/components/shared/error-state';
import { SystemStatusCard } from '@/components/shared/system-status-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { isApiError } from '@/lib/api-client';
import { getHealth } from '@/lib/health';
import { getCurrentUser } from '@/lib/session';
import { BuildProgress } from './_components/build-progress';
import { ModuleGrid } from './_components/module-grid';

export const metadata: Metadata = {
  title: 'Home',
};

// Reads live health, so it must not be prerendered at build time.
export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const [health, user] = await Promise.all([
    getHealth().catch((error: unknown) => (isApiError(error) ? error : null)),
    getCurrentUser(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 md:py-16">
      <header className="space-y-4">
        <Badge variant="muted">Internal tool · v1.0.0</Badge>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Broadway Infosys Inventory
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          Track every IT asset from purchase to disposal: staff laptops and phones, training-lab
          desktops, projectors and classroom displays, networking gear, peripherals and spares.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {user ? (
            <>
              <Button asChild>
                <Link href="/dashboard">
                  Open the dashboard
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <p className="text-sm text-muted-foreground">Signed in as {user.fullName}.</p>
            </>
          ) : (
            <>
              <Button asChild>
                <Link href="/signup">
                  Create an account
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/login">Sign in</Link>
              </Button>
              <p className="text-sm text-muted-foreground">
                New accounts can view assets and staff.
              </p>
            </>
          )}
        </div>
      </header>

      <section aria-labelledby="status-heading" className="mt-12">
        <h2 id="status-heading" className="sr-only">
          System status
        </h2>
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
      </section>

      <section aria-labelledby="modules-heading" className="mt-12">
        <h2 id="modules-heading" className="text-lg font-semibold tracking-tight">
          What you can do
        </h2>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">
          Modules arrive in order. Anything marked with a build step is not available yet.
        </p>
        <ModuleGrid />
      </section>

      <section aria-labelledby="progress-heading" className="mt-12">
        <h2 id="progress-heading" className="text-lg font-semibold tracking-tight">
          Where the build is
        </h2>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">
          Each step assumes the previous one works, so they ship in sequence.
        </p>
        <BuildProgress />
      </section>

      <footer className="mt-12 border-t pt-6 text-sm text-muted-foreground">
        To request equipment or report a problem with an asset, contact the IT department.
      </footer>
    </div>
  );
}
