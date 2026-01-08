/**
 * Test script for populating core tables from HQ data
 * Run with: npx tsx packages/integrations/src/hq/test-populate.ts
 */

import { createDb, tenants, integrationAccounts, coreCustomers, coreVehicles, externalLinks } from '@mrst/db'
import { eq, count } from 'drizzle-orm'
import * as populate from './populate-core'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://mrst:mrst_dev_2025@localhost:5432/mrst'

async function main() {
  console.log('=== Populate Core Tables from HQ ===\n')

  // Create database connection
  const db = createDb(DATABASE_URL)

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

  // Get HQ integration account
  const integrationAccount = await db
    .select({ id: integrationAccounts.id })
    .from(integrationAccounts)
    .where(eq(integrationAccounts.type, 'hq'))
    .limit(1)

  if (integrationAccount.length === 0) {
    console.error('HQ integration account not found. Run test-sync.ts first.')
    process.exit(1)
  }
  const integrationAccountId = integrationAccount[0]!.id

  console.log(`Tenant ID: ${tenantId}`)
  console.log(`Integration Account ID: ${integrationAccountId}\n`)

  // Create context
  const ctx: populate.PopulateContext = {
    db,
    tenantId,
    integrationAccountId,
    onProgress: (message, counts) => {
      if (counts) {
        console.log(`  ${message} - created: ${counts.created}, skipped: ${counts.skipped}`)
      } else {
        console.log(`  ${message}`)
      }
    },
  }

  // Run population
  console.log('--- Running Population ---')
  const result = await populate.populateAll(ctx)

  console.log('\n--- Results ---')
  console.log(`Customers: ${result.customers.success ? 'SUCCESS' : 'FAILED'}`)
  console.log(`  Created: ${result.customers.created}`)
  console.log(`  Linked to existing: ${result.customers.skipped}`)
  if (result.customers.error) {
    console.log(`  Error: ${result.customers.error}`)
  }

  console.log(`\nVehicles: ${result.vehicles.success ? 'SUCCESS' : 'FAILED'}`)
  console.log(`  Created: ${result.vehicles.created}`)
  console.log(`  Linked to existing: ${result.vehicles.skipped}`)
  if (result.vehicles.error) {
    console.log(`  Error: ${result.vehicles.error}`)
  }

  console.log(`\nStats Update: ${result.stats.success ? 'SUCCESS' : 'FAILED'}`)
  console.log(`  Updated: ${result.stats.updated}`)
  if (result.stats.error) {
    console.log(`  Error: ${result.stats.error}`)
  }

  // Summary from database
  console.log('\n\n=== Database Summary ===')

  const [
    coreCustomerCount,
    coreVehicleCount,
    customerLinkCount,
    vehicleLinkCount,
  ] = await Promise.all([
    db.select({ count: count() }).from(coreCustomers).where(eq(coreCustomers.tenantId, tenantId)),
    db.select({ count: count() }).from(coreVehicles).where(eq(coreVehicles.tenantId, tenantId)),
    db.select({ count: count() }).from(externalLinks).where(eq(externalLinks.entityType, 'customer')),
    db.select({ count: count() }).from(externalLinks).where(eq(externalLinks.entityType, 'vehicle')),
  ])

  console.log(`
  Core Customers:     ${coreCustomerCount[0]!.count}
  Core Vehicles:      ${coreVehicleCount[0]!.count}
  Customer Links:     ${customerLinkCount[0]!.count}
  Vehicle Links:      ${vehicleLinkCount[0]!.count}
`)

  console.log('Population complete!')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
