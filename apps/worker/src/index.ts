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
  type SyncContext,
} from '@mrst/integrations/monday'

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

  if (account.length === 0) {
    return null
  }

  const credentials = account[0].credentials as { apiKey: string }
  if (!credentials?.apiKey) {
    return null
  }

  return new MondayClient({ apiKey: credentials.apiKey })
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
  await boss.work<MondaySyncJobData>(JOB_TYPES.SYNC_MONDAY_FULL, { teamConcurrency: 1 }, async (job) => {
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
  })

  // Monday incremental sync - sync in-scope boards
  await boss.work<MondaySyncJobData>(JOB_TYPES.SYNC_MONDAY_INCREMENTAL, { teamConcurrency: 1 }, async (job) => {
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
  })

  // Monday board sync - sync a specific board
  await boss.work<MondayBoardSyncJobData>(JOB_TYPES.SYNC_MONDAY_BOARD, { teamConcurrency: 3 }, async (job) => {
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
  })

  // HQ sync jobs
  await boss.work(JOB_TYPES.SYNC_HQ_FULL, { teamConcurrency: 1 }, async (job) => {
    console.log(`[Worker] Processing ${JOB_TYPES.SYNC_HQ_FULL}:`, job.id)
    // Will be implemented in Phase 2
    return { status: 'not_implemented' }
  })

  await boss.work(JOB_TYPES.SYNC_HQ_INCREMENTAL, { teamConcurrency: 1 }, async (job) => {
    console.log(`[Worker] Processing ${JOB_TYPES.SYNC_HQ_INCREMENTAL}:`, job.id)
    // Will be implemented in Phase 2
    return { status: 'not_implemented' }
  })

  // Gmail sync
  await boss.work(JOB_TYPES.SYNC_GMAIL, { teamConcurrency: 2 }, async (job) => {
    console.log(`[Worker] Processing ${JOB_TYPES.SYNC_GMAIL}:`, job.id)
    // Will be implemented in Phase 4
    return { status: 'not_implemented' }
  })

  // Spireon sync
  await boss.work(JOB_TYPES.SYNC_SPIREON, { teamConcurrency: 1 }, async (job) => {
    console.log(`[Worker] Processing ${JOB_TYPES.SYNC_SPIREON}:`, job.id)
    // Will be implemented in Phase 5
    return { status: 'not_implemented' }
  })

  // WhatsApp sync
  await boss.work(JOB_TYPES.SYNC_WHATSAPP, { teamConcurrency: 1 }, async (job) => {
    console.log(`[Worker] Processing ${JOB_TYPES.SYNC_WHATSAPP}:`, job.id)
    // Will be implemented in Phase 6
    return { status: 'not_implemented' }
  })

  // File download
  await boss.work(JOB_TYPES.DOWNLOAD_FILE, { teamConcurrency: 5 }, async (job) => {
    console.log(`[Worker] Processing ${JOB_TYPES.DOWNLOAD_FILE}:`, job.id)
    // Will be implemented when S3 is configured
    return { status: 'not_implemented' }
  })

  // OCR processing
  await boss.work(JOB_TYPES.PROCESS_OCR, { teamConcurrency: 2 }, async (job) => {
    console.log(`[Worker] Processing ${JOB_TYPES.PROCESS_OCR}:`, job.id)
    // Will be implemented in Phase 7
    return { status: 'not_implemented' }
  })

  // Identity linking
  await boss.work(JOB_TYPES.LINK_IDENTITY, { teamConcurrency: 1 }, async (job) => {
    console.log(`[Worker] Processing ${JOB_TYPES.LINK_IDENTITY}:`, job.id)
    // Will be implemented in Phase 2
    return { status: 'not_implemented' }
  })

  // Timeline event creation
  await boss.work(JOB_TYPES.CREATE_TIMELINE_EVENT, { teamConcurrency: 5 }, async (job) => {
    console.log(`[Worker] Processing ${JOB_TYPES.CREATE_TIMELINE_EVENT}:`, job.id)
    // Will be implemented in Phase 3
    return { status: 'not_implemented' }
  })

  // Session cleanup (runs every hour)
  await boss.schedule(JOB_TYPES.CLEANUP_EXPIRED_SESSIONS, '0 * * * *', {})
  await boss.work(JOB_TYPES.CLEANUP_EXPIRED_SESSIONS, async (job) => {
    console.log(`[Worker] Processing ${JOB_TYPES.CLEANUP_EXPIRED_SESSIONS}:`, job.id)
    // Delete expired sessions
    // await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
    return { status: 'completed' }
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
