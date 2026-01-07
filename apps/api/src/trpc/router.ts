/**
 * tRPC Router
 * Type-safe API endpoints
 */

import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import superjson from 'superjson'
import { eq, and } from 'drizzle-orm'
import crypto from 'crypto'
import type { Database } from '@mrst/db'
import {
  tenants,
  users,
  sessions,
  integrationAccounts,
  syncRuns,
  type UserRole,
} from '@mrst/db/schema'

// Context type
export interface Context {
  db: Database
  user?: {
    id: string
    tenantId: string
    email: string
    name: string
    role: UserRole
  }
  session?: {
    id: string
    token: string
  }
}

// Create context from request
export function createContext(opts: { req: Request; db: Database }): Context {
  return {
    db: opts.db,
    // User will be populated by auth middleware
  }
}

// Initialize tRPC
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape
  },
})

// Public procedure (no auth required)
const publicProcedure = t.procedure

// Auth middleware
const authMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' })
  }
  return next({ ctx })
})

// Protected procedure (auth required)
const protectedProcedure = t.procedure.use(authMiddleware)

// Admin middleware
const adminMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' })
  }
  if (ctx.user.role !== 'owner' && ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' })
  }
  return next({ ctx })
})

// Admin procedure
const adminProcedure = t.procedure.use(adminMiddleware)

// Router definitions
const authRouter = t.router({
  /**
   * Login with email and password
   */
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
      tenantSlug: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Find tenant if slug provided
      let tenantId: string | undefined
      if (input.tenantSlug) {
        const tenant = await ctx.db.query.tenants.findFirst({
          where: eq(tenants.slug, input.tenantSlug),
        })
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant not found' })
        }
        tenantId = tenant.id
      }

      // Find user
      const whereClause = tenantId
        ? and(eq(users.email, input.email), eq(users.tenantId, tenantId))
        : eq(users.email, input.email)

      const user = await ctx.db.query.users.findFirst({
        where: whereClause,
      })

      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' })
      }

      // Verify password (simple hash for now, use bcrypt in production)
      const inputHash = crypto.createHash('sha256').update(input.password).digest('hex')
      if (inputHash !== user.passwordHash) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' })
      }

      if (!user.isActive) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Account is disabled' })
      }

      // Create session
      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

      const [session] = await ctx.db.insert(sessions).values({
        userId: user.id,
        token,
        expiresAt,
      }).returning()

      // Update last login
      await ctx.db.update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id))

      return {
        token: session.token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        expiresAt: session.expiresAt.toISOString(),
      }
    }),

  /**
   * Logout (invalidate session)
   */
  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.session) {
        await ctx.db.delete(sessions).where(eq(sessions.id, ctx.session.id))
      }
      return { success: true }
    }),

  /**
   * Get current user
   */
  me: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.user
    }),
})

const tenantsRouter = t.router({
  /**
   * Get current tenant
   */
  current: protectedProcedure
    .query(async ({ ctx }) => {
      const tenant = await ctx.db.query.tenants.findFirst({
        where: eq(tenants.id, ctx.user!.tenantId),
      })
      return tenant
    }),

  /**
   * Update tenant settings
   */
  updateSettings: adminProcedure
    .input(z.object({
      settings: z.record(z.unknown()),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db.update(tenants)
        .set({ settings: input.settings, updatedAt: new Date() })
        .where(eq(tenants.id, ctx.user!.tenantId))
        .returning()
      return updated
    }),
})

const integrationsRouter = t.router({
  /**
   * List integration accounts
   */
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const accounts = await ctx.db.query.integrationAccounts.findMany({
        where: eq(integrationAccounts.tenantId, ctx.user!.tenantId),
      })
      // Don't return credentials
      return accounts.map(a => ({
        ...a,
        credentials: undefined,
      }))
    }),

  /**
   * Create integration account
   */
  create: adminProcedure
    .input(z.object({
      type: z.enum(['monday', 'hq', 'gmail', 'spireon', 'whatsapp']),
      name: z.string(),
      credentials: z.record(z.unknown()),
      settings: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [account] = await ctx.db.insert(integrationAccounts).values({
        tenantId: ctx.user!.tenantId,
        type: input.type,
        name: input.name,
        credentials: input.credentials,
        settings: input.settings || {},
      }).returning()
      return {
        ...account,
        credentials: undefined,
      }
    }),

  /**
   * Toggle integration active status
   */
  toggleActive: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db.update(integrationAccounts)
        .set({ isActive: input.isActive, updatedAt: new Date() })
        .where(and(
          eq(integrationAccounts.id, input.id),
          eq(integrationAccounts.tenantId, ctx.user!.tenantId)
        ))
        .returning()
      return { success: !!updated }
    }),
})

