import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  title: string;
  description?: string;
  /** Shown in small print so a failure can be traced in the API logs. */
  requestId?: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({ title, description, requestId, action, className }: ErrorStateProps) {
  return (
    <Alert variant="destructive" className={cn('flex gap-3', className)}>
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          {description ? <p>{description}</p> : null}
          {requestId ? (
            <p className="mt-2 font-mono text-xs opacity-80">Request ID: {requestId}</p>
          ) : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </AlertDescription>
      </div>
    </Alert>
  );
}
