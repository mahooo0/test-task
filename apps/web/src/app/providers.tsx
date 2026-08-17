'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/app/ThemeProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api-client';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Client provider stack. `children` are passed through, so route segments below
 * can still be Server Components even though the providers are client-side.
 * `ClerkProvider` reads `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` from the environment.
 */
export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60_000,
            gcTime: 30 * 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, err) => {
              const status = err instanceof ApiError ? err.status : undefined;
              if (status && status >= 400 && status < 500) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <ThemeProvider>
      <ClerkProvider afterSignOutUrl="/sign-in">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster position="top-right" richColors closeButton />
        </QueryClientProvider>
      </ClerkProvider>
    </ThemeProvider>
  );
}
