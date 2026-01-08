/**
 * Test script for HQ Rental sync
 * Run with: npx tsx packages/integrations/src/hq/test-sync.ts
 */

import { createDb, hqCustomers, hqVehicles, hqReservations, hqContracts, hqDocuments, integrationAccounts, tenants } from '@mrst/db'
import { eq, count } from 'drizzle-orm'
import { HQClient } from './client'
import * as sync from './sync'

// Configuration
const HQ_TENANT_TOKEN = process.env.HQ_TENANT_TOKEN || 'A50uV6M0jDUcM1ehJsF6kh1YtFfNXkSrDQvqEaJJnPrk3dwFeW'
const HQ_USER_TOKEN = process.env.HQ_USER_TOKEN || 'jLwBdr7fMzbrl54elfwm6Um4DqSYcbxGHhTSmYOI72CrowvUSO'
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://mrst:mrst_dev_2025@localhost:5432/mrst'

async function main() {
  console.log('=== HQ Rental Sync Test ===\n')

  // Create HQ client
  const client = new HQClient({
    tenantToken: HQ_TENANT_TOKEN,
    userToken: HQ_USER_TOKEN,
  })

  // Create database connection
  const db = createDb(DATABASE_URL)

  // Test API connection
  console.log('Testing API connection...')
  const connectionTest = await client.testConnection()

  if (!connectionTest.success) {
    console.error('Failed to connect to HQ API')
    process.exit(1)
  }

  console.log(`Connected! Total reservations in HQ: ${connectionTest.total}\n`)

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
  const tenantId = tenantResult[0]!.id

  // Check if HQ integration already exists
  let integrationAccount = await db
    .select({ id: integrationAccounts.id })
    .from(integrationAccounts)
    .where(eq(integrationAccounts.type, 'hq'))
    .limit(1)

  let integrationAccountId: string

  if (integrationAccount.length === 0) {
    // Create integration account
    const result = await db
      .insert(integrationAccounts)
      .values({
        tenantId,
        type: 'hq',
        name: 'HQ Rental Software',
        credentials: {
          tenantToken: HQ_TENANT_TOKEN,
          userToken: HQ_USER_TOKEN,
          baseUrl: 'https://api-america-3.caagcrm.com/api-america-3'
        },
        settings: {},
        isActive: true,
      })
      .returning({ id: integrationAccounts.id })
    integrationAccountId = result[0]!.id
    console.log(`Created integration account: ${integrationAccountId}`)
  } else {
    integrationAccountId = integrationAccount[0]!.id
    console.log(`Using existing integration account: ${integrationAccountId}`)
  }

  // Create sync context
  const ctx: sync.HQSyncContext = {
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

  // Test fetching a single reservation first
  console.log('\n--- Testing Single Reservation Fetch ---')
  try {
    const reservations = await client.getReservations({ perPage: 1 })
    if (reservations.data.length > 0) {
      const firstRes = reservations.data[0]!
      console.log(`First reservation: #${firstRes.id} - Status: ${firstRes.status}`)

      // Fetch full details
      const details = await client.getReservation(firstRes.id)
      console.log(`Customer: ${details.customer?.label || 'N/A'}`)
      console.log(`Vehicles: ${details.vehicles?.length || 0}`)
      if (details.vehicles?.[0]?.vehicle) {
        console.log(`  First vehicle: ${details.vehicles[0].vehicle.label}`)
      }
    }
  } catch (error) {
    console.error('Error fetching reservation:', error)
  }

  // Check for FULL_SYNC env var
  const maxReservations = process.env.FULL_SYNC ? undefined : 50
  const syncLabel = maxReservations ? `(${maxReservations} reservations)` : '(ALL reservations)'

  console.log(`\n--- Running Sync ${syncLabel} ---`)
  const result = await sync.syncAll(ctx, {
    maxReservations,
    batchSize: 10,
  })

  console.log('\n--- Sync Results ---')
  console.log(`Reservations: ${result.reservations.success ? 'SUCCESS' : 'FAILED'}`)
  console.log(`  Processed: ${result.reservations.counts.processed}`)
  console.log(`  Created: ${result.reservations.counts.created}`)
  console.log(`  Updated: ${result.reservations.counts.updated}`)
  console.log(`  Unchanged: ${result.reservations.counts.unchanged}`)
  if (result.reservations.error) {
    console.log(`  Error: ${result.reservations.error}`)
  }

  console.log(`\nCustomers: ${result.customers.success ? 'SUCCESS' : 'FAILED'}`)
  console.log(`  Processed: ${result.customers.counts.processed}`)
  console.log(`  Created: ${result.customers.counts.created}`)

  console.log(`\nVehicles: ${result.vehicles.success ? 'SUCCESS' : 'FAILED'}`)
  console.log(`  Processed: ${result.vehicles.counts.processed}`)
  console.log(`  Created: ${result.vehicles.counts.created}`)

  console.log(`\nDocuments: ${result.documents.success ? 'SUCCESS' : 'FAILED'}`)
  console.log(`  Processed: ${result.documents.counts.processed}`)
  console.log(`  Created: ${result.documents.counts.created}`)

  // Summary from database
  console.log('\n\n=== Database Summary ===')

  const [
    customerCount,
    vehicleCount,
    reservationCount,
    contractCount,
    documentCount,
  ] = await Promise.all([
    db.select({ count: count() }).from(hqCustomers).where(eq(hqCustomers.integrationAccountId, integrationAccountId)),
    db.select({ count: count() }).from(hqVehicles).where(eq(hqVehicles.integrationAccountId, integrationAccountId)),
    db.select({ count: count() }).from(hqReservations).where(eq(hqReservations.integrationAccountId, integrationAccountId)),
    db.select({ count: count() }).from(hqContracts).where(eq(hqContracts.integrationAccountId, integrationAccountId)),
    db.select({ count: count() }).from(hqDocuments).where(eq(hqDocuments.integrationAccountId, integrationAccountId)),
  ])

  console.log(`
  Customers:     ${customerCount[0]!.count}
  Vehicles:      ${vehicleCount[0]!.count}
  Reservations:  ${reservationCount[0]!.count}
  Contracts:     ${contractCount[0]!.count}
  Documents:     ${documentCount[0]!.count}
`)

  console.log('\nSync test complete!')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
