'use client';

import { LogOut } from 'lucide-react';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { logoutAction } from '@/app/(auth)/actions';

/** Sign-out is a POST-like action, never a link, so it cannot be prefetched. */
export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(() => {
          void logoutAction();
        });
      }}
    >
      <LogOut className="size-4" aria-hidden="true" />
      {pending ? 'Signing out…' : 'Sign out'}
    </Button>
  );
}
