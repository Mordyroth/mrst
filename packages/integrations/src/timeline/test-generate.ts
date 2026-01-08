/**
 * Test script for timeline event generation
 * Run with: npx tsx packages/integrations/src/timeline/test-generate.ts
 */

import { createDb, tenants, integrationAccounts, timelineEvents, timelineEventLinks } from '@mrst/db'
import { eq, count, and } from 'drizzle-orm'
import * as timeline from './generate'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://mrst:mrst_dev_2025@localhost:5432/mrst'

async function main() {
  console.log('=== Timeline Event Generation Test ===\n')

  const db = createDb(DATABASE_URL)

  // Get tenant
  const tenantResult = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, 'travel-auto'))
    .limit(1)

  if (tenantResult.length === 0) {
    console.error('Tenant not found.')
    process.exit(1)
  }
  const tenantId = tenantResult[0]!.id

  // Get integration accounts
  const accounts = await db
    .select({ id: integrationAccounts.id, type: integrationAccounts.type })
    .from(integrationAccounts)
    .where(eq(integrationAccounts.tenantId, tenantId))

  console.log(`Found ${accounts.length} integration accounts`)

  // Process each integration account
  for (const account of accounts) {
    console.log(`\n--- Processing ${account.type} integration ---`)

    const ctx: timeline.GenerateContext = {
      db,
      tenantId,
      integrationAccountId: account.id,
      onProgress: (message, counts) => {
        if (counts) {
          console.log(`  ${message}`)
        } else {
          console.log(`  ${message}`)
        }
      },
    }

    if (account.type === 'monday') {
      const updates = await timeline.generateFromMondayUpdates(ctx)
      console.log(`  Updates: ${updates.created} created, ${updates.skipped} skipped`)

      const replies = await timeline.generateFromMondayReplies(ctx)
      console.log(`  Replies: ${replies.created} created, ${replies.skipped} skipped`)

      const activity = await timeline.generateFromMondayActivity(ctx)
      console.log(`  Activity: ${activity.created} created, ${activity.skipped} skipped`)
    }

    if (account.type === 'hq') {
      const reservations = await timeline.generateFromHQReservations(ctx)
      console.log(`  Reservations: ${reservations.created} created, ${reservations.skipped} skipped`)

      const contracts = await timeline.generateFromHQContracts(ctx)
      console.log(`  Contracts: ${contracts.created} created, ${contracts.skipped} skipped`)
    }
  }

  // Summary
  console.log('\n\n=== Database Summary ===')

  const eventCounts = await db
    .select({
      source: timelineEvents.source,
      eventType: timelineEvents.eventType,
      count: count(),
    })
    .from(timelineEvents)
    .groupBy(timelineEvents.source, timelineEvents.eventType)

  console.log('\nTimeline Events by Source and Type:')
  for (const row of eventCounts) {
    console.log(`  ${row.source}/${row.eventType}: ${row.count}`)
  }

  const linkCounts = await db
    .select({
      entityType: timelineEventLinks.entityType,
      count: count(),
    })
    .from(timelineEventLinks)
    .groupBy(timelineEventLinks.entityType)

  console.log('\nTimeline Event Links by Entity Type:')
  for (const row of linkCounts) {
    console.log(`  ${row.entityType}: ${row.count}`)
  }

  const totalEvents = await db.select({ count: count() }).from(timelineEvents)
  const totalLinks = await db.select({ count: count() }).from(timelineEventLinks)

  console.log(`\nTotals:`)
  console.log(`  Timeline Events: ${totalEvents[0]!.count}`)
  console.log(`  Event Links: ${totalLinks[0]!.count}`)

  console.log('\nDone!')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
