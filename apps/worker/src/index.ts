/**
 * MRST Worker Process
 * Handles background jobs using pg-boss
 */

import PgBoss from 'pg-boss'
import { createDb, type Database, integrationAccounts, tenants } from '@mrst/db'
import { eq, and } from 'drizzle-orm'
import {
  MondayClient,
  syncWorkspaces,
  syncBoards,
  syncUsers,
  syncFullBoard,
  downloadPendingFiles,
  type SyncContext,
} from '@mrst/integrations/monday'
import {
  HQClient,
  syncAll as hqSyncAll,
  syncIncremental as hqSyncIncremental,
  downloadPendingDocuments as hqDownloadPendingDocuments,
  type SyncContext as HQSyncContext,
} from '@mrst/integrations/hq'

// Job types
export const JOB_TYPES = {
  // Sync jobs
  SYNC_MONDAY_FULL: 'sync:monday:full',
  SYNC_MONDAY_INCREMENTAL: 'sync:monday:incremental',
  SYNC_MONDAY_BOARD: 'sync:monday:board',
  SYNC_HQ_FULL: 'sync:hq:full',
  SYNC_HQ_INCREMENTAL: 'sync:hq:incremental',
  SYNC_GMAIL: 'sync:gmail',
  SYNC_SPIREON: 'sync:spireon',
  SYNC_WHATSAPP: 'sync:whatsapp',
  // File processing
  DOWNLOAD_FILE: 'file:download',
  PROCESS_OCR: 'file:ocr',
  // Identity
  LINK_IDENTITY: 'identity:link',
  MERGE_IDENTITY: 'identity:merge',
  // Timeline
  CREATE_TIMELINE_EVENT: 'timeline:create',
  // AI
  GENERATE_EMBEDDINGS: 'ai:embeddings',
  GENERATE_SUGGESTIONS: 'ai:suggestions',
  // Maintenance
  CLEANUP_EXPIRED_SESSIONS: 'maintenance:cleanup_sessions',
} as const

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES]

// Job data types
interface MondaySyncJobData {
  integrationAccountId: string
  tenantId: string
}

interface MondayBoardSyncJobData extends MondaySyncJobData {
  boardId: string
  syncActivity?: boolean
  activityDays?: number
}

interface HQSyncJobData {
  integrationAccountId: string
  tenantId: string
  days?: number // for incremental sync
}

// Global instances
let boss: PgBoss | null = null
let db: Database | null = null

/**
 * Initialize pg-boss
 */
async function initBoss(): Promise<PgBoss> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  console.log('[Worker] Initializing pg-boss...')

  boss = new PgBoss({
    connectionString,
    // Schema config
    schema: 'pgboss',
    // Archiving
    archiveCompletedAfterSeconds: 60 * 60 * 24, // 24 hours
    archiveFailedAfterSeconds: 60 * 60 * 24 * 7, // 7 days
    // Monitoring
    monitorStateIntervalSeconds: 30,
    // Maintenance
    maintenanceIntervalSeconds: 60,
    deleteAfterSeconds: 60 * 60 * 24 * 14, // 14 days
  })

  boss.on('error', (error) => {
    console.error('[Worker] pg-boss error:', error)
  })

  boss.on('monitor-states', (states) => {
    console.log('[Worker] Queue states:', JSON.stringify(states, null, 2))
  })

  await boss.start()
  console.log('[Worker] pg-boss started')

  return boss
}

/**
 * Initialize database connection
 */
function initDb(): Database {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  console.log('[Worker] Connecting to database...')
  db = createDb(connectionString)
  console.log('[Worker] Database connected')

  return db
}

/**
 * Get Monday.com client for an integration account
 */
