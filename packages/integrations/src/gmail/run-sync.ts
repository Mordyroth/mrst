/**
 * Run Gmail sync for known email addresses
 * Bypasses Admin SDK discovery (use when DWD only works for specific domain)
 */

import { createDb, tenants, integrationAccounts } from '@mrst/db'
import { eq, and } from 'drizzle-orm'
import { createGmailClient } from './client'
import { syncGmailAccount, syncAll } from './sync'
import type { GmailSyncContext } from './types'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://mrst:mrst_dev_2025@localhost:5432/mrst'

// Known email addresses to sync (discovered manually or from old system)
const EMAILS_TO_SYNC = [
  'info@travelautorental.com',
  // Add more emails here as domain-wide delegation is configured
]

async function main() {
  console.log('=== Gmail Full Sync ===\n')

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

  // Get or create Gmail integration account
  let accountResult = await db
    .select({ id: integrationAccounts.id })
    .from(integrationAccounts)
    .where(
      and(
        eq(integrationAccounts.tenantId, tenantId),
        eq(integrationAccounts.type, 'gmail')
      )
    )
    .limit(1)

  let integrationAccountId: string

  if (accountResult.length === 0) {
    console.log('Creating Gmail integration account...')
    const [newAccount] = await db
      .insert(integrationAccounts)
      .values({
        tenantId,
        type: 'gmail',
        name: 'Google Workspace',
        isActive: true,
        credentials: {},
        settings: {
          syncScope: ['travelautorental.com'],
        },
      })
      .returning({ id: integrationAccounts.id })
    integrationAccountId = newAccount!.id
    console.log(`Created integration account: ${integrationAccountId}`)
  } else {
    integrationAccountId = accountResult[0]!.id
    console.log(`Using existing integration account: ${integrationAccountId}`)
  }

  console.log(`\nSyncing ${EMAILS_TO_SYNC.length} email account(s)...\n`)

  for (const userEmail of EMAILS_TO_SYNC) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Syncing: ${userEmail}`)
    console.log('='.repeat(60))

    try {
      // Create Gmail client for this user
      const client = await createGmailClient({ userEmail })

      // Verify access
      const profile = await client.gmail.users.getProfile({ userId: 'me' })
      console.log(`Profile verified: ${profile.data.emailAddress}`)
      console.log(`Messages: ${profile.data.messagesTotal}, Threads: ${profile.data.threadsTotal}`)

      // Create or get Gmail account record
      const gmailAccountId = await syncGmailAccount(db, tenantId, integrationAccountId, client)
      console.log(`Gmail account ID: ${gmailAccountId}`)

      // Create sync context
      const ctx: GmailSyncContext = {
        db,
        tenantId,
        integrationAccountId,
        gmailAccountId,
        userEmail,
        onProgress: (message, counts) => {
          if (counts) {
            console.log(`  ${message} (${counts.processed}${counts.total ? `/${counts.total}` : ''})`)
          } else {
            console.log(`  ${message}`)
          }
        },
      }

      // Run full sync for all threads
      const results = await syncAll(ctx, client, { maxThreads: 10000 })

      console.log('\n--- Sync Results ---')
      console.log(`Labels: ${results.labels.created} created, ${results.labels.updated} updated, ${results.labels.skipped} skipped`)
      console.log(`Threads: ${results.threads.created} created, ${results.threads.updated} updated, ${results.threads.skipped} skipped`)
      console.log(`Messages: ${results.messages.created} created, ${results.messages.updated} updated, ${results.messages.skipped} skipped`)

    } catch (error: any) {
      console.error(`\nERROR syncing ${userEmail}:`, error.message)
      if (error.response?.data) {
        console.error('Details:', JSON.stringify(error.response.data))
      }
    }
  }

  console.log('\n\nSync complete!')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
