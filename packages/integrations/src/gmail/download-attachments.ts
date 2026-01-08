/**
 * Download Gmail attachments to S3
 * Run with: npx tsx packages/integrations/src/gmail/download-attachments.ts
 */

import { createDb, gmailAccounts, gmailAttachments } from '@mrst/db'
import { eq, sql } from 'drizzle-orm'
import { createGmailClient } from './client'
import { downloadPendingAttachments } from './sync'
import type { GmailSyncContext } from './types'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://mrst:mrst_dev_2025@localhost:5432/mrst'

async function main() {
  console.log('=== Gmail Attachment Download ===\n')

  const db = createDb(DATABASE_URL)

  // Get Gmail accounts
  const accounts = await db
    .select({
      id: gmailAccounts.id,
      emailAddress: gmailAccounts.emailAddress,
      integrationAccountId: gmailAccounts.integrationAccountId,
    })
    .from(gmailAccounts)
    .limit(10)

  console.log(`Found ${accounts.length} Gmail account(s)\n`)

  for (const account of accounts) {
    console.log(`\nProcessing: ${account.emailAddress}`)

    // Check pending count
    const pendingCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(gmailAttachments)
      .where(eq(gmailAttachments.gmailAccountId, account.id))

    const downloadedCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(gmailAttachments)
      .where(
        sql`${gmailAttachments.gmailAccountId} = ${account.id} AND ${gmailAttachments.s3Downloaded} = true`
      )

    const totalAttachments = Number(pendingCount[0]?.count || 0)
    const alreadyDownloaded = Number(downloadedCount[0]?.count || 0)
    const toDownload = totalAttachments - alreadyDownloaded

    console.log(`  Total attachments: ${totalAttachments}`)
    console.log(`  Already downloaded: ${alreadyDownloaded}`)
    console.log(`  Pending download: ${toDownload}`)

    if (toDownload === 0) {
      console.log('  No attachments to download, skipping...')
      continue
    }

    try {
      // Get tenant ID from integration account
      const { integrationAccounts } = await import('@mrst/db')
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

      const client = await createGmailClient({ userEmail: account.emailAddress })

      const ctx: GmailSyncContext = {
        db,
        tenantId,
        integrationAccountId: account.integrationAccountId,
        gmailAccountId: account.id,
        userEmail: account.emailAddress,
        onProgress: (message, counts) => {
          if (counts) {
            console.log(`  ${message}`)
          } else {
            console.log(`  ${message}`)
          }
        },
      }

      // Download attachments in batches
      const result = await downloadPendingAttachments(ctx, client, {
        batchSize: 10,
        maxFiles: 1000, // Process up to 1000 at a time
      })

      console.log(`\n  Results:`)
      console.log(`    Downloaded: ${result.created}`)
      console.log(`    Skipped: ${result.skipped}`)

    } catch (err: any) {
      console.error(`  Error: ${err.message}`)
    }
  }

  console.log('\n\nDownload complete!')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
