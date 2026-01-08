/**
 * Test script for Gmail sync
 * Run with: npx tsx packages/integrations/src/gmail/test-sync.ts
 */

import { createDb, tenants, integrationAccounts } from '@mrst/db'
import { eq } from 'drizzle-orm'
import {
  SERVICE_ACCOUNT_PATH,
  DOMAINS_TO_SYNC,
  discoverAllMailboxes,
  createGmailClient,
} from './client'
import { syncGmailAccount, syncAll } from './sync'
import type { GmailSyncContext } from './types'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://mrst:mrst_dev_2025@localhost:5432/mrst'

// Admin emails for domain-wide delegation (must be a super admin per domain)
const DOMAIN_ADMINS: Record<string, string> = {
  'travelautorental.com': 'info@travelautorental.com',
  'certifiedautocollision.com': 'claims@certifiedautocollision.com',
}

async function main() {
  console.log('=== Gmail Sync Test ===\n')

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
    .where(eq(integrationAccounts.type, 'gmail'))
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
        credentials: {
          serviceAccountPath: SERVICE_ACCOUNT_PATH,
          domainAdmins: DOMAIN_ADMINS,
        },
        settings: {
          syncScope: DOMAINS_TO_SYNC,
        },
      })
      .returning({ id: integrationAccounts.id })
    integrationAccountId = newAccount!.id
    console.log(`Created integration account: ${integrationAccountId}`)
  } else {
    integrationAccountId = accountResult[0]!.id
    console.log(`Using existing integration account: ${integrationAccountId}`)
  }

  // Discover mailboxes
  console.log('\n--- Discovering Mailboxes ---')
  console.log(`Domain admins:`)
  for (const [domain, admin] of Object.entries(DOMAIN_ADMINS)) {
    console.log(`  ${domain}: ${admin}`)
  }

  try {
    const mailboxes = await discoverAllMailboxes(DOMAIN_ADMINS, SERVICE_ACCOUNT_PATH, DOMAINS_TO_SYNC)

    let totalUsers = 0
    for (const { domain, emails } of mailboxes) {
      console.log(`\n${domain}: ${emails.length} users`)
      for (const email of emails.slice(0, 5)) {
        console.log(`  - ${email}`)
      }
      if (emails.length > 5) {
        console.log(`  ... and ${emails.length - 5} more`)
      }
      totalUsers += emails.length
    }

    console.log(`\nTotal mailboxes to sync: ${totalUsers}`)

    // Sync first mailbox as a test
    const allEmails = mailboxes.flatMap(m => m.emails)
    if (allEmails.length > 0) {
      const testEmail = allEmails[0]!
      console.log(`\n--- Testing sync for ${testEmail} ---`)

      // Create Gmail client for this user
      const client = await createGmailClient({ userEmail: testEmail })

      // Create or get Gmail account record
      const gmailAccountId = await syncGmailAccount(db, tenantId, integrationAccountId, client)
      console.log(`Gmail account ID: ${gmailAccountId}`)

      // Create sync context
      const ctx: GmailSyncContext = {
        db,
        tenantId,
        integrationAccountId,
        gmailAccountId,
        userEmail: testEmail,
        onProgress: (message, counts) => {
          if (counts) {
            console.log(`  ${message} (${counts.processed}${counts.total ? `/${counts.total}` : ''})`)
          } else {
            console.log(`  ${message}`)
          }
        },
      }

      // Run sync (limit threads for test)
      const results = await syncAll(ctx, client, { maxThreads: 50 })

      console.log('\n--- Sync Results ---')
      console.log(`Labels: ${results.labels.created} created, ${results.labels.updated} updated, ${results.labels.skipped} skipped`)
      console.log(`Threads: ${results.threads.created} created, ${results.threads.updated} updated, ${results.threads.skipped} skipped`)
      console.log(`Messages: ${results.messages.created} created, ${results.messages.updated} updated, ${results.messages.skipped} skipped`)
    }
  } catch (error) {
    console.error('Error during discovery/sync:', error)

    // If Admin SDK fails, try a direct test with a known email
    console.log('\n--- Attempting direct sync test ---')
    const testEmail = 'info@travelautorental.com'
    console.log(`Testing with: ${testEmail}`)

    try {
      const client = await createGmailClient({ userEmail: testEmail })
      const profile = await client.gmail.users.getProfile({ userId: 'me' })
      console.log(`Profile: ${profile.data.emailAddress}`)
      console.log(`Total messages: ${profile.data.messagesTotal}`)
      console.log(`Total threads: ${profile.data.threadsTotal}`)
    } catch (gmailError) {
      console.error('Direct Gmail access also failed:', gmailError)
    }
  }

  console.log('\nDone!')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
