import { Boxes, MapPin, Repeat, Users, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * A module is either built and linkable, or not built and rendered as plain
 * text. Nothing here is ever a link to a route that does not exist.
 */
export interface Module {
  label: string;
  description: string;
  icon: LucideIcon;
  /** Set once the module ships. */
  href?: string;
  /** The CLAUDE.md build step that delivers it. */
  step: number;
}

export const MODULES: readonly Module[] = [
  {
    label: 'Assets',
    description: 'Every laptop, desktop, projector and switch, from purchase to disposal.',
    icon: Boxes,
    step: 6,
  },
  {
    label: 'Staff',
    description: 'The people assets are issued to, imported from CSV.',
    icon: Users,
    step: 5,
  },
  {
    label: 'Locations',
    description: 'Labs, classrooms and stores that hold shared equipment.',
    icon: MapPin,
    href: '/dashboard/locations',
    step: 4,
  },
  {
    label: 'Assignments',
    description: 'Issue, return and transfer equipment, with a full timeline per asset.',
    icon: Repeat,
    step: 7,
  },
];

// Named `entry` rather than `module`: Next forbids shadowing the CommonJS
// `module` variable (@next/next/no-assign-module-variable).
function ModuleCard({ entry }: { entry: Module }) {
  const { label, description, icon: Icon, href, step } = entry;

  const body = (
    <CardHeader>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Icon
            className={cn('size-4', href ? 'text-primary' : 'text-muted-foreground')}
            aria-hidden="true"
          />
          <CardTitle>{label}</CardTitle>
        </div>
        {href ? (
          <Badge variant="success">Available</Badge>
        ) : (
          <Badge variant="muted">Build step {step}</Badge>
        )}
      </div>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
  );

  if (!href) {
    return (
      <Card
        aria-label={`${label} (not built yet)`}
        className="border-dashed bg-muted/40 shadow-none"
      >
        {body}
      </Card>
    );
  }

  return (
    <Card className="transition-colors focus-within:ring-2 focus-within:ring-ring hover:border-primary/40">
      <Link href={href} className="block rounded-lg outline-none">
        {body}
      </Link>
    </Card>
  );
}

export function ModuleGrid({ modules = MODULES }: { modules?: readonly Module[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {modules.map((entry) => (
        <li key={entry.label}>
          <ModuleCard entry={entry} />
        </li>
      ))}
    </ul>
  );
}
