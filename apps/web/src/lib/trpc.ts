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
    // Browser: use relative URL or configured URL
    return process.env.NEXT_PUBLIC_API_URL || ''
  }
  // SSR: use absolute URL
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
}

// Create tRPC client
export const trpcClient = trpc.createClient({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,
      headers: () => {
        // Get auth token from localStorage if available
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('auth_token')
          if (token) {
            return { Authorization: `Bearer ${token}` }
          }
        }
        return {}
      },
    }),
  ],
})
