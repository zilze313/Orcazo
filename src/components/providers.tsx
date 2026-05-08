'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'next-themes';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,           // most queries OK for 30s
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false, // we'll opt-in per-query
            retry: (failureCount, error: any) => {
              // Don't retry auth failures
              const status = error?.status ?? error?.response?.status;
              if (status === 401 || status === 403) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={client}>
        {children}
        <Toaster richColors closeButton position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
