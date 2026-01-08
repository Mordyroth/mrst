/**
 * Test location polling
 * Run with: DATABASE_URL='postgresql://mrst:mrst_dev_2025@localhost:5432/mrst' npx tsx packages/integrations/src/spireon/test-poll.ts
 */

import { createSpireonClient, loadSpireonConfig } from './client'
import { pollCurrentLocations, backfillLocations, type SpireonSyncConfig } from './sync'
import { createDb } from '@mrst/db'
import * as schema from '@mrst/db/schema'

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required')
  }

  console.log('Connecting to database...')
  const db = createDb(connectionString)

  // Get the Spireon integration account
  console.log('Finding Spireon integration account...')
  const accounts = await db.select()
    .from(schema.integrationAccounts)
    .where(
      require('drizzle-orm').and(
        require('drizzle-orm').eq(schema.integrationAccounts.type, 'spireon'),
        require('drizzle-orm').eq(schema.integrationAccounts.isActive, true)
      )
    )
    .limit(1)

  const account = accounts[0]
  if (!account) {
    throw new Error('No active Spireon integration account found')
  }

  console.log(`Found account: ${account.name} (${account.id})`)

  const credentials = account.credentials as {
    appToken: string
    username: string
    password: string
    nspireId: string
  }

  if (!credentials?.appToken) {
    throw new Error('Spireon credentials not configured in integration account')
  }

  // Create client
  const client = createSpireonClient({
    appToken: credentials.appToken,
    username: credentials.username,
    password: credentials.password,
    nspireId: credentials.nspireId,
  })

  const config: SpireonSyncConfig = {
    db: db as any,
    client,
    integrationAccountId: account.id,
    schema: {
      spireonDevices: schema.spireonDevices,
      spireonLocations: schema.spireonLocations,
      spireonGeofences: schema.spireonGeofences,
      spireonGeofenceEvents: schema.spireonGeofenceEvents,
    },
  }

  // Test location poll
  console.log('\n--- Testing Location Poll ---')
  const pollStats = await pollCurrentLocations(config)
  console.log('Poll results:', pollStats)

  // Check current device locations in database
  const devices = await db.select({
    id: schema.spireonDevices.id,
    name: schema.spireonDevices.name,
    currentLat: schema.spireonDevices.currentLat,
    currentLng: schema.spireonDevices.currentLng,
    currentAddress: schema.spireonDevices.currentAddress,
    currentLocationAt: schema.spireonDevices.currentLocationAt,
    ignitionOn: schema.spireonDevices.ignitionOn,
  })
    .from(schema.spireonDevices)
    .where(require('drizzle-orm').eq(schema.spireonDevices.integrationAccountId, account.id))
    .limit(10)

  console.log('\nSample device locations:')
  for (const device of devices) {
    console.log(`  ${device.name}: (${device.currentLat?.toFixed(4)}, ${device.currentLng?.toFixed(4)}) - ${device.currentAddress || 'No address'} - Ignition: ${device.ignitionOn ? 'ON' : 'OFF'}`)
  }

  // Count locations in database
  const locationCount = await db.select({ count: require('drizzle-orm').count() })
    .from(schema.spireonLocations)
    .where(require('drizzle-orm').eq(schema.spireonLocations.integrationAccountId, account.id))

  console.log(`\nTotal location records: ${locationCount[0]?.count || 0}`)

  console.log('\nDone!')
  process.exit(0)
}

main().catch(console.error)
