'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';

/** Catches anything a dashboard page throws during render. */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console -- surfacing the cause in the browser console is the point
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Something went wrong"
      description="This page could not be displayed. Try again, and if it keeps happening tell IT."
      {...(error.digest ? { requestId: error.digest } : {})}
      action={
        <Button size="sm" variant="outline" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
