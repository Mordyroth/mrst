/**
 * MRST Worker Process
 * Handles background jobs using pg-boss
 */

import PgBoss from 'pg-boss'
import { createDb, type Database } from '@mrst/db'

// Job types
export const JOB_TYPES = {
  // Sync jobs
  SYNC_MONDAY_FULL: 'sync:monday:full',
  SYNC_MONDAY_INCREMENTAL: 'sync:monday:incremental',
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
 * Register job handlers
 */
async function registerHandlers(boss: PgBoss, db: Database): Promise<void> {
  console.log('[Worker] Registering job handlers...')

  // Monday sync jobs
  await boss.work(JOB_TYPES.SYNC_MONDAY_FULL, { teamConcurrency: 1 }, async (job) => {
    console.log(`[Worker] Processing ${JOB_TYPES.SYNC_MONDAY_FULL}:`, job.id)
    // Will be implemented in Phase 1
    return { status: 'not_implemented' }
  })

  await boss.work(JOB_TYPES.SYNC_MONDAY_INCREMENTAL, { teamConcurrency: 1 }, async (job) => {
    console.log(`[Worker] Processing ${JOB_TYPES.SYNC_MONDAY_INCREMENTAL}:`, job.id)
    // Will be implemented in Phase 1
    return { status: 'not_implemented' }
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
    // Will be implemented in Phase 1
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
