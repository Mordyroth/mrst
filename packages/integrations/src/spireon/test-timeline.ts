/**
 * Test timeline event generation from Spireon locations
 * Run with: DATABASE_URL='postgresql://mrst:mrst_dev_2025@localhost:5432/mrst' npx tsx packages/integrations/src/spireon/test-timeline.ts
 */

import { createSpireonClient } from './client'
import { generateTimelineEvents, type SpireonSyncConfig } from './sync'
import { createDb } from '@mrst/db'
import * as schema from '@mrst/db/schema'
import { eq, and, count } from 'drizzle-orm'

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required')
  }

  console.log('Connecting to database...')
  const db = createDb(connectionString)

  // Get the Spireon integration account
  console.log('Finding Spireon integration account...')
  const accounts = await db.select()
    .from(schema.integrationAccounts)
    .where(
      and(
        eq(schema.integrationAccounts.type, 'spireon'),
        eq(schema.integrationAccounts.isActive, true)
      )
    )
    .limit(1)

  const account = accounts[0]
  if (!account) {
    throw new Error('No active Spireon integration account found')
  }

  console.log(`Found account: ${account.name} (${account.id})`)

  const credentials = account.credentials as {
    appToken: string
    username: string
    password: string
    nspireId: string
  }

  if (!credentials?.appToken) {
    throw new Error('Spireon credentials not configured in integration account')
  }

  // Create client
  const client = createSpireonClient({
    appToken: credentials.appToken,
    username: credentials.username,
    password: credentials.password,
    nspireId: credentials.nspireId,
  })

  const config: SpireonSyncConfig & { timelineConfig: any; tenantId: string } = {
    db: db as any,
    client,
    integrationAccountId: account.id,
    tenantId: account.tenantId,
    schema: {
      spireonDevices: schema.spireonDevices,
      spireonLocations: schema.spireonLocations,
      spireonGeofences: schema.spireonGeofences,
      spireonGeofenceEvents: schema.spireonGeofenceEvents,
    },
    timelineConfig: {
      timelineEvents: schema.timelineEvents,
      timelineEventLinks: schema.timelineEventLinks,
      coreVehicles: schema.coreVehicles,
      tenants: schema.tenants,
    },
  }

  // Generate timeline events
  console.log('\n--- Generating Timeline Events ---')
  const stats = await generateTimelineEvents(config)
  console.log('Results:', stats)

  // Check timeline events in database
  const eventCounts = await db.select({
    source: schema.timelineEvents.source,
    count: count(),
  })
    .from(schema.timelineEvents)
    .where(eq(schema.timelineEvents.tenantId, account.tenantId))
    .groupBy(schema.timelineEvents.source)

  console.log('\nTimeline events by source:')
  for (const row of eventCounts) {
    console.log(`  ${row.source}: ${row.count}`)
  }

  // Show sample Spireon events
  const spireonEvents = await db.select({
    title: schema.timelineEvents.title,
    summary: schema.timelineEvents.summary,
    occurredAt: schema.timelineEvents.occurredAt,
    eventType: schema.timelineEvents.eventType,
  })
    .from(schema.timelineEvents)
    .where(
      and(
        eq(schema.timelineEvents.source, 'spireon'),
        eq(schema.timelineEvents.tenantId, account.tenantId)
      )
    )
    .orderBy(schema.timelineEvents.occurredAt)
    .limit(10)

  console.log('\nSample Spireon timeline events:')
  for (const event of spireonEvents) {
    console.log(`  [${event.eventType}] ${event.title}`)
    console.log(`    ${event.summary}`)
    console.log(`    at ${event.occurredAt}`)
  }

  console.log('\nDone!')
  process.exit(0)
}

main().catch(console.error)
