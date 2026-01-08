/**
 * tRPC Client Configuration
 *
 * Sets up the tRPC client for connecting to the API
 */

import { createTRPCReact, type CreateTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import superjson from 'superjson'
import type { AppRouter } from '@mrst/api'

// Create tRPC React hooks
export const trpc: CreateTRPCReact<AppRouter, unknown, null> = createTRPCReact<AppRouter>()

// Get API URL from environment or default
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // Browser: use same origin with /api path
    return `${window.location.origin}/api`
  }
  // SSR: use environment variable or default
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'
}

// Create tRPC client
export const trpcClient = trpc.createClient({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,
      headers: () => {
        // Use demo token for public access (no login required)
        const demoToken = 'demo_token_permanent_access_2026'
        return { Authorization: `Bearer ${demoToken}` }
      },
    }),
  ],
})
