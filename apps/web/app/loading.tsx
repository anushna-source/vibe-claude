import { Skeleton } from '@/components/ui/skeleton';

export default function LandingLoading() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12 md:py-16" aria-busy="true" aria-live="polite">
      <div className="space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-96 max-w-full" />
        <Skeleton className="h-12 w-full max-w-2xl" />
        <Skeleton className="h-9 w-48" />
      </div>
      <Skeleton className="mt-12 h-40 w-full" />
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    </div>
  );
}
