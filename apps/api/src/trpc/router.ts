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
  spireonDevices,
  spireonLocations,
  mondayItems,
  mondayItemColumnValues,
  mondayColumns,
  mondayBoards,
  hqReservations,
  hqCustomers,
  hqVehicles,
  gmailMessages,
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

// HQ API credentials
const HQ_TENANT_TOKEN = 'A50uV6M0jDUcM1ehJsF6kh1YtFfNXkSrDQvqEaJJnPrk3dwFeW'
const HQ_USER_TOKEN = 'jLwBdr7fMzbrl54elfwm6Um4DqSYcbxGHhTSmYOI72CrowvUSO'
const HQ_BASE_URL = 'https://api-america-3.caagcrm.com/api-america-3'
const HQ_AUTH_TOKEN = Buffer.from(`${HQ_TENANT_TOKEN}:${HQ_USER_TOKEN}`).toString('base64')

// Fleet board external ID in Monday.com (kept for reference)
const FLEET_BOARD_EXTERNAL_ID = '3597643013'

// Vehicles router - GPS locations and fleet data
// NOW READS FROM PostgreSQL hq_vehicles table (synced from HQ)
const vehiclesRouter = t.router({
  // Get all vehicles from PostgreSQL hq_vehicles with GPS location from Spireon
  listWithLocation: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(500).default(200),
      activeOnly: z.boolean().default(false),
      status: z.string().optional(), // Filter by HQ status
      search: z.string().optional(), // Search by VIN, plate, make, model
    }).optional())
    .query(async ({ ctx, input }) => {
      const { limit = 200, status, search } = input || {}

      // Build conditions for hq_vehicles query
      // IMPORTANT: Only show fleet vehicles (from /fleets/vehicles endpoint)
      // NOT vehicles that only appear in reservation data
      const conditions = [
        sql`${hqVehicles.deletedAt} IS NULL`,
        eq(hqVehicles.isFleetVehicle, true) // Only show actual fleet vehicles (~88 vehicles)
      ]

      if (status) {
        conditions.push(eq(hqVehicles.status, status))
      }

      if (search) {
        const searchPattern = `%${search}%`
        conditions.push(
          or(
            ilike(hqVehicles.vin, searchPattern),
            ilike(hqVehicles.licensePlate, searchPattern),
            ilike(hqVehicles.make, searchPattern),
            ilike(hqVehicles.model, searchPattern),
            ilike(hqVehicles.unitNumber, searchPattern)
          ) ?? sql`false`
        )
      }

      // Get vehicles from PostgreSQL hq_vehicles table
      const hqVehiclesData = await ctx.db
        .select({
          id: hqVehicles.id,
          externalId: hqVehicles.externalId,
          vin: hqVehicles.vin,
          licensePlate: hqVehicles.licensePlate,
          unitNumber: hqVehicles.unitNumber,
          year: hqVehicles.year,
          make: hqVehicles.make,
          model: hqVehicles.model,
          trim: hqVehicles.trim,
          color: hqVehicles.color,
          vehicleType: hqVehicles.vehicleType,
          status: hqVehicles.status,
          availability: hqVehicles.availability,
          currentMileage: hqVehicles.currentMileage,
          fuelLevel: hqVehicles.fuelLevel,
          currentLocation: hqVehicles.currentLocation,
          dailyRate: hqVehicles.dailyRate,
          weeklyRate: hqVehicles.weeklyRate,
          monthlyRate: hqVehicles.monthlyRate,
          notes: hqVehicles.notes,
          raw: hqVehicles.raw,
          syncedAt: hqVehicles.syncedAt,
        })
        .from(hqVehicles)
        .where(and(...conditions))
        .orderBy(hqVehicles.unitNumber, hqVehicles.make, hqVehicles.model)
        .limit(limit)

      // Get GPS data from Spireon (create VIN -> GPS map)
      const spireonData = await ctx.db.select({
        vehicleVin: spireonDevices.vehicleVin,
        currentLat: spireonDevices.currentLat,
        currentLng: spireonDevices.currentLng,
        currentAddress: spireonDevices.currentAddress,
        currentSpeed: spireonDevices.currentSpeed,
        currentLocationAt: spireonDevices.currentLocationAt,
        ignitionOn: spireonDevices.ignitionOn,
        isOnline: spireonDevices.isOnline,
      })
        .from(spireonDevices)
        .where(sql`${spireonDevices.vehicleVin} IS NOT NULL AND ${spireonDevices.deletedAt} IS NULL`)

      // Create VIN -> GPS lookup (uppercase VINs for matching)
      const gpsLookup = new Map<string, typeof spireonData[0]>()
      for (const device of spireonData) {
        if (device.vehicleVin) {
          gpsLookup.set(device.vehicleVin.toUpperCase(), device)
        }
      }

      // Map HQ vehicles with GPS data
      const vehicles = hqVehiclesData.map(v => {
        const gps = v.vin ? gpsLookup.get(v.vin.toUpperCase()) : null
        const rawData = v.raw as Record<string, any> || {}

        return {
          id: v.id,
          externalId: v.externalId,
          name: `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || rawData.label || 'Unknown',
          vin: v.vin,
          make: v.make,
          model: v.model,
          trim: v.trim,
          year: v.year,
          licensePlate: v.licensePlate,
          unitNumber: v.unitNumber || rawData.vehicle_key || rawData.prefixed_id,
          color: v.color,
          hqStatus: v.status || rawData.status || 'available',
          hqStatusLabel: rawData.status_label || v.status,
          hqStatusColor: rawData.status_color,
          odometer: v.currentMileage || rawData.odometer,
          fuelLevel: v.fuelLevel,
          vehicleClass: v.vehicleType || rawData.vehicle_class_label,
          dailyRate: v.dailyRate,
          weeklyRate: v.weeklyRate,
          monthlyRate: v.monthlyRate,
          location: gps && gps.currentLat && gps.currentLng &&
            Number(gps.currentLat) > -90 && Number(gps.currentLat) < 90 &&
            Number(gps.currentLng) > -180 && Number(gps.currentLng) < 180 ? {
            lat: Number(gps.currentLat),
            lng: Number(gps.currentLng),
            address: gps.currentAddress,
            speed: gps.currentSpeed ? Number(gps.currentSpeed) : null,
            updatedAt: gps.currentLocationAt,
          } : null,
          ignitionOn: gps?.ignitionOn ?? null,
          isOnline: gps?.isOnline ?? false,
          lastSyncedAt: v.syncedAt,
        }
      })

      // Get total count for pagination info
      const [countResult] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(hqVehicles)
        .where(and(...conditions))

      return {
        vehicles,
        total: countResult?.count ?? vehicles.length,
        source: 'postgresql', // Indicate data source for debugging
      }
    }),

  // Get summary stats for fleet from PostgreSQL
  stats: publicProcedure.query(async ({ ctx }) => {
    // Get status counts from hq_vehicles (only fleet vehicles)
    const statusCounts = await ctx.db
      .select({
        status: hqVehicles.status,
        count: sql<number>`count(*)::int`,
      })
      .from(hqVehicles)
      .where(and(
        sql`${hqVehicles.deletedAt} IS NULL`,
        eq(hqVehicles.isFleetVehicle, true) // Only count actual fleet vehicles
      ))
      .groupBy(hqVehicles.status)

    // Convert to object
    const byStatus: Record<string, number> = {}
    let total = 0
    for (const s of statusCounts) {
      const status = s.status || 'unknown'
      byStatus[status] = s.count
      total += s.count
    }

    // Get count of vehicles with GPS data (only fleet vehicles)
    const [gpsCount] = await ctx.db
      .select({ count: sql<number>`count(DISTINCT ${spireonDevices.vehicleVin})::int` })
      .from(spireonDevices)
      .innerJoin(hqVehicles, sql`UPPER(${spireonDevices.vehicleVin}) = UPPER(${hqVehicles.vin})`)
      .where(and(
        sql`${spireonDevices.vehicleVin} IS NOT NULL`,
        sql`${spireonDevices.deletedAt} IS NULL`,
        sql`${hqVehicles.deletedAt} IS NULL`,
        eq(hqVehicles.isFleetVehicle, true) // Only count fleet vehicles
      ))

    return {
      total,
      available: byStatus['available'] || byStatus['Available'] || 0,
      rented: byStatus['rental'] || byStatus['Rental'] || 0,
      maintenance: byStatus['maintenance'] || byStatus['Maintenance'] || 0,
      outOfService: byStatus['out_of_service'] || byStatus['Out of Service'] || 0,
      withGps: gpsCount?.count ?? 0,
      // Legacy fields for compatibility
      active: total,
      recentLocation: gpsCount?.count ?? 0,
      moving: 0, // Would need to check ignition status
      source: 'postgresql',
    }
  }),

  // Get single vehicle by ID with full details
  get: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Try to find by internal UUID first, then by external ID
      let vehicle = await ctx.db
        .select()
        .from(hqVehicles)
        .where(and(
          eq(hqVehicles.id, input.id),
          sql`${hqVehicles.deletedAt} IS NULL`
        ))
        .limit(1)

      if (!vehicle[0]) {
        // Try by external ID
        vehicle = await ctx.db
          .select()
          .from(hqVehicles)
          .where(and(
            eq(hqVehicles.externalId, input.id),
            sql`${hqVehicles.deletedAt} IS NULL`
          ))
          .limit(1)
      }

      if (!vehicle[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Vehicle not found' })
      }

      const v = vehicle[0]

      // Get GPS data if VIN exists
      let gpsData = null
      if (v.vin) {
        const [gps] = await ctx.db
          .select({
            currentLat: spireonDevices.currentLat,
            currentLng: spireonDevices.currentLng,
            currentAddress: spireonDevices.currentAddress,
            currentSpeed: spireonDevices.currentSpeed,
            currentLocationAt: spireonDevices.currentLocationAt,
            ignitionOn: spireonDevices.ignitionOn,
            isOnline: spireonDevices.isOnline,
          })
          .from(spireonDevices)
          .where(sql`UPPER(${spireonDevices.vehicleVin}) = UPPER(${v.vin})`)
          .limit(1)

        if (gps) {
          gpsData = {
            lat: gps.currentLat ? Number(gps.currentLat) : null,
            lng: gps.currentLng ? Number(gps.currentLng) : null,
            address: gps.currentAddress,
            speed: gps.currentSpeed ? Number(gps.currentSpeed) : null,
            updatedAt: gps.currentLocationAt,
            ignitionOn: gps.ignitionOn,
            isOnline: gps.isOnline,
          }
        }
      }

      return {
        ...v,
        gps: gpsData,
      }
    }),

  // Get GPS location history for a vehicle
  locationHistory: publicProcedure
    .input(z.object({
      vehicleId: z.string(),
      limit: z.number().min(1).max(500).default(100),
      startDate: z.string().optional(), // ISO date string
      endDate: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { vehicleId, limit, startDate, endDate } = input

      // First get the vehicle to get its VIN
      let vehicle = await ctx.db
        .select({ vin: hqVehicles.vin, unitNumber: hqVehicles.unitNumber })
        .from(hqVehicles)
        .where(and(
          or(eq(hqVehicles.id, vehicleId), eq(hqVehicles.externalId, vehicleId)),
          sql`${hqVehicles.deletedAt} IS NULL`
        ))
        .limit(1)

      if (!vehicle[0]?.vin) {
        return { locations: [], deviceId: null, message: 'Vehicle has no VIN or not found' }
      }

      // Find the spireon device by VIN
      const [device] = await ctx.db
        .select({ id: spireonDevices.id, lastAtShopAt: spireonDevices.lastAtShopAt })
        .from(spireonDevices)
        .where(sql`UPPER(${spireonDevices.vehicleVin}) = UPPER(${vehicle[0].vin})`)
        .limit(1)

      if (!device) {
        return { locations: [], deviceId: null, message: 'No GPS device found for this vehicle' }
      }

      // Build conditions for location query
      const conditions = [eq(spireonLocations.deviceId, device.id)]

      if (startDate) {
        conditions.push(sql`${spireonLocations.recordedAt} >= ${new Date(startDate)}`)
      }
      if (endDate) {
        conditions.push(sql`${spireonLocations.recordedAt} <= ${new Date(endDate)}`)
      }

      // Query location history
      const locations = await ctx.db
        .select({
          id: spireonLocations.id,
          lat: spireonLocations.lat,
          lng: spireonLocations.lng,
          speed: spireonLocations.speed,
          heading: spireonLocations.heading,
          address: spireonLocations.address,
          city: spireonLocations.city,
          eventType: spireonLocations.eventType,
          recordedAt: spireonLocations.recordedAt,
        })
        .from(spireonLocations)
        .where(and(...conditions))
        .orderBy(desc(spireonLocations.recordedAt))
        .limit(limit)

      return {
        locations: locations.map(loc => ({
          ...loc,
          lat: Number(loc.lat),
          lng: Number(loc.lng),
          speed: loc.speed ? Number(loc.speed) : null,
        })),
        deviceId: device.id,
        lastAtShopAt: device.lastAtShopAt,
        vehicleVin: vehicle[0].vin,
        unitNumber: vehicle[0].unitNumber,
      }
    }),
})

// Customers router - customer management with aggregated data
const customersRouter = t.router({
  // List customers with search and filters
  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().min(0).default(0),
      search: z.string().optional(), // Search by name, email, phone
      hasActiveRental: z.boolean().optional(), // Filter customers with active rentals
      sortBy: z.enum(['name', 'recent', 'rentals']).default('name'),
    }).optional())
    .query(async ({ ctx, input }) => {
      const { limit = 100, offset = 0, search, hasActiveRental, sortBy = 'name' } = input || {}

      // Build base query conditions - filter out inactive customers
      const conditions = [sql`${coreCustomers.status} != 'deleted'`]

      if (search) {
        const searchPattern = `%${search}%`
        conditions.push(
          or(
            ilike(coreCustomers.fullName, searchPattern),
            ilike(coreCustomers.primaryEmail, searchPattern),
            ilike(coreCustomers.primaryPhone, searchPattern),
            ilike(hqCustomers.licenseNumber, searchPattern)
          ) ?? sql`false`
        )
      }

      // Get customers from core_customers with HQ data
      const customersData = await ctx.db
        .select({
          id: coreCustomers.id,
          fullName: coreCustomers.fullName,
          email: coreCustomers.primaryEmail,
          phone: coreCustomers.primaryPhone,
          companyName: coreCustomers.companyName,
          status: coreCustomers.status,
          totalRentals: coreCustomers.totalRentals,
          totalSpent: coreCustomers.totalSpent,
          lastRentalAt: coreCustomers.lastRentalAt,
          createdAt: coreCustomers.createdAt,
          updatedAt: coreCustomers.updatedAt,
          // HQ specific fields
          hqId: hqCustomers.id,
          hqExternalId: hqCustomers.externalId,
          licenseNumber: hqCustomers.licenseNumber,
          dateOfBirth: hqCustomers.dateOfBirth,
          raw: hqCustomers.raw,
        })
        .from(coreCustomers)
        .leftJoin(
          sql`LATERAL (
            SELECT el.external_id, hqc.*
            FROM external_links el
            INNER JOIN hq_customers hqc ON hqc.external_id = el.external_id
            WHERE el.entity_type = 'customer'
              AND el.entity_id = ${coreCustomers.id}
              AND el.source_system = 'hq'
              AND hqc.deleted_at IS NULL
            LIMIT 1
          ) AS hq_data`,
          sql`true`
        )
        .leftJoin(hqCustomers, eq(sql`hq_data.id`, hqCustomers.id))
        .where(and(...conditions))
        .orderBy(
          sortBy === 'name' ? coreCustomers.fullName :
          sortBy === 'recent' ? desc(coreCustomers.updatedAt) :
          desc(coreCustomers.createdAt)
        )
        .limit(limit)
        .offset(offset)

      // Get counts for related data
      const customerIds = customersData.map(c => c.id)

      // Count active rentals per customer
      const activeRentals = customerIds.length > 0 ? await ctx.db
        .select({
          customerId: sql<string>`el.entity_id`,
          count: sql<number>`count(*)::int`,
        })
        .from(hqReservations)
        .innerJoin(
          sql`external_links el`,
          sql`el.source_system = 'hq' AND el.entity_type = 'customer' AND el.external_id = ${hqReservations.customerId}`
        )
        .where(and(
          sql`el.entity_id = ANY(${customerIds})`,
          eq(hqReservations.status, 'active'),
          sql`${hqReservations.deletedAt} IS NULL`
        ))
        .groupBy(sql`el.entity_id`) : []

      const activeRentalMap = new Map(activeRentals.map(r => [r.customerId, r.count]))

      // Count timeline events per customer
      const eventCounts = customerIds.length > 0 ? await ctx.db
        .select({
          customerId: timelineEventLinks.entityId,
          count: sql<number>`count(*)::int`,
        })
        .from(timelineEventLinks)
        .where(and(
          eq(timelineEventLinks.entityType, 'customer'),
          inArray(timelineEventLinks.entityId, customerIds)
        ))
        .groupBy(timelineEventLinks.entityId) : []

      const eventCountMap = new Map(eventCounts.map(e => [e.customerId, e.count]))

      // Map customers with aggregated data
      const customers = customersData.map(c => {
        const rawData = c.raw as Record<string, any> || {}
        const activeRentalCount = activeRentalMap.get(c.id) || 0
        const eventCount = eventCountMap.get(c.id) || 0

        return {
          id: c.id,
          fullName: c.fullName,
          email: c.email,
          phone: c.phone,
          companyName: c.companyName,
          status: c.status,
          totalRentals: c.totalRentals,
          totalSpent: c.totalSpent,
          lastRentalAt: c.lastRentalAt,
          licenseNumber: c.licenseNumber,
          dateOfBirth: c.dateOfBirth,
          hqExternalId: c.hqExternalId,
          activeRentals: activeRentalCount,
          totalEvents: eventCount,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        }
      })

      // Filter by active rental if requested
      const filteredCustomers = hasActiveRental !== undefined
        ? customers.filter(c => hasActiveRental ? c.activeRentals > 0 : c.activeRentals === 0)
        : customers

      // Get total count
      const [countResult] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(coreCustomers)
        .where(and(...conditions))

      return {
        customers: filteredCustomers,
        total: countResult?.count ?? filteredCustomers.length,
        offset,
        limit,
      }
    }),

  // Get single customer with full details
  get: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      // Get customer from core_customers with HQ data
      const [customer] = await ctx.db
        .select({
          id: coreCustomers.id,
          fullName: coreCustomers.fullName,
          email: coreCustomers.primaryEmail,
          phone: coreCustomers.primaryPhone,
          companyName: coreCustomers.companyName,
          status: coreCustomers.status,
          totalRentals: coreCustomers.totalRentals,
          totalSpent: coreCustomers.totalSpent,
          lastRentalAt: coreCustomers.lastRentalAt,
          createdAt: coreCustomers.createdAt,
          updatedAt: coreCustomers.updatedAt,
        })
        .from(coreCustomers)
        .where(and(
          eq(coreCustomers.id, input.id),
          sql`${coreCustomers.status} != 'deleted'`
        ))
        .limit(1)

      if (!customer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer not found',
        })
      }

      // Get HQ customer data via external_links
      const hqCustomerData = await ctx.db
        .select({
          licenseNumber: hqCustomers.licenseNumber,
          dateOfBirth: hqCustomers.dateOfBirth,
          raw: hqCustomers.raw,
        })
        .from(hqCustomers)
        .innerJoin(
          sql`external_links el`,
          sql`el.source_system = 'hq' AND el.entity_type = 'customer' AND el.entity_id = ${input.id} AND el.external_id = ${hqCustomers.externalId}`
        )
        .where(sql`${hqCustomers.deletedAt} IS NULL`)
        .limit(1)
      const hqCustomer = hqCustomerData[0]

      // Get current active rentals
      const activeRentals = await ctx.db
        .select({
          id: hqReservations.id,
          externalId: hqReservations.externalId,
          vehicleId: hqReservations.vehicleId,
          startDate: hqReservations.pickupDate,
          endDate: hqReservations.returnDate,
          status: hqReservations.status,
          totalAmount: hqReservations.totalEstimate,
          raw: hqReservations.raw,
        })
        .from(hqReservations)
        .innerJoin(
          sql`external_links el`,
          sql`el.source_system = 'hq' AND el.entity_type = 'customer' AND el.entity_id = ${input.id} AND el.external_id = ${hqReservations.customerId}`
        )
        .where(and(
          eq(hqReservations.status, 'active'),
          sql`${hqReservations.deletedAt} IS NULL`
        ))
        .limit(10)

      // Get upcoming reservations
      const upcomingReservations = await ctx.db
        .select({
          id: hqReservations.id,
          externalId: hqReservations.externalId,
          vehicleId: hqReservations.vehicleId,
          startDate: hqReservations.pickupDate,
          endDate: hqReservations.returnDate,
          status: hqReservations.status,
          totalAmount: hqReservations.totalEstimate,
          raw: hqReservations.raw,
        })
        .from(hqReservations)
        .innerJoin(
          sql`external_links el`,
          sql`el.source_system = 'hq' AND el.entity_type = 'customer' AND el.entity_id = ${input.id} AND el.external_id = ${hqReservations.customerId}`
        )
        .where(and(
          eq(hqReservations.status, 'upcoming'),
          sql`${hqReservations.deletedAt} IS NULL`
        ))
        .orderBy(hqReservations.pickupDate)
        .limit(10)

      // Get lifetime stats
      const [rentalStats] = await ctx.db
        .select({
          totalRentals: sql<number>`count(*)::int`,
          totalRevenue: sql<number>`sum(${hqReservations.totalEstimate})::numeric`,
        })
        .from(hqReservations)
        .innerJoin(
          sql`external_links el`,
          sql`el.source_system = 'hq' AND el.entity_type = 'customer' AND el.entity_id = ${input.id} AND el.external_id = ${hqReservations.customerId}`
        )
        .where(sql`${hqReservations.deletedAt} IS NULL`)

      // Get event counts by type
      const eventCounts = await ctx.db
        .select({
          type: timelineEvents.eventType,
          count: sql<number>`count(*)::int`,
        })
        .from(timelineEvents)
        .innerJoin(timelineEventLinks, eq(timelineEventLinks.timelineEventId, timelineEvents.id))
        .where(and(
          eq(timelineEventLinks.entityType, 'customer'),
          eq(timelineEventLinks.entityId, input.id)
        ))
        .groupBy(timelineEvents.eventType)

      const eventCountMap: Record<string, number> = {}
      for (const e of eventCounts) {
        if (e.type) eventCountMap[e.type] = e.count
      }

      // Simplified: skip complex email queries for now (schema mismatch)
      const recentEmails: Array<{ id: string; subject: string | null; snippet: string | null; fromEmail: string | null; fromName: string | null; date: Date | null }> = []

      // Simplified: skip complex Monday queries for now (schema mismatch)
      const mondayItemsData: Array<{ id: string; externalId: string; name: string | null; boardId: string; boardName: string | null; updatedAt: Date | null }> = []

      return {
        customer: {
          ...customer,
          licenseNumber: hqCustomer?.licenseNumber,
          dateOfBirth: hqCustomer?.dateOfBirth,
          hqRaw: hqCustomer?.raw,
        },
        stats: {
          lifetimeRentals: rentalStats?.totalRentals ?? 0,
          totalRevenue: rentalStats?.totalRevenue ? Number(rentalStats.totalRevenue) : 0,
          emailCount: eventCountMap['email_received'] || 0,
          mondayItemCount: mondayItemsData.length,
          totalEvents: Object.values(eventCountMap).reduce((sum, c) => sum + c, 0),
        },
        activeRentals,
        upcomingReservations,
        recentEmails,
        mondayItems: mondayItemsData,
      }
    }),

  // Get customer stats for dashboard
  stats: publicProcedure.query(async ({ ctx }) => {
    const [totals] = await ctx.db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(coreCustomers)
      .where(sql`${coreCustomers.status} != 'deleted'`)

    // Count customers with active rentals
    const [withActiveRentals] = await ctx.db
      .select({
        count: sql<number>`count(DISTINCT el.entity_id)::int`,
      })
      .from(hqReservations)
      .innerJoin(
        sql`external_links el`,
        sql`el.source_system = 'hq' AND el.entity_type = 'customer' AND el.external_id = ${hqReservations.customerId}`
      )
      .where(and(
        eq(hqReservations.status, 'active'),
        sql`${hqReservations.deletedAt} IS NULL`
      ))

    // Count recent customers (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [recentCustomers] = await ctx.db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(coreCustomers)
      .where(and(
        sql`${coreCustomers.status} != 'deleted'`,
        gte(coreCustomers.createdAt, thirtyDaysAgo)
      ))

    return {
      total: totals?.total ?? 0,
      withActiveRentals: withActiveRentals?.count ?? 0,
      recentCustomers: recentCustomers?.count ?? 0,
    }
  }),

  // Search customers for typeahead
  search: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(20).default(10),
    }))
    .query(async ({ ctx, input }) => {
      const searchPattern = `%${input.query}%`

      const results = await ctx.db
        .select({
          id: coreCustomers.id,
          fullName: coreCustomers.fullName,
          email: coreCustomers.primaryEmail,
          phone: coreCustomers.primaryPhone,
        })
        .from(coreCustomers)
        .where(and(
          sql`${coreCustomers.status} != 'deleted'`,
          or(
            ilike(coreCustomers.fullName, searchPattern),
            ilike(coreCustomers.primaryEmail, searchPattern),
            ilike(coreCustomers.primaryPhone, searchPattern)
          ) ?? sql`false`
        ))
        .limit(input.limit)

      return results
    }),
})

// Dashboard router - aggregated stats for the dashboard
const dashboardRouter = t.router({
  // Get all dashboard stats in a single call
  stats: publicProcedure.query(async ({ ctx }) => {
    // Get fleet VINs from Monday board for vehicle matching
    const fleetVins = await ctx.db
      .select({ vin: sql<string>`UPPER(${mondayItemColumnValues.textValue})` })
      .from(mondayItemColumnValues)
      .innerJoin(mondayItems, eq(mondayItemColumnValues.itemId, mondayItems.id))
      .innerJoin(mondayBoards, eq(mondayItems.boardId, mondayBoards.id))
      .innerJoin(mondayColumns, eq(mondayItemColumnValues.columnId, mondayColumns.id))
      .where(and(
        eq(mondayBoards.externalId, FLEET_BOARD_EXTERNAL_ID),
        eq(mondayColumns.title, 'VIN'),
        sql`LENGTH(${mondayItemColumnValues.textValue}) = 17`
      ))

    const vinSet = new Set(fleetVins.map(v => v.vin?.toUpperCase()).filter(Boolean))

    // Get Spireon devices and count matches
    const spireonAll = await ctx.db
      .select({
        vehicleVin: spireonDevices.vehicleVin,
        isOnline: spireonDevices.isOnline,
        name: spireonDevices.name,
      })
      .from(spireonDevices)
      .where(sql`${spireonDevices.name} NOT ILIKE '%inactive%'`)

    const fleetDevices = spireonAll.filter(d => d.vehicleVin && vinSet.has(d.vehicleVin.toUpperCase()))

    // HQ Reservations
    const reservationStats = await ctx.db
      .select({
        status: hqReservations.status,
        count: sql<number>`count(*)`,
      })
      .from(hqReservations)
      .groupBy(hqReservations.status)

    const reservationsByStatus: Record<string, number> = {}
    for (const r of reservationStats) {
      reservationsByStatus[r.status || 'unknown'] = Number(r.count)
    }

    // HQ Customers
    const customerCount = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(hqCustomers)

    // Gmail Messages
    const gmailCount = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(gmailMessages)

    // Monday Items
    const mondayCount = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(mondayItems)

    // Timeline Events
    const timelineCount = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(timelineEvents)

    // Timeline events by source (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentEventsBySource = await ctx.db
      .select({
        source: timelineEvents.source,
        count: sql<number>`count(*)`,
      })
      .from(timelineEvents)
      .where(gte(timelineEvents.occurredAt, weekAgo))
      .groupBy(timelineEvents.source)

    const eventsBySource: Record<string, number> = {}
    for (const e of recentEventsBySource) {
      eventsBySource[e.source] = Number(e.count)
    }

    // Integration last sync times
    const integrations = await ctx.db
      .select({
        type: integrationAccounts.type,
        name: integrationAccounts.name,
        isActive: integrationAccounts.isActive,
        lastSyncAt: integrationAccounts.lastSyncAt,
      })
      .from(integrationAccounts)
      .where(eq(integrationAccounts.isActive, true))

    return {
      // Vehicle stats
      fleetVehicles: fleetDevices.length,
      activeVehicles: fleetDevices.filter(d => d.isOnline).length,
      totalSpieonDevices: spireonAll.length,

      // Rental stats
      activeRentals: reservationsByStatus['rental'] || 0,
      openReservations: reservationsByStatus['open'] || 0,
      completedReservations: reservationsByStatus['completed'] || 0,
      totalReservations: Object.values(reservationsByStatus).reduce((a, b) => a + b, 0),

      // Customer stats
      totalCustomers: Number(customerCount[0]?.count || 0),

      // Integration stats
      integrations: {
        monday: {
          itemCount: Number(mondayCount[0]?.count || 0),
          lastSync: integrations.find(i => i.type === 'monday')?.lastSyncAt,
        },
        hq: {
          reservationCount: Object.values(reservationsByStatus).reduce((a, b) => a + b, 0),
          customerCount: Number(customerCount[0]?.count || 0),
          lastSync: integrations.find(i => i.type === 'hq')?.lastSyncAt,
        },
        gmail: {
          messageCount: Number(gmailCount[0]?.count || 0),
          lastSync: integrations.find(i => i.type === 'gmail')?.lastSyncAt,
        },
        spireon: {
          deviceCount: spireonAll.length,
          lastSync: integrations.find(i => i.type === 'spireon')?.lastSyncAt,
        },
      },

      // Timeline stats
      totalTimelineEvents: Number(timelineCount[0]?.count || 0),
      recentEventsBySource: eventsBySource,
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
  vehicles: vehiclesRouter,
  customers: customersRouter,
  dashboard: dashboardRouter,
})

export type AppRouter = typeof appRouter