const syncRouter = t.router({
  /**
   * Get recent sync runs
   */
  recentRuns: protectedProcedure
    .input(z.object({
      integrationAccountId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      // Get integration accounts for this tenant
      const accounts = await ctx.db.query.integrationAccounts.findMany({
        where: eq(integrationAccounts.tenantId, ctx.user!.tenantId),
      })
      const accountIds = accounts.map(a => a.id)

      if (accountIds.length === 0) {
        return []
      }

      // For now, return empty - will implement with proper filtering
      return []
    }),

  /**
   * Trigger manual sync
   */
  trigger: adminProcedure
    .input(z.object({
      integrationAccountId: z.string().uuid(),
      syncType: z.enum(['full', 'incremental']),
      entityType: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify account belongs to tenant
      const account = await ctx.db.query.integrationAccounts.findFirst({
        where: and(
          eq(integrationAccounts.id, input.integrationAccountId),
          eq(integrationAccounts.tenantId, ctx.user!.tenantId)
        ),
      })

      if (!account) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Integration account not found' })
      }

      // Create sync run record
      const [run] = await ctx.db.insert(syncRuns).values({
        integrationAccountId: input.integrationAccountId,
        syncType: input.syncType,
        entityType: input.entityType,
        status: 'pending',
      }).returning()

      // Queue the job (will be implemented with pg-boss)
      // await boss.send(`sync:${account.type}:${input.syncType}`, {
      //   syncRunId: run.id,
      //   integrationAccountId: input.integrationAccountId,
      // })

      return run
    }),
})

const usersRouter = t.router({
  /**
   * List users in tenant
   */
  list: adminProcedure
    .query(async ({ ctx }) => {
      const userList = await ctx.db.query.users.findMany({
        where: eq(users.tenantId, ctx.user!.tenantId),
        columns: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      })
      return userList
    }),

  /**
   * Create user
   */
  create: adminProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().min(1),
      password: z.string().min(8),
      role: z.enum(['admin', 'manager', 'staff', 'driver', 'readonly']),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if email already exists in tenant
      const existing = await ctx.db.query.users.findFirst({
        where: and(
          eq(users.email, input.email),
          eq(users.tenantId, ctx.user!.tenantId)
        ),
      })

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Email already exists' })
      }

      // Hash password
      const passwordHash = crypto.createHash('sha256').update(input.password).digest('hex')

      const [user] = await ctx.db.insert(users).values({
        tenantId: ctx.user!.tenantId,
        email: input.email,
        name: input.name,
        passwordHash,
        role: input.role,
      }).returning()

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      }
    }),

  /**
   * Update user
   */
  update: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).optional(),
      role: z.enum(['admin', 'manager', 'staff', 'driver', 'readonly']).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input

      // Can't modify yourself to non-admin
      if (id === ctx.user!.id && updates.role && updates.role !== 'admin' && updates.role !== 'owner') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot remove your own admin access' })
      }

      const [updated] = await ctx.db.update(users)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(
          eq(users.id, id),
          eq(users.tenantId, ctx.user!.tenantId)
        ))
        .returning()

      return updated
    }),
})

// Main router
export const appRouter = t.router({
  auth: authRouter,
  tenants: tenantsRouter,
  integrations: integrationsRouter,
  sync: syncRouter,
  users: usersRouter,
})

export type AppRouter = typeof appRouter
