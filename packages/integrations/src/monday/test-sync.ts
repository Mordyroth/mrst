/**
 * Test script for Monday.com sync
 * Run with: npx tsx packages/integrations/src/monday/test-sync.ts
 */

import { createDb, mondayWorkspaces, mondayBoards, mondayColumns, mondayGroups, mondayItems, mondayItemColumnValues, mondayUpdates, mondayReplies, mondayActivityLogs, mondayUsers, mondayFiles, integrationAccounts, tenants } from '@mrst/db'
import { eq, count, desc } from 'drizzle-orm'
import { MondayClient } from './client'
import * as sync from './sync'

// Configuration
const MONDAY_API_KEY = process.env.MONDAY_API_KEY || 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjU5MjQ5NjY1NywiYWFpIjoxMSwidWlkIjoyMTc4NTQ0OCwiaWFkIjoiMjAyNS0xMi0wMVQxODo1Njo0MS4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6ODYyOTAwOCwicmduIjoidXNlMSJ9.dvyYqMXj7yxTyLdEtqe0QJR_Bk61heKKX1nQ5Bg8vmU'
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://mrst:mrst_dev_2025@localhost:5432/mrst'

async function main() {
  console.log('=== Monday.com Sync Test ===\n')

  // Create Monday client
  const client = new MondayClient({ apiKey: MONDAY_API_KEY })

  // Create database connection using @mrst/db
  const db = createDb(DATABASE_URL)

  // First, verify API connection
  console.log('Testing API connection...')
  const accountInfo = await sync.getAccountInfo({
    db,
    client,
    integrationAccountId: '',
    tenantId: '',
  })

  if (!accountInfo) {
    console.error('Failed to connect to Monday.com API')
    process.exit(1)
  }

  console.log(`Connected as: ${accountInfo.name} (${accountInfo.email})\n`)

  // Get or create integration account
  console.log('Setting up integration account...')

  // Get tenant ID
  const tenantResult = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, 'travel-auto'))
    .limit(1)

  if (tenantResult.length === 0) {
    console.error('Tenant not found. Run db:seed first.')
    process.exit(1)
  }
  const tenantId = tenantResult[0].id

  // Check if Monday integration already exists
  let integrationAccount = await db
    .select({ id: integrationAccounts.id })
    .from(integrationAccounts)
    .where(eq(integrationAccounts.tenantId, tenantId))
    .limit(1)

  let integrationAccountId: string

  if (integrationAccount.length === 0) {
    // Create integration account
    const result = await db
      .insert(integrationAccounts)
      .values({
        tenantId,
        type: 'monday',
        name: 'Monday.com',
        credentials: { apiKey: MONDAY_API_KEY },
        settings: {},
        isActive: true,
      })
      .returning({ id: integrationAccounts.id })
    integrationAccountId = result[0].id
    console.log(`Created integration account: ${integrationAccountId}`)
  } else {
    integrationAccountId = integrationAccount[0].id
    console.log(`Using existing integration account: ${integrationAccountId}`)
  }

  // Create sync context
  const ctx: sync.SyncContext = {
    db,
    client,
    integrationAccountId,
    tenantId,
    onProgress: (message, counts) => {
      if (counts) {
        console.log(`  ${message} - created: ${counts.created}, updated: ${counts.updated}, unchanged: ${counts.unchanged}`)
      } else {
        console.log(`  ${message}`)
      }
    },
  }

  // Sync workspaces
  console.log('\n--- Syncing Workspaces ---')
  const workspaceResult = await sync.syncWorkspaces(ctx)
  console.log(`Workspaces: ${workspaceResult.success ? 'SUCCESS' : 'FAILED'}`)
  if (!workspaceResult.success) {
    console.error(`Error: ${workspaceResult.error}`)
  }

  // Sync all boards
  console.log('\n--- Syncing All Boards ---')
  const allBoardsResult = await sync.syncBoards(ctx, { markInScope: false })
  console.log(`All Boards: ${allBoardsResult.success ? 'SUCCESS' : 'FAILED'}`)

  // Sync users
  console.log('\n--- Syncing Users ---')
  const usersResult = await sync.syncUsers(ctx)
  console.log(`Users: ${usersResult.success ? 'SUCCESS' : 'FAILED'}`)

  // Get top 5 boards by items_count to sync fully
  const topBoards = await db
    .select({ id: mondayBoards.id, externalId: mondayBoards.externalId, name: mondayBoards.name, itemsCount: mondayBoards.itemsCount })
    .from(mondayBoards)
    .where(eq(mondayBoards.integrationAccountId, integrationAccountId))
    .orderBy(desc(mondayBoards.itemsCount))
    .limit(5)

  // Mark these boards as in-scope
  console.log('\n--- Marking Top 5 Boards as In-Scope ---')
  for (const board of topBoards) {
    await db
      .update(mondayBoards)
      .set({ inScope: true })
      .where(eq(mondayBoards.id, board.id))
    console.log(`  Marked: ${board.name} (${board.itemsCount || 0} items)`)
  }

  // Sync schema and items for each in-scope board
  console.log('\n--- Syncing Board Data (Schema, Items, Activity) ---')
  console.log(`Syncing ${topBoards.length} boards...\n`)

  for (const board of topBoards) {
    console.log(`\nBoard: ${board.name} (${board.externalId})`)

    const fullResult = await sync.syncFullBoard(ctx, board.externalId, {
      syncActivity: true,
      activityFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      trackValueChanges: true,
    })

    console.log(`  Schema: ${fullResult.schema.success ? 'OK' : 'FAILED'} (${fullResult.schema.counts.created} columns/groups)`)
    console.log(`  Items: ${fullResult.items.success ? 'OK' : 'FAILED'} (${fullResult.items.counts.processed} items)`)
    if (fullResult.activity) {
      console.log(`  Activity: ${fullResult.activity.success ? 'OK' : 'FAILED'} (${fullResult.activity.counts.processed} logs)`)
    }
  }

  // Summary
  console.log('\n\n=== Sync Summary ===')

  const [
    workspaceCount,
    boardCount,
    inScopeBoardCount,
    columnCount,
    groupCount,
    itemCount,
    columnValueCount,
    updateCount,
    replyCount,
    activityCount,
    userCount,
    fileCount,
  ] = await Promise.all([
    db.select({ count: count() }).from(mondayWorkspaces).where(eq(mondayWorkspaces.integrationAccountId, integrationAccountId)),
    db.select({ count: count() }).from(mondayBoards).where(eq(mondayBoards.integrationAccountId, integrationAccountId)),
    db.select({ count: count() }).from(mondayBoards).where(eq(mondayBoards.inScope, true)),
    db.select({ count: count() }).from(mondayColumns).where(eq(mondayColumns.integrationAccountId, integrationAccountId)),
    db.select({ count: count() }).from(mondayGroups).where(eq(mondayGroups.integrationAccountId, integrationAccountId)),
    db.select({ count: count() }).from(mondayItems).where(eq(mondayItems.integrationAccountId, integrationAccountId)),
    db.select({ count: count() }).from(mondayItemColumnValues).where(eq(mondayItemColumnValues.integrationAccountId, integrationAccountId)),
    db.select({ count: count() }).from(mondayUpdates).where(eq(mondayUpdates.integrationAccountId, integrationAccountId)),
    db.select({ count: count() }).from(mondayReplies).where(eq(mondayReplies.integrationAccountId, integrationAccountId)),
    db.select({ count: count() }).from(mondayActivityLogs).where(eq(mondayActivityLogs.integrationAccountId, integrationAccountId)),
    db.select({ count: count() }).from(mondayUsers).where(eq(mondayUsers.integrationAccountId, integrationAccountId)),
    db.select({ count: count() }).from(mondayFiles).where(eq(mondayFiles.integrationAccountId, integrationAccountId)),
  ])

  console.log(`
  Workspaces:      ${workspaceCount[0].count}
  Boards:          ${boardCount[0].count} (${inScopeBoardCount[0].count} in scope)
  Columns:         ${columnCount[0].count}
  Groups:          ${groupCount[0].count}
  Items:           ${itemCount[0].count}
  Column Values:   ${columnValueCount[0].count}
  Updates:         ${updateCount[0].count}
  Replies:         ${replyCount[0].count}
  Activity Logs:   ${activityCount[0].count}
  Users:           ${userCount[0].count}
  Files:           ${fileCount[0].count}
`)

  console.log('\nSync test complete!')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