async function getMondayClient(db: Database, integrationAccountId: string): Promise<MondayClient | null> {
  const account = await db
    .select({ credentials: integrationAccounts.credentials })
    .from(integrationAccounts)
    .where(
      and(
        eq(integrationAccounts.id, integrationAccountId),
        eq(integrationAccounts.type, 'monday'),
        eq(integrationAccounts.isActive, true)
      )
    )
    .limit(1)

  const firstAccount = account[0]
  if (!firstAccount) {
    return null
  }

  const credentials = firstAccount.credentials as { apiKey: string }
  if (!credentials?.apiKey) {
    return null
  }

  return new MondayClient({ apiKey: credentials.apiKey })
}

/**
 * Get HQ Rental client for an integration account
 */
async function getHQClient(db: Database, integrationAccountId: string): Promise<HQClient | null> {
  const account = await db
    .select({ credentials: integrationAccounts.credentials })
    .from(integrationAccounts)
    .where(
      and(
        eq(integrationAccounts.id, integrationAccountId),
        eq(integrationAccounts.type, 'hq'),
        eq(integrationAccounts.isActive, true)
      )
    )
    .limit(1)

  const firstAccount = account[0]
  if (!firstAccount) {
    return null
  }

  const credentials = firstAccount.credentials as { tenantToken: string; userToken: string; baseUrl?: string }
  if (!credentials?.tenantToken || !credentials?.userToken) {
    return null
  }

  return new HQClient({
    tenantToken: credentials.tenantToken,
    userToken: credentials.userToken,
    baseUrl: credentials.baseUrl,
  })
}

/**
 * Create sync context for HQ Rental
 */
function createHQSyncContext(
  db: Database,
  client: HQClient,
  integrationAccountId: string,
  tenantId: string,
  jobId: string
): HQSyncContext {
  return {
    db,
    client,
    integrationAccountId,
    tenantId,
    onProgress: (message, counts) => {
      if (counts) {
        console.log(`[Worker:${jobId}] ${message} - created: ${counts.created}, updated: ${counts.updated}, unchanged: ${counts.unchanged}`)
      } else {
        console.log(`[Worker:${jobId}] ${message}`)
      }
    },
  }
}

/**
 * Create sync context for Monday.com
 */
function createSyncContext(
  db: Database,
  client: MondayClient,
  integrationAccountId: string,
  tenantId: string,
  jobId: string
): SyncContext {
  return {
    db,
    client,
    integrationAccountId,
    tenantId,
    onProgress: (message, counts) => {
      if (counts) {
        console.log(`[Worker:${jobId}] ${message} - created: ${counts.created}, updated: ${counts.updated}, unchanged: ${counts.unchanged}`)
      } else {
        console.log(`[Worker:${jobId}] ${message}`)
      }
    },
  }
}

/**
 * Register job handlers
 */
