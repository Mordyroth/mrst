/**
 * Run incremental Gmail sync
 * Run with: npx tsx packages/integrations/src/gmail/sync-incremental.ts
 */

import { createDb, gmailAccounts, integrationAccounts } from '@mrst/db'
import { eq } from 'drizzle-orm'
import { createGmailClient } from './client'
import { syncIncremental } from './sync'
import type { GmailSyncContext } from './types'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://mrst:mrst_dev_2025@localhost:5432/mrst'

async function main() {
  console.log('=== Gmail Incremental Sync ===\n')

  const db = createDb(DATABASE_URL)

  // Get Gmail accounts
  const accounts = await db
    .select({
      id: gmailAccounts.id,
      emailAddress: gmailAccounts.emailAddress,
      integrationAccountId: gmailAccounts.integrationAccountId,
      historyId: gmailAccounts.historyId,
      needsFullResync: gmailAccounts.needsFullResync,
    })
    .from(gmailAccounts)
    .limit(10)

  console.log(`Found ${accounts.length} Gmail account(s)\n`)

  for (const account of accounts) {
    console.log(`\nProcessing: ${account.emailAddress}`)
    console.log(`  Current historyId: ${account.historyId || 'none'}`)
    console.log(`  Needs full resync: ${account.needsFullResync}`)

    // Get tenant ID
    const intAccount = await db
      .select({ tenantId: integrationAccounts.tenantId })
      .from(integrationAccounts)
      .where(eq(integrationAccounts.id, account.integrationAccountId))
      .limit(1)

    const tenantId = intAccount[0]?.tenantId
    if (!tenantId) {
      console.error('  No tenant ID found, skipping...')
      continue
    }

    try {
      const client = await createGmailClient({ userEmail: account.emailAddress })

      // If no historyId, get current one from profile
      if (!account.historyId) {
        console.log('  No historyId, fetching from profile...')
        const profile = await client.gmail.users.getProfile({ userId: 'me' })
        const historyId = profile.data.historyId

        if (historyId) {
          await db
            .update(gmailAccounts)
            .set({ historyId })
            .where(eq(gmailAccounts.id, account.id))
          console.log(`  Set initial historyId: ${historyId}`)
          console.log('  Run again to perform incremental sync')
          continue
        }
      }

      const ctx: GmailSyncContext = {
        db,
        tenantId,
        integrationAccountId: account.integrationAccountId,
        gmailAccountId: account.id,
        userEmail: account.emailAddress,
        onProgress: (message) => {
          console.log(`  ${message}`)
        },
      }

      const result = await syncIncremental(ctx, client)

      console.log('\n  Results:')
      console.log(`    Success: ${result.success}`)
      console.log(`    Messages added: ${result.messagesAdded}`)
      console.log(`    Messages deleted: ${result.messagesDeleted}`)
      console.log(`    Labels changed: ${result.labelsChanged}`)
      console.log(`    New historyId: ${result.historyId}`)
      console.log(`    Needs full resync: ${result.needsFullResync}`)

    } catch (err: any) {
      console.error(`  Error: ${err.message}`)
    }
  }

  console.log('\n\nIncremental sync complete!')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
