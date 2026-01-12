#!/usr/bin/env npx tsx
/**
 * Run extended HQ sync - syncs all tables including new ones
 */

import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { eq } from 'drizzle-orm'
import * as schema from '@mrst/db'
import { HQClient } from './client'
import { syncAllExtended, syncFleetVehicles, type HQSyncContext } from './sync'

async function main() {
  console.log('Starting extended HQ sync...\n')

  // Database connection
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://mrst:mrst_dev_2025@localhost:5432/mrst',
  })

  const db = drizzle(pool, { schema })

  // Find HQ integration account
  const accounts = await db
    .select()
    .from(schema.integrationAccounts)
    .where(eq(schema.integrationAccounts.type, 'hq'))
    .limit(1)

  const account = accounts[0]
  if (!account) {
    console.error('No HQ integration account found!')
    process.exit(1)
  }

  console.log(`Found HQ account: ${account.id}`)
  console.log(`Tenant: ${account.tenantId}\n`)

  // Get credentials from env or account
  const tenantToken = process.env.HQ_TENANT_TOKEN || 'A50uV6M0jDUcM1ehJsF6kh1YtFfNXkSrDQvqEaJJnPrk3dwFeW'
  const userToken = process.env.HQ_USER_TOKEN || 'jLwBdr7fMzbrl54elfwm6Um4DqSYcbxGHhTSmYOI72CrowvUSO'

  // Create HQ client
  const client = new HQClient({
    tenantToken,
    userToken,
  })

  // Test connection
  console.log('Testing HQ API connection...')
  const connectionTest = await client.testConnection()
  if (!connectionTest.success) {
    console.error('HQ API connection failed!')
    process.exit(1)
  }
  console.log(`✓ Connected! Found ${connectionTest.total} reservations\n`)

  // Create sync context
  const ctx: HQSyncContext = {
    db: db as any,
    client,
    integrationAccountId: account.id,
    tenantId: account.tenantId,
    onProgress: (message, counts) => {
      if (counts) {
        console.log(`${message} (processed: ${counts.processed}, created: ${counts.created}, errors: ${counts.errored})`)
      } else {
        console.log(message)
      }
    },
  }

  // Run extended sync (skip reservations for speed, they're already synced)
  console.log('\n=== Running Extended HQ Sync ===\n')
  const startTime = Date.now()

  const results = await syncAllExtended(ctx, { skipReservations: true })

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n=== Extended Sync Complete (${duration}s) ===\n`)

  // Print summary
  console.log('Summary:')
  console.log('--------')
  console.log(`Fleet Vehicles: ${results.vehicles.counts.created} synced`)
  console.log(`Rates: ${results.rates.counts.created} synced`)
  console.log(`Rate Types: ${results.rateTypes.counts.created} synced`)
  console.log(`Additional Charges: ${results.additionalCharges.counts.created} synced`)
  console.log(`Locations: ${results.locations.counts.created} synced`)
  console.log(`Branches: ${results.branches.counts.created} synced`)
  console.log(`Vehicle Classes: ${results.vehicleClasses.counts.created} synced`)
  console.log(`Vehicle Models: ${results.vehicleModels.counts.created} synced`)
  console.log(`Damages: ${results.damages.counts.created} synced`)
  console.log(`Repair Orders: ${results.repairOrders.counts.created} synced`)
  console.log(`Fines: ${results.fines.counts.created} synced`)
  console.log(`Email Templates: ${results.emailTemplates.counts.created} synced`)
  console.log(`Payment Methods: ${results.paymentMethods.counts.created} synced`)
  console.log(`Custom Fields: ${results.customFields.counts.created} synced`)
  console.log(`Security Deposits: ${results.securityDeposits.counts.created} synced`)

  // Check for errors
  const errorSyncs = Object.entries(results)
    .filter(([_, result]) => result && !result.success)
    .map(([name, result]) => `${name}: ${result?.error}`)

  if (errorSyncs.length > 0) {
    console.log('\nErrors:')
    errorSyncs.forEach(e => console.log(`  - ${e}`))
  }

  await pool.end()
  console.log('\nDone!')
}

main().catch(console.error)