async function registerHandlers(boss: PgBoss, db: Database): Promise<void> {
  console.log('[Worker] Registering job handlers...')

  // Monday full sync - sync everything
  await boss.work<MondaySyncJobData>(JOB_TYPES.SYNC_MONDAY_FULL, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      console.log(`[Worker] Processing ${JOB_TYPES.SYNC_MONDAY_FULL}:`, job.id)

      const { integrationAccountId, tenantId } = job.data
      const client = await getMondayClient(db, integrationAccountId)

      if (!client) {
        console.error(`[Worker:${job.id}] Monday.com client not available for account ${integrationAccountId}`)
        return { status: 'error', error: 'Client not available' }
      }

      const ctx = createSyncContext(db, client, integrationAccountId, tenantId, job.id)

      try {
        // Sync workspaces
        const workspacesResult = await syncWorkspaces(ctx)
        console.log(`[Worker:${job.id}] Workspaces: ${workspacesResult.success ? 'OK' : 'FAILED'}`)

        // Sync all boards
        const boardsResult = await syncBoards(ctx, { markInScope: false })
        console.log(`[Worker:${job.id}] Boards: ${boardsResult.success ? 'OK' : 'FAILED'}`)

        // Sync users
        const usersResult = await syncUsers(ctx)
        console.log(`[Worker:${job.id}] Users: ${usersResult.success ? 'OK' : 'FAILED'}`)

        return {
          status: 'success',
          workspaces: workspacesResult.counts,
          boards: boardsResult.counts,
          users: usersResult.counts,
        }
      } catch (error) {
        console.error(`[Worker:${job.id}] Monday full sync failed:`, error)
        return { status: 'error', error: (error as Error).message }
      }
    }
  })

  // Monday incremental sync - sync in-scope boards
  await boss.work<MondaySyncJobData>(JOB_TYPES.SYNC_MONDAY_INCREMENTAL, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      console.log(`[Worker] Processing ${JOB_TYPES.SYNC_MONDAY_INCREMENTAL}:`, job.id)

      const { integrationAccountId, tenantId } = job.data
      const client = await getMondayClient(db, integrationAccountId)

      if (!client) {
        console.error(`[Worker:${job.id}] Monday.com client not available for account ${integrationAccountId}`)
        return { status: 'error', error: 'Client not available' }
      }

      const ctx = createSyncContext(db, client, integrationAccountId, tenantId, job.id)

      try {
        // Get in-scope boards
        const { mondayBoards } = await import('@mrst/db')
        const inScopeBoards = await db
          .select({ externalId: mondayBoards.externalId, name: mondayBoards.name })
          .from(mondayBoards)
          .where(
            and(
              eq(mondayBoards.integrationAccountId, integrationAccountId),
              eq(mondayBoards.inScope, true)
            )
          )

        console.log(`[Worker:${job.id}] Syncing ${inScopeBoards.length} in-scope boards`)

        const results: Record<string, unknown> = {}

        for (const board of inScopeBoards) {
          const result = await syncFullBoard(ctx, board.externalId, {
            syncActivity: true,
            activityFrom: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            trackValueChanges: true,
          })
          results[board.externalId] = {
            name: board.name,
            schema: result.schema.success,
            items: result.items.counts.processed,
            activity: result.activity?.counts.processed || 0,
          }
        }

        return { status: 'success', boards: results }
      } catch (error) {
        console.error(`[Worker:${job.id}] Monday incremental sync failed:`, error)
        return { status: 'error', error: (error as Error).message }
      }
    }
  })

  // Monday board sync - sync a specific board
  await boss.work<MondayBoardSyncJobData>(JOB_TYPES.SYNC_MONDAY_BOARD, { batchSize: 3 }, async (jobs) => {
    for (const job of jobs) {
      console.log(`[Worker] Processing ${JOB_TYPES.SYNC_MONDAY_BOARD}:`, job.id)

      const { integrationAccountId, tenantId, boardId, syncActivity, activityDays } = job.data
      const client = await getMondayClient(db, integrationAccountId)

      if (!client) {
        console.error(`[Worker:${job.id}] Monday.com client not available for account ${integrationAccountId}`)
        return { status: 'error', error: 'Client not available' }
      }

      const ctx = createSyncContext(db, client, integrationAccountId, tenantId, job.id)

      try {
        const result = await syncFullBoard(ctx, boardId, {
          syncActivity: syncActivity ?? true,
          activityFrom: activityDays
            ? new Date(Date.now() - activityDays * 24 * 60 * 60 * 1000)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default 30 days
          trackValueChanges: true,
        })

        return {
          status: 'success',
          boardId,
          schema: result.schema.counts,
          items: result.items.counts,
          activity: result.activity?.counts,
        }
      } catch (error) {
        console.error(`[Worker:${job.id}] Monday board sync failed:`, error)
        return { status: 'error', error: (error as Error).message }
      }
    }
  })

  // HQ full sync - sync all reservations
  await boss.work<HQSyncJobData>(JOB_TYPES.SYNC_HQ_FULL, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      console.log(`[Worker] Processing ${JOB_TYPES.SYNC_HQ_FULL}:`, job.id)

      const { integrationAccountId, tenantId } = job.data
      const client = await getHQClient(db, integrationAccountId)

      if (!client) {
        console.error(`[Worker:${job.id}] HQ client not available for account ${integrationAccountId}`)
        return { status: 'error', error: 'Client not available' }
      }

      const ctx = createHQSyncContext(db, client, integrationAccountId, tenantId, job.id)

      try {
        // Full sync
        const result = await hqSyncAll(ctx, { batchSize: 10 })

        console.log(`[Worker:${job.id}] HQ full sync results:`)
        console.log(`  Reservations: ${result.reservations.success ? 'OK' : 'FAILED'} (${result.reservations.counts.created} created)`)
        console.log(`  Customers: ${result.customers.success ? 'OK' : 'FAILED'} (${result.customers.counts.created} created)`)
        console.log(`  Vehicles: ${result.vehicles.success ? 'OK' : 'FAILED'} (${result.vehicles.counts.created} created)`)

        // Also download pending documents
        const docResult = await hqDownloadPendingDocuments(ctx, { batchSize: 5, maxFiles: 100 })
        console.log(`  Documents: ${docResult.success ? 'OK' : 'FAILED'} (${docResult.counts.updated} downloaded)`)

        return {
          status: 'success',
          reservations: result.reservations.counts,
          customers: result.customers.counts,
          vehicles: result.vehicles.counts,
          documents: docResult.counts,
        }
      } catch (error) {
        console.error(`[Worker:${job.id}] HQ full sync failed:`, error)
        return { status: 'error', error: (error as Error).message }
      }
    }
  })

  // HQ incremental sync - sync recent reservations
  await boss.work<HQSyncJobData>(JOB_TYPES.SYNC_HQ_INCREMENTAL, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      console.log(`[Worker] Processing ${JOB_TYPES.SYNC_HQ_INCREMENTAL}:`, job.id)

      const { integrationAccountId, tenantId, days = 7 } = job.data
      const client = await getHQClient(db, integrationAccountId)

      if (!client) {
        console.error(`[Worker:${job.id}] HQ client not available for account ${integrationAccountId}`)
        return { status: 'error', error: 'Client not available' }
      }

      const ctx = createHQSyncContext(db, client, integrationAccountId, tenantId, job.id)

      try {
        // Incremental sync - last N days
        const result = await hqSyncIncremental(ctx, { days })

        console.log(`[Worker:${job.id}] HQ incremental sync (${days} days) results:`)
        console.log(`  Reservations: ${result.reservations.counts.processed} processed`)
        console.log(`  Customers: ${result.customers.counts.created} new`)
        console.log(`  Vehicles: ${result.vehicles.counts.created} new`)

        // Also download pending documents
        const docResult = await hqDownloadPendingDocuments(ctx, { batchSize: 5, maxFiles: 50 })
        console.log(`  Documents: ${docResult.counts.updated} downloaded`)

        return {
          status: 'success',
          reservations: result.reservations.counts,
          customers: result.customers.counts,
          vehicles: result.vehicles.counts,
          documents: docResult.counts,
        }
      } catch (error) {
        console.error(`[Worker:${job.id}] HQ incremental sync failed:`, error)
        return { status: 'error', error: (error as Error).message }
      }
    }
  })

  // Gmail sync
  await boss.work(JOB_TYPES.SYNC_GMAIL, { batchSize: 2 }, async (jobs) => {
    for (const job of jobs) {
      console.log(`[Worker] Processing ${JOB_TYPES.SYNC_GMAIL}:`, job.id)
      // Will be implemented in Phase 4
      return { status: 'not_implemented' }
    }
  })

  // Spireon sync
  await boss.work(JOB_TYPES.SYNC_SPIREON, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      console.log(`[Worker] Processing ${JOB_TYPES.SYNC_SPIREON}:`, job.id)
      // Will be implemented in Phase 5
      return { status: 'not_implemented' }
    }
  })

  // WhatsApp sync
  await boss.work(JOB_TYPES.SYNC_WHATSAPP, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      console.log(`[Worker] Processing ${JOB_TYPES.SYNC_WHATSAPP}:`, job.id)
      // Will be implemented in Phase 6
      return { status: 'not_implemented' }
    }
  })

  // File download (Monday.com files to S3)
  await boss.work<MondaySyncJobData>(JOB_TYPES.DOWNLOAD_FILE, { batchSize: 2 }, async (jobs) => {
    for (const job of jobs) {
      console.log(`[Worker] Processing ${JOB_TYPES.DOWNLOAD_FILE}:`, job.id)

      const { integrationAccountId, tenantId } = job.data
      const client = await getMondayClient(db, integrationAccountId)

      if (!client) {
        console.error(`[Worker:${job.id}] Monday.com client not available for account ${integrationAccountId}`)
        return { status: 'error', error: 'Client not available' }
      }

      const ctx = createSyncContext(db, client, integrationAccountId, tenantId, job.id)

      try {
        const result = await downloadPendingFiles(ctx, { batchSize: 5, maxFiles: 50 })
        return {
          status: result.success ? 'success' : 'error',
          counts: result.counts,
          error: result.error,
        }
      } catch (error) {
        console.error(`[Worker:${job.id}] File download failed:`, error)
        return { status: 'error', error: (error as Error).message }
      }
    }
  })

  // OCR processing
  await boss.work(JOB_TYPES.PROCESS_OCR, { batchSize: 2 }, async (jobs) => {
    for (const job of jobs) {
      console.log(`[Worker] Processing ${JOB_TYPES.PROCESS_OCR}:`, job.id)
      // Will be implemented in Phase 7
      return { status: 'not_implemented' }
    }
  })

  // Identity linking
  await boss.work(JOB_TYPES.LINK_IDENTITY, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      console.log(`[Worker] Processing ${JOB_TYPES.LINK_IDENTITY}:`, job.id)
      // Will be implemented in Phase 2
      return { status: 'not_implemented' }
    }
  })

  // Timeline event creation
  await boss.work(JOB_TYPES.CREATE_TIMELINE_EVENT, { batchSize: 5 }, async (jobs) => {
    for (const job of jobs) {
      console.log(`[Worker] Processing ${JOB_TYPES.CREATE_TIMELINE_EVENT}:`, job.id)
      // Will be implemented in Phase 3
      return { status: 'not_implemented' }
    }
  })

  // Session cleanup (runs every hour)
  await boss.schedule(JOB_TYPES.CLEANUP_EXPIRED_SESSIONS, '0 * * * *', {})
  await boss.work(JOB_TYPES.CLEANUP_EXPIRED_SESSIONS, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      console.log(`[Worker] Processing ${JOB_TYPES.CLEANUP_EXPIRED_SESSIONS}:`, job.id)
      // Delete expired sessions
      // await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
      return { status: 'completed' }
    }
  })

  // AI Embeddings generation
  await boss.work<{ tenantId: string; sourceType?: string }>(JOB_TYPES.GENERATE_EMBEDDINGS, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      console.log(`[Worker] Processing ${JOB_TYPES.GENERATE_EMBEDDINGS}:`, job.id)

      const voyageKey = process.env.VOYAGE_API_KEY
      const googleKey = process.env.GOOGLE_API_KEY

      if (!voyageKey && !googleKey) {
        console.error(`[Worker:${job.id}] No embedding API key configured (VOYAGE_API_KEY or GOOGLE_API_KEY)`)
        return { status: 'error', error: 'No embedding API key' }
      }

      try {
        const { createEmbeddingsService, runFullPipeline } = await import('@mrst/ai')
        const schema = await import('@mrst/db/schema')

        const embeddings = createEmbeddingsService({
          voyageApiKey: voyageKey,
          googleApiKey: googleKey,
        })

        const results = await runFullPipeline({
          db: db as any,
          embeddings,
          tenantId: job.data.tenantId,
          schema: {
            embeddings: schema.embeddings,
            embeddingQueue: schema.embeddingQueue,
            timelineEvents: schema.timelineEvents,
            gmailMessages: schema.gmailMessages,
            coreCustomers: schema.coreCustomers,
            coreVehicles: schema.coreVehicles,
            spireonDevices: schema.spireonDevices,
          },
          batchSize: 25,
        })

        console.log(`[Worker:${job.id}] Embedding generation complete:`, results)
        return { status: 'success', results }
      } catch (error) {
        console.error(`[Worker:${job.id}] Embedding generation failed:`, error)
        return { status: 'error', error: (error as Error).message }
      }
    }
  })

  // AI Suggestions generation
  await boss.work<{ tenantId: string }>(JOB_TYPES.GENERATE_SUGGESTIONS, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      console.log(`[Worker] Processing ${JOB_TYPES.GENERATE_SUGGESTIONS}:`, job.id)

      const anthropicKey = process.env.ANTHROPIC_API_KEY

      if (!anthropicKey) {
        console.error(`[Worker:${job.id}] ANTHROPIC_API_KEY not configured`)
        return { status: 'error', error: 'No Anthropic API key' }
      }

      try {
        const { createClaudeClient, generateSuggestions, saveSuggestions } = await import('@mrst/ai')
        const schema = await import('@mrst/db/schema')

        const claude = createClaudeClient(anthropicKey)

        const suggestions = await generateSuggestions({
          db: db as any,
          claude,
          tenantId: job.data.tenantId,
          schema: {
            aiTasks: schema.aiTasks,
            timelineEvents: schema.timelineEvents,
            gmailMessages: schema.gmailMessages,
            hqReservations: schema.hqReservations,
            coreCustomers: schema.coreCustomers,
            spireonDevices: schema.spireonDevices,
          },
        })

        const saved = await saveSuggestions({
          db: db as any,
          claude,
          tenantId: job.data.tenantId,
          schema: {
            aiTasks: schema.aiTasks,
          },
        }, suggestions)

        console.log(`[Worker:${job.id}] Generated ${suggestions.length} suggestions, saved ${saved}`)
        return { status: 'success', generated: suggestions.length, saved }
      } catch (error) {
        console.error(`[Worker:${job.id}] Suggestions generation failed:`, error)
        return { status: 'error', error: (error as Error).message }
      }
    }
  })

  console.log('[Worker] All job handlers registered')
}

