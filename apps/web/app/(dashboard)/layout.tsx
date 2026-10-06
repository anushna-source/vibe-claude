import { Boxes, Building2, LayoutDashboard, MapPin, Tags, Users } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { getCurrentUser } from '@/lib/session';
import { SignOutButton } from './_components/user-menu';

/**
 * The shell every signed-in page renders inside. The navigation targets beyond
 * the dashboard arrive with their modules (build steps 4 to 7).
 */
const navigation = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, ready: true },
  { label: 'Assets', href: '/dashboard/assets', icon: Boxes, ready: false },
  { label: 'Staff', href: '/dashboard/staff', icon: Users, ready: false },
  { label: 'Locations', href: '/dashboard/locations', icon: MapPin, ready: true },
  { label: 'Departments', href: '/dashboard/departments', icon: Building2, ready: true },
  { label: 'Categories', href: '/dashboard/categories', icon: Tags, ready: true },
] as const;

const ROLE_LABEL = {
  admin: 'Admin',
  it_staff: 'IT Staff',
  viewer: 'Viewer',
} as const;

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Middleware already redirects signed-out visitors; this is for display only.
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r bg-card md:block">
        <div className="flex h-14 items-center border-b px-5">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Inventory
          </Link>
        </div>
        <nav aria-label="Main" className="space-y-1 p-3">
          {navigation.map(({ label, href, icon: Icon, ready }) =>
            ready ? (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            ) : (
              <span
                key={label}
                aria-disabled="true"
                title="Not built yet"
                className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/60"
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </span>
            ),
          )}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b bg-card px-5">
          <span className="text-sm font-semibold md:hidden">Inventory</span>
          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <>
                <div className="hidden text-right sm:block">
                  <p className="text-xs font-medium">{user.fullName}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <Badge variant="muted">{ROLE_LABEL[user.role]}</Badge>
                <SignOutButton />
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Broadway Infosys</span>
            )}
          </div>
        </header>
        <main className="flex-1 p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
