import { Check, CircleDashed, CircleDot } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Mirrors the build order in CLAUDE.md. Keep the two in step. */
export const BUILD_STEPS: readonly string[] = [
  'Scaffold and health check',
  'Database schema and migrations',
  'Authentication and roles',
  'Locations, departments, categories',
  'Staff and CSV import',
  'Assets',
  'Assignments',
  'Search and filters',
  'Dashboard and reports',
  'Audit log and hardening',
  'Real data and physical count',
];

/** 1-based index of the step currently being built. */
export const CURRENT_STEP = 2;

export function BuildProgress({
  steps = BUILD_STEPS,
  currentStep = CURRENT_STEP,
}: {
  steps?: readonly string[];
  currentStep?: number;
}) {
  return (
    <ol className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {steps.map((label, index) => {
        const number = index + 1;
        const done = number < currentStep;
        const current = number === currentStep;
        const Icon = done ? Check : current ? CircleDot : CircleDashed;

        return (
          <li key={label} className="flex items-center gap-2.5 text-sm">
            <Icon
              className={cn(
                'size-4 shrink-0',
                done && 'text-success',
                current && 'text-primary',
                !done && !current && 'text-muted-foreground/50',
              )}
              aria-hidden="true"
            />
            <span className={cn(current ? 'font-medium' : 'text-muted-foreground')}>{label}</span>
            {current ? <span className="text-xs font-medium text-primary">in progress</span> : null}
            <span className="sr-only">
              {done ? 'completed' : current ? 'current step' : 'not started'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
