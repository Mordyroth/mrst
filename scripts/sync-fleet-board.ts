/**
 * Sync Travel Auto Rental Fleet board from Monday.com
 * Run with: npx tsx scripts/sync-fleet-board.ts
 */

import { createDb, mondayBoards, integrationAccounts } from '@mrst/db'
import { eq } from 'drizzle-orm'
import { MondayClient } from '../packages/integrations/src/monday/client'
import * as sync from '../packages/integrations/src/monday/sync'

const FLEET_BOARD_EXTERNAL_ID = '3597643013'

async function main() {
  console.log('=== Sync Travel Auto Rental Fleet Board ===\n')

  const db = createDb(process.env.DATABASE_URL!)

  // Get integration account
  const accountResult = await db
    .select({
      id: integrationAccounts.id,
      tenantId: integrationAccounts.tenantId,
      credentials: integrationAccounts.credentials,
    })
    .from(integrationAccounts)
    .where(eq(integrationAccounts.type, 'monday'))
    .limit(1)

  if (accountResult.length === 0) {
    throw new Error('Monday integration account not found')
  }

  const { id: integrationAccountId, tenantId, credentials } = accountResult[0]

  // Parse credentials (may be double-serialized)
  let creds = credentials
  if (typeof creds === 'string') {
    creds = JSON.parse(creds)
  }
  const apiToken = (creds as Record<string, string>)?.apiKey || (creds as Record<string, string>)?.apiToken || (creds as Record<string, string>)?.api_token

  if (!apiToken) {
    console.log('Credentials:', creds)
    throw new Error('No API token found')
  }

  console.log(`Integration Account: ${integrationAccountId}`)
  console.log(`Tenant: ${tenantId}`)

  // Create Monday client
  const client = new MondayClient({ apiKey: apiToken })

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

  // First, ensure the board is synced
  console.log('\n--- Syncing Board Metadata ---')
  const boardsResult = await sync.syncBoards(ctx, { boardIds: [FLEET_BOARD_EXTERNAL_ID], markInScope: true })
  console.log(`Boards: ${boardsResult.success ? 'SUCCESS' : 'FAILED'}`)

  // Now sync the full board
  console.log(`\n--- Syncing Board ${FLEET_BOARD_EXTERNAL_ID} ---`)
  const fullResult = await sync.syncFullBoard(ctx, FLEET_BOARD_EXTERNAL_ID, {
    syncActivity: false,
    trackValueChanges: false,
  })

  console.log(`Schema: ${fullResult.schema.success ? 'OK' : 'FAILED'}`)
  if (fullResult.schema.counts) {
    console.log(`  Columns/Groups: ${fullResult.schema.counts.created} created, ${fullResult.schema.counts.updated} updated`)
  }

  console.log(`Items: ${fullResult.items.success ? 'OK' : 'FAILED'}`)
  if (fullResult.items.counts) {
    console.log(`  Items: ${fullResult.items.counts.created} created, ${fullResult.items.counts.updated} updated, ${fullResult.items.counts.unchanged} unchanged`)
  }

  // Check what we got
  const board = await db
    .select({ id: mondayBoards.id, name: mondayBoards.name, itemsCount: mondayBoards.itemsCount })
    .from(mondayBoards)
    .where(eq(mondayBoards.externalId, FLEET_BOARD_EXTERNAL_ID))
    .limit(1)

  if (board.length > 0) {
    console.log(`\nBoard: ${board[0].name}`)
    console.log(`Items count: ${board[0].itemsCount}`)
  }

  console.log('\nDone!')
  process.exit(0)
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
