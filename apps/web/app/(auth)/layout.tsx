import Link from 'next/link';
import type { ReactNode } from 'react';

/** Centred, chrome-free shell for the two public pages. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <Link href="/" className="mb-8 text-sm font-semibold tracking-tight">
        Broadway Infosys Inventory
      </Link>
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-8 text-xs text-muted-foreground">Internal system for Broadway Infosys.</p>
    </div>
  );
}
