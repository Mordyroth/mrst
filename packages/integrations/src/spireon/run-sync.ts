#!/usr/bin/env npx tsx
/**
 * Run Spireon Sync
 *
 * Syncs devices from Spireon to the database
 *
 * Usage:
 *   npx tsx packages/integrations/src/spireon/run-sync.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@mrst/db/schema'
import { createSpireonClient } from './client'
import { syncAll } from './sync'

// Spireon credentials from API_CREDENTIALS.md
const SPIREON_APP_TOKEN = process.env.SPIREON_APP_TOKEN || 'fb086736-9a8b-42f5-85b5-2852bdea37a1'
const SPIREON_USERNAME = process.env.SPIREON_USERNAME || 'Spireonintegration@PlatinumCarRental.com'
const SPIREON_PASSWORD = process.env.SPIREON_PASSWORD || 'TAh!3!Tsw3G!'
const SPIREON_NSPIRE_ID = process.env.SPIREON_NSPIRE_ID || '305091'

async function main() {
  console.log('Connecting to database...')

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://mrst:mrst_dev_2025@localhost:5432/mrst',
  })

  const db = drizzle(pool, { schema })

  // Get or create integration account
  let integrationAccount = await db.query.integrationAccounts.findFirst({
    where: (accounts, { eq }) => eq(accounts.type, 'spireon'),
  })

  if (!integrationAccount) {
    // Get tenant
    const tenant = await db.query.tenants.findFirst()
    if (!tenant) {
      throw new Error('No tenant found')
    }

    // Create integration account
    const [created] = await db.insert(schema.integrationAccounts).values({
      tenantId: tenant.id,
      type: 'spireon',
      name: 'Spireon GPS',
      credentials: {
        nspireId: SPIREON_NSPIRE_ID,
      },
      isActive: true,
    }).returning()

    integrationAccount = created
    console.log('Created integration account:', integrationAccount?.id)
  }

  if (!integrationAccount) {
    throw new Error('Failed to create integration account')
  }

  console.log('Using integration account:', integrationAccount.id)

  // Create Spireon client
  const spireonConfig = {
    appToken: SPIREON_APP_TOKEN,
    username: SPIREON_USERNAME,
    password: SPIREON_PASSWORD,
    nspireId: SPIREON_NSPIRE_ID,
  }

  const client = createSpireonClient(spireonConfig)

  // Run sync
  const stats = await syncAll({
    db: db as any,
    client,
    integrationAccountId: integrationAccount.id,
    schema: {
      spireonDevices: schema.spireonDevices,
      spireonLocations: schema.spireonLocations,
      spireonGeofences: schema.spireonGeofences,
      spireonGeofenceEvents: schema.spireonGeofenceEvents,
    },
  })

  console.log('\n=== Sync Results ===')
  console.log(`Devices created: ${stats.devicesCreated}`)
  console.log(`Devices updated: ${stats.devicesUpdated}`)
  console.log(`Devices unchanged: ${stats.devicesUnchanged}`)
  console.log(`Geofences created: ${stats.geofencesCreated}`)
  console.log(`Geofences updated: ${stats.geofencesUpdated}`)
  console.log(`Errors: ${stats.errors}`)

  // Show summary
  const deviceCount = await db.select().from(schema.spireonDevices)
  console.log(`\nTotal devices in database: ${deviceCount.length}`)

  await pool.end()
}

main().catch(console.error)
