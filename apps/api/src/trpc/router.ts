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
  aiTasks,
  aiConversations,
  aiMessages,
  embeddings,
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
export async function createContext(opts: { req: Request; db: Database }): Promise<Context> {
  const ctx: Context = { db: opts.db }

  // Extract auth token from Authorization header
  const authHeader = opts.req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)

    // Look up session by token
    const sessionResult = await opts.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.token, token), gte(sessions.expiresAt, new Date())))
      .limit(1)

    const session = sessionResult[0]
    if (session) {
      // Look up user
      const userResult = await opts.db
        .select()
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1)

      const user = userResult[0]
      if (user) {
        ctx.user = {
          id: user.id,
          tenantId: user.tenantId,
          email: user.email,
          name: user.name,
          role: user.role,
        }
        ctx.session = {
          id: session.id,
          token: session.token,
        }
      }
    }
  }

  return ctx
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

      if (!session) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create session' })
      }

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

      if (!user) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create user' })
      }

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

      // Can't modify yourself to non-admin (owner can't be set via this API)
      if (id === ctx.user!.id && updates.role && updates.role !== 'admin') {
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

// Helper function to collapse timeline events by group key
export interface TimelineEventRow {
  id: string
  eventType: string
  source: string
  title: string | null
  summary: string | null
  content?: string | null
  contentHtml?: string | null
  metadata?: unknown
  actorType?: string | null
  actorName: string | null
  actorEmail?: string | null
  occurredAt: Date
  isInternal?: boolean | null
  isPinned: boolean | null
  collapseGroupKey?: string | null
}

export interface CollapsedEvent extends TimelineEventRow {
  collapsedCount: number
  collapsedIds: string[]
}

function collapseTimelineEvents(events: TimelineEventRow[]): CollapsedEvent[] {
  const result: CollapsedEvent[] = []
  let currentGroup: CollapsedEvent | null = null

  for (const event of events) {
    const groupKey = (event as { collapseGroupKey?: string | null }).collapseGroupKey

    // If no group key or different group, start a new group
    if (!groupKey || !currentGroup || currentGroup.collapseGroupKey !== groupKey) {
      if (currentGroup) {
        result.push(currentGroup)
      }
      currentGroup = {
        ...event,
        collapseGroupKey: groupKey,
        collapsedCount: 1,
        collapsedIds: [event.id],
      }
    } else {
      // Same group, increment count and add ID
      currentGroup.collapsedCount++
      currentGroup.collapsedIds.push(event.id)
    }
  }

  // Don't forget the last group
  if (currentGroup) {
    result.push(currentGroup)
  }

  return result
}

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
      collapsed: z.boolean().default(false), // Group by collapseGroupKey
    }))
    .query(async ({ ctx, input }) => {
      const { limit, cursor, sources, eventTypes, entityType, entityId, search, dateFrom, dateTo, includeInternal, collapsed } = input

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
            collapseGroupKey: timelineEvents.collapseGroupKey,
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
            collapseGroupKey: timelineEvents.collapseGroupKey,
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

      // If collapsed mode, group events by collapseGroupKey
      if (collapsed) {
        const collapsedEvents = collapseTimelineEvents(events)
        return {
          events: collapsedEvents,
          nextCursor,
          collapsed: true,
        }
      }

      return {
        events,
        nextCursor,
        collapsed: false,
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

  /**
   * Expand a collapsed group - get all events with a specific collapseGroupKey
   */
  expandGroup: protectedProcedure
    .input(z.object({
      collapseGroupKey: z.string(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const events = await ctx.db
        .select({
          id: timelineEvents.id,
          eventType: timelineEvents.eventType,
          source: timelineEvents.source,
          title: timelineEvents.title,
          summary: timelineEvents.summary,
          content: timelineEvents.content,
          actorName: timelineEvents.actorName,
          occurredAt: timelineEvents.occurredAt,
          isPinned: timelineEvents.isPinned,
        })
        .from(timelineEvents)
        .where(
          and(
            eq(timelineEvents.tenantId, ctx.user!.tenantId),
            eq(timelineEvents.collapseGroupKey, input.collapseGroupKey)
          )
        )
        .orderBy(desc(timelineEvents.occurredAt))
        .limit(input.limit)

      return { events }
    }),
})

// AI router for semantic search and suggestions
const aiRouter = t.router({
  /**
   * Vector similarity search
   */
  search: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      topK: z.number().min(1).max(50).default(10),
      minSimilarity: z.number().min(0).max(1).default(0.5),
      filterTypes: z.array(z.string()).optional(),
      filterCustomerIds: z.array(z.string()).optional(),
      filterVehicleIds: z.array(z.string()).optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Note: Full vector search requires embedding service
      // This is a simplified version that returns placeholder results
      // Full implementation would call vectorSearch from @mrst/ai

      const results = await ctx.db
        .select({
          id: embeddings.id,
          sourceType: embeddings.sourceType,
          sourceId: embeddings.sourceId,
          content: embeddings.content,
          metadata: embeddings.metadata,
        })
        .from(embeddings)
        .where(eq(embeddings.tenantId, ctx.user!.tenantId))
        .limit(input.topK)

      return {
        results: results.map(r => ({
          ...r,
          similarity: 0.8, // Placeholder - real implementation uses vector similarity
        })),
        query: input.query,
        totalFound: results.length,
      }
    }),

  /**
   * Get pending AI suggestions/tasks
   */
  getSuggestions: protectedProcedure
    .input(z.object({
      status: z.enum(['pending', 'acknowledged', 'completed', 'dismissed']).default('pending'),
      taskType: z.enum(['follow_up', 'action_required', 'anomaly', 'opportunity']).optional(),
      priority: z.enum(['high', 'medium', 'low']).optional(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(aiTasks.tenantId, ctx.user!.tenantId),
        eq(aiTasks.status, input.status),
      ]

      if (input.taskType) {
        conditions.push(eq(aiTasks.taskType, input.taskType))
      }
      if (input.priority) {
        conditions.push(eq(aiTasks.priority, input.priority))
      }

      const suggestions = await ctx.db
        .select()
        .from(aiTasks)
        .where(and(...conditions))
        .orderBy(
          sql`CASE WHEN ${aiTasks.priority} = 'high' THEN 1 WHEN ${aiTasks.priority} = 'medium' THEN 2 ELSE 3 END`,
          desc(aiTasks.createdAt)
        )
        .limit(input.limit)

      // Get counts by status
      const statusCounts = await ctx.db
        .select({
          status: aiTasks.status,
          count: sql<number>`count(*)::int`,
        })
        .from(aiTasks)
        .where(eq(aiTasks.tenantId, ctx.user!.tenantId))
        .groupBy(aiTasks.status)

      return {
        suggestions,
        counts: Object.fromEntries(statusCounts.map(s => [s.status, s.count])),
      }
    }),

  /**
   * Acknowledge a suggestion (mark as seen)
   */
  acknowledgeSuggestion: protectedProcedure
    .input(z.object({
      taskId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(aiTasks)
        .set({
          status: 'acknowledged',
          acknowledgedBy: ctx.user!.id,
          acknowledgedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(aiTasks.id, input.taskId),
            eq(aiTasks.tenantId, ctx.user!.tenantId)
          )
        )
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Suggestion not found' })
      }

      return { success: true, task: updated }
    }),

  /**
   * Complete a suggestion
   */
  completeSuggestion: protectedProcedure
    .input(z.object({
      taskId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(aiTasks)
        .set({
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(aiTasks.id, input.taskId),
            eq(aiTasks.tenantId, ctx.user!.tenantId)
          )
        )
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Suggestion not found' })
      }

      return { success: true, task: updated }
    }),

  /**
   * Dismiss a suggestion
   */
  dismissSuggestion: protectedProcedure
    .input(z.object({
      taskId: z.string().uuid(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(aiTasks)
        .set({
          status: 'dismissed',
          dismissedAt: new Date(),
          dismissReason: input.reason,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(aiTasks.id, input.taskId),
            eq(aiTasks.tenantId, ctx.user!.tenantId)
          )
        )
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Suggestion not found' })
      }

      return { success: true, task: updated }
    }),

  /**
   * Get AI conversations
   */
  getConversations: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      activeOnly: z.boolean().default(true),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(aiConversations.tenantId, ctx.user!.tenantId)]
      if (input.activeOnly) {
        conditions.push(eq(aiConversations.isActive, true))
      }

      const conversations = await ctx.db
        .select()
        .from(aiConversations)
        .where(and(...conditions))
        .orderBy(desc(aiConversations.updatedAt))
        .limit(input.limit)

      return { conversations }
    }),

  /**
   * Create a new AI conversation
   */
  createConversation: protectedProcedure
    .input(z.object({
      title: z.string().optional(),
      context: z.object({
        customerIds: z.array(z.string()).optional(),
        vehicleIds: z.array(z.string()).optional(),
        boardIds: z.array(z.string()).optional(),
        dateRange: z.object({
          start: z.string(),
          end: z.string(),
        }).optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [conversation] = await ctx.db
        .insert(aiConversations)
        .values({
          tenantId: ctx.user!.tenantId,
          userId: ctx.user!.id,
          title: input.title,
          context: input.context,
        })
        .returning()

      return { conversation }
    }),

  /**
   * Get messages for a conversation
   */
  getMessages: protectedProcedure
    .input(z.object({
      conversationId: z.string().uuid(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      // Verify conversation belongs to tenant
      const [conversation] = await ctx.db
        .select()
        .from(aiConversations)
        .where(
          and(
            eq(aiConversations.id, input.conversationId),
            eq(aiConversations.tenantId, ctx.user!.tenantId)
          )
        )
        .limit(1)

      if (!conversation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found' })
      }

      const messages = await ctx.db
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.conversationId, input.conversationId))
        .orderBy(aiMessages.createdAt)
        .limit(input.limit)
        .offset(input.offset)

      return { conversation, messages }
    }),

  /**
   * Send a message to an AI conversation
   * Note: Full RAG implementation requires AI service
   */
  sendMessage: protectedProcedure
    .input(z.object({
      conversationId: z.string().uuid(),
      content: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify conversation belongs to tenant
      const [conversation] = await ctx.db
        .select()
        .from(aiConversations)
        .where(
          and(
            eq(aiConversations.id, input.conversationId),
            eq(aiConversations.tenantId, ctx.user!.tenantId)
          )
        )
        .limit(1)

      if (!conversation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found' })
      }

      // Save user message
      const [userMessage] = await ctx.db
        .insert(aiMessages)
        .values({
          conversationId: input.conversationId,
          role: 'user',
          content: input.content,
        })
        .returning()

      // Update conversation timestamp
      await ctx.db
        .update(aiConversations)
        .set({ updatedAt: new Date() })
        .where(eq(aiConversations.id, input.conversationId))

      // Note: Real AI response would be generated here using RAG
      // For now, return a placeholder indicating AI service needed
      const [assistantMessage] = await ctx.db
        .insert(aiMessages)
        .values({
          conversationId: input.conversationId,
          role: 'assistant',
          content: 'AI service integration required. Configure ANTHROPIC_API_KEY to enable AI responses.',
          model: 'placeholder',
          promptTokens: 0,
          completionTokens: 0,
        })
        .returning()

      return { userMessage, assistantMessage }
    }),

  /**
   * Get AI task statistics for dashboard
   */
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      // Count by status
      const statusCounts = await ctx.db
        .select({
          status: aiTasks.status,
          count: sql<number>`count(*)::int`,
        })
        .from(aiTasks)
        .where(eq(aiTasks.tenantId, ctx.user!.tenantId))
        .groupBy(aiTasks.status)

      // Count by priority for pending tasks
      const priorityCounts = await ctx.db
        .select({
          priority: aiTasks.priority,
          count: sql<number>`count(*)::int`,
        })
        .from(aiTasks)
        .where(
          and(
            eq(aiTasks.tenantId, ctx.user!.tenantId),
            eq(aiTasks.status, 'pending')
          )
        )
        .groupBy(aiTasks.priority)

      // Count by type for pending tasks
      const typeCounts = await ctx.db
        .select({
          taskType: aiTasks.taskType,
          count: sql<number>`count(*)::int`,
        })
        .from(aiTasks)
        .where(
          and(
            eq(aiTasks.tenantId, ctx.user!.tenantId),
            eq(aiTasks.status, 'pending')
          )
        )
        .groupBy(aiTasks.taskType)

      // Count embeddings
      const [embeddingCount] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(embeddings)
        .where(eq(embeddings.tenantId, ctx.user!.tenantId))

      return {
        byStatus: Object.fromEntries(statusCounts.map(s => [s.status, s.count])),
        byPriority: Object.fromEntries(priorityCounts.map(p => [p.priority, p.count])),
        byType: Object.fromEntries(typeCounts.map(t => [t.taskType, t.count])),
        totalEmbeddings: embeddingCount?.count ?? 0,
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
  ai: aiRouter,
})

export type AppRouter = typeof appRouter
