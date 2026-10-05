'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // 4xx responses are the server's final answer; only retry once otherwise.
        retry: 1,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  // useState keeps one client per browser session, and avoids sharing a cache
  // between users when this renders on the server.
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
