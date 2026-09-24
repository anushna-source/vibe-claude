import type { Health } from '@inventory/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** Formats seconds as a short human duration, e.g. "2h 5m" or "48s". */
export function formatUptime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${total % 60}s`;
  return `${total}s`;
}

export function SystemStatusCard({ health }: { health: Health }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>API status</CardTitle>
          <Badge variant={health.status === 'ok' ? 'success' : 'warning'}>{health.status}</Badge>
        </div>
        <CardDescription>Live reading from the inventory API.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Version</dt>
            <dd className="mt-0.5 font-mono text-sm">{health.version}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Environment</dt>
            <dd className="mt-0.5 font-mono text-sm">{health.environment}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Uptime</dt>
            <dd className="mt-0.5 font-mono text-sm">{formatUptime(health.uptimeSeconds)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
