/**
 * tRPC Router
 * Type-safe API endpoints
 */

import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import superjson from 'superjson'
import { eq, and, desc, inArray, gte, lte, sql, or, ilike } from 'drizzle-orm'
import crypto from 'crypto'
import type { Database } from '@mrst/db'
import {
  tenants,
  users,
  sessions,
  integrationAccounts,
  syncRuns,
  timelineEvents,
  timelineEventLinks,
  coreCustomers,
  coreVehicles,
  type UserRole,
  type TimelineEventType,
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

// Timeline router
const timelineRouter = t.router({
  /**
   * Get timeline events with filtering
   */
  list: protectedProcedure
    .input(z.object({
      // Pagination
      limit: z.number().min(1).max(100).default(50),
      cursor: z.string().uuid().optional(),
      // Filters
      sources: z.array(z.string()).optional(),
      eventTypes: z.array(z.string()).optional(),
      entityType: z.string().optional(),
      entityId: z.string().uuid().optional(),
      search: z.string().optional(),
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional(),
      // Options
      includeInternal: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const { limit, cursor, sources, eventTypes, entityType, entityId, search, dateFrom, dateTo, includeInternal } = input

      // Build conditions
      const conditions = [eq(timelineEvents.tenantId, ctx.user!.tenantId)]

      if (!includeInternal) {
        conditions.push(eq(timelineEvents.isInternal, false))
      }

      if (sources && sources.length > 0) {
        conditions.push(inArray(timelineEvents.source, sources))
      }

      if (eventTypes && eventTypes.length > 0) {
        conditions.push(inArray(timelineEvents.eventType, eventTypes as TimelineEventType[]))
      }

      if (dateFrom) {
        conditions.push(gte(timelineEvents.occurredAt, new Date(dateFrom)))
      }

      if (dateTo) {
        conditions.push(lte(timelineEvents.occurredAt, new Date(dateTo)))
      }

      if (search) {
        conditions.push(
          or(
            ilike(timelineEvents.title, `%${search}%`),
            ilike(timelineEvents.summary, `%${search}%`),
            ilike(timelineEvents.content, `%${search}%`)
          ) ?? sql`false`
        )
      }

      if (cursor) {
        const cursorEvent = await ctx.db
          .select({ occurredAt: timelineEvents.occurredAt })
          .from(timelineEvents)
          .where(eq(timelineEvents.id, cursor))
          .limit(1)
        if (cursorEvent[0]) {
          conditions.push(lte(timelineEvents.occurredAt, cursorEvent[0].occurredAt))
        }
      }

      // If filtering by entity, join with links
      let query
      if (entityType && entityId) {
        query = ctx.db
          .select({
            id: timelineEvents.id,
            eventType: timelineEvents.eventType,
            source: timelineEvents.source,
            title: timelineEvents.title,
            summary: timelineEvents.summary,
            content: timelineEvents.content,
            contentHtml: timelineEvents.contentHtml,
            metadata: timelineEvents.metadata,
            actorType: timelineEvents.actorType,
            actorName: timelineEvents.actorName,
            actorEmail: timelineEvents.actorEmail,
            occurredAt: timelineEvents.occurredAt,
            isInternal: timelineEvents.isInternal,
            isPinned: timelineEvents.isPinned,
          })
          .from(timelineEvents)
          .innerJoin(
            timelineEventLinks,
            eq(timelineEventLinks.timelineEventId, timelineEvents.id)
          )
          .where(
            and(
              ...conditions,
              eq(timelineEventLinks.entityType, entityType),
              eq(timelineEventLinks.entityId, entityId)
            )
          )
          .orderBy(desc(timelineEvents.occurredAt), desc(timelineEvents.id))
          .limit(limit + 1)
      } else {
        query = ctx.db
          .select({
            id: timelineEvents.id,
            eventType: timelineEvents.eventType,
            source: timelineEvents.source,
            title: timelineEvents.title,
            summary: timelineEvents.summary,
            content: timelineEvents.content,
            contentHtml: timelineEvents.contentHtml,
            metadata: timelineEvents.metadata,
            actorType: timelineEvents.actorType,
            actorName: timelineEvents.actorName,
            actorEmail: timelineEvents.actorEmail,
            occurredAt: timelineEvents.occurredAt,
            isInternal: timelineEvents.isInternal,
            isPinned: timelineEvents.isPinned,
          })
          .from(timelineEvents)
          .where(and(...conditions))
          .orderBy(desc(timelineEvents.occurredAt), desc(timelineEvents.id))
          .limit(limit + 1)
      }

      const events = await query

      // Determine if there are more results
      let nextCursor: string | undefined
      if (events.length > limit) {
        const lastEvent = events.pop()
        nextCursor = lastEvent?.id
      }

      return {
        events,
        nextCursor,
      }
    }),

  /**
   * Get a single timeline event by ID
   */
  get: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const event = await ctx.db
        .select()
        .from(timelineEvents)
        .where(
          and(
            eq(timelineEvents.id, input.id),
            eq(timelineEvents.tenantId, ctx.user!.tenantId)
          )
        )
        .limit(1)

      if (!event[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' })
      }

      // Get linked entities
      const links = await ctx.db
        .select({
          entityType: timelineEventLinks.entityType,
          entityId: timelineEventLinks.entityId,
          linkType: timelineEventLinks.linkType,
        })
        .from(timelineEventLinks)
        .where(eq(timelineEventLinks.timelineEventId, input.id))

      return {
        ...event[0],
        links,
      }
    }),

  /**
   * Get timeline for a customer
   */
  forCustomer: protectedProcedure
    .input(z.object({
      customerId: z.string().uuid(),
      limit: z.number().min(1).max(100).default(50),
      cursor: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Get events linked to this customer
      const conditions = [
        eq(timelineEvents.tenantId, ctx.user!.tenantId),
        eq(timelineEventLinks.entityType, 'customer'),
        eq(timelineEventLinks.entityId, input.customerId),
      ]

      if (input.cursor) {
        const cursorEvent = await ctx.db
          .select({ occurredAt: timelineEvents.occurredAt })
          .from(timelineEvents)
          .where(eq(timelineEvents.id, input.cursor))
          .limit(1)
        if (cursorEvent[0]) {
          conditions.push(lte(timelineEvents.occurredAt, cursorEvent[0].occurredAt))
        }
      }

      const events = await ctx.db
        .select({
          id: timelineEvents.id,
          eventType: timelineEvents.eventType,
          source: timelineEvents.source,
          title: timelineEvents.title,
          summary: timelineEvents.summary,
          actorName: timelineEvents.actorName,
          occurredAt: timelineEvents.occurredAt,
          isPinned: timelineEvents.isPinned,
        })
        .from(timelineEvents)
        .innerJoin(
          timelineEventLinks,
          eq(timelineEventLinks.timelineEventId, timelineEvents.id)
        )
        .where(and(...conditions))
        .orderBy(desc(timelineEvents.occurredAt))
        .limit(input.limit + 1)

      let nextCursor: string | undefined
      if (events.length > input.limit) {
        const lastEvent = events.pop()
        nextCursor = lastEvent?.id
      }

      // Get customer info
      const customer = await ctx.db
        .select({
          displayName: coreCustomers.displayName,
          primaryEmail: coreCustomers.primaryEmail,
          primaryPhone: coreCustomers.primaryPhone,
        })
        .from(coreCustomers)
        .where(eq(coreCustomers.id, input.customerId))
        .limit(1)

      return {
        customer: customer[0] ?? null,
        events,
        nextCursor,
      }
    }),

  /**
   * Get timeline for a vehicle
   */
  forVehicle: protectedProcedure
    .input(z.object({
      vehicleId: z.string().uuid(),
      limit: z.number().min(1).max(100).default(50),
      cursor: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(timelineEvents.tenantId, ctx.user!.tenantId),
        eq(timelineEventLinks.entityType, 'vehicle'),
        eq(timelineEventLinks.entityId, input.vehicleId),
      ]

      if (input.cursor) {
        const cursorEvent = await ctx.db
          .select({ occurredAt: timelineEvents.occurredAt })
          .from(timelineEvents)
          .where(eq(timelineEvents.id, input.cursor))
          .limit(1)
        if (cursorEvent[0]) {
          conditions.push(lte(timelineEvents.occurredAt, cursorEvent[0].occurredAt))
        }
      }

      const events = await ctx.db
        .select({
          id: timelineEvents.id,
          eventType: timelineEvents.eventType,
          source: timelineEvents.source,
          title: timelineEvents.title,
          summary: timelineEvents.summary,
          actorName: timelineEvents.actorName,
          occurredAt: timelineEvents.occurredAt,
          isPinned: timelineEvents.isPinned,
        })
        .from(timelineEvents)
        .innerJoin(
          timelineEventLinks,
          eq(timelineEventLinks.timelineEventId, timelineEvents.id)
        )
        .where(and(...conditions))
        .orderBy(desc(timelineEvents.occurredAt))
        .limit(input.limit + 1)

      let nextCursor: string | undefined
      if (events.length > input.limit) {
        const lastEvent = events.pop()
        nextCursor = lastEvent?.id
      }

      // Get vehicle info
      const vehicle = await ctx.db
        .select({
          make: coreVehicles.make,
          model: coreVehicles.model,
          year: coreVehicles.year,
          licensePlate: coreVehicles.licensePlate,
        })
        .from(coreVehicles)
        .where(eq(coreVehicles.id, input.vehicleId))
        .limit(1)

      return {
        vehicle: vehicle[0] ?? null,
        events,
        nextCursor,
      }
    }),

  /**
   * Get timeline statistics
   */
  stats: protectedProcedure
    .query(async ({ ctx }) => {
      const eventsBySource = await ctx.db
        .select({
          source: timelineEvents.source,
          count: sql<number>`count(*)::int`,
        })
        .from(timelineEvents)
        .where(eq(timelineEvents.tenantId, ctx.user!.tenantId))
        .groupBy(timelineEvents.source)

      const eventsByType = await ctx.db
        .select({
          eventType: timelineEvents.eventType,
          count: sql<number>`count(*)::int`,
        })
        .from(timelineEvents)
        .where(eq(timelineEvents.tenantId, ctx.user!.tenantId))
        .groupBy(timelineEvents.eventType)

      const total = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(timelineEvents)
        .where(eq(timelineEvents.tenantId, ctx.user!.tenantId))

      return {
        total: total[0]?.count ?? 0,
        bySource: eventsBySource,
        byType: eventsByType,
      }
    }),
})

// Main router
export const appRouter = t.router({
  auth: authRouter,
  tenants: tenantsRouter,
  integrations: integrationsRouter,
  sync: syncRouter,
  users: usersRouter,
  timeline: timelineRouter,
})

export type AppRouter = typeof appRouter
