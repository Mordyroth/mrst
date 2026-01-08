'use client'

/**
 * App Providers
 *
 * Wraps the app with necessary context providers
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { trpc, trpcClient } from './trpc'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  )
}
