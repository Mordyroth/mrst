/**
 * MRST API Server
 * Hono + tRPC
 */

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { trpcServer } from '@hono/trpc-server'
import { createDb } from '@mrst/db'
import { appRouter, createContext } from './trpc/router'

// Initialize database
const db = createDb(process.env.DATABASE_URL || 'postgresql://mrst:mrst_dev_2025@localhost:5432/mrst')

// Create Hono app
const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: ['http://localhost:3000', 'https://app.travelautorental.com'],
  credentials: true,
}))

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  })
})

// tRPC endpoint
app.use('/trpc/*', trpcServer({
  router: appRouter,
  createContext: ({ req }) => createContext({ req, db }) as unknown as Record<string, unknown>,
}))

// API routes (REST endpoints for webhooks, etc.)
app.get('/api/v1/status', (c) => {
  return c.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
  })
})

// Webhook endpoints (to be implemented)
app.post('/api/v1/webhooks/whatsapp', async (c) => {
  // Will be implemented in Phase 6
  return c.json({ received: true })
})

app.post('/api/v1/webhooks/monday', async (c) => {
  // Will be implemented if needed for real-time updates
  return c.json({ received: true })
})

// Error handling
app.onError((err, c) => {
  console.error('[API] Error:', err)
  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    },
  }, 500)
})

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  }, 404)
})

// Start server
const port = parseInt(process.env.API_PORT || '3001', 10)
const host = process.env.API_HOST || '0.0.0.0'

console.log(`[API] Starting MRST API server...`)
console.log(`[API] Environment: ${process.env.NODE_ENV || 'development'}`)

serve({
  fetch: app.fetch,
  port,
  hostname: host,
}, (info) => {
  console.log(`[API] Server running at http://${info.address}:${info.port}`)
})

export type AppRouter = typeof appRouter
export type { TimelineEventRow, CollapsedEvent } from './trpc/router'