/**
 * Schedule recurring jobs
 */
async function scheduleRecurringJobs(boss: PgBoss): Promise<void> {
  console.log('[Worker] Scheduling recurring jobs...')

  // Note: These will be activated when integrations are configured
  // Monday incremental sync - every 5 minutes
  // await boss.schedule(JOB_TYPES.SYNC_MONDAY_INCREMENTAL, '*/5 * * * *', {})

  // HQ incremental sync - every 5 minutes
  // await boss.schedule(JOB_TYPES.SYNC_HQ_INCREMENTAL, '*/5 * * * *', {})

  // Gmail sync - every minute
  // await boss.schedule(JOB_TYPES.SYNC_GMAIL, '* * * * *', {})

  // Spireon sync - every 30 seconds (needs special handling)
  // await boss.schedule(JOB_TYPES.SYNC_SPIREON, '*/1 * * * *', {})

  console.log('[Worker] Recurring jobs scheduled')
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  console.log('[Worker] Shutting down...')

  if (boss) {
    await boss.stop()
    console.log('[Worker] pg-boss stopped')
  }

  process.exit(0)
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('[Worker] Starting MRST Worker...')
  console.log(`[Worker] Environment: ${process.env.NODE_ENV || 'development'}`)

  try {
    // Initialize
    const bossInstance = await initBoss()
    const dbInstance = initDb()

    // Register handlers
    await registerHandlers(bossInstance, dbInstance)

    // Schedule recurring jobs
    await scheduleRecurringJobs(bossInstance)

    // Handle graceful shutdown
    process.on('SIGTERM', shutdown)
    process.on('SIGINT', shutdown)

    console.log('[Worker] Worker is running. Press Ctrl+C to stop.')
  } catch (error) {
    console.error('[Worker] Failed to start:', error)
    process.exit(1)
  }
}

// Start the worker
main()

/**
 * Export for use in other modules
 */
export function getJobQueue(): PgBoss {
  if (!boss) {
    throw new Error('pg-boss not initialized')
  }
  return boss
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}
