/**
 * Sync Travel Auto Rental Fleet board from Monday.com
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../packages/db/src/schema/index.js'

const FLEET_BOARD_ID = '3597643013'
const INTEGRATION_ACCOUNT_ID = 'bed3d545-3f72-4458-be33-6902247ddacf'

async function main() {
  // Connect to database
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL not set')
  }

  const client = postgres(connectionString)
  const db = drizzle(client, { schema })

  // Import sync functions
  const { MondayClient } = await import('../packages/integrations/src/monday/client.js')
  const { syncFullBoard } = await import('../packages/integrations/src/monday/sync.js')

  // Get credentials
  const accountResult = await db
    .select({ credentials: schema.integrationAccounts.credentials, tenantId: schema.integrationAccounts.tenantId })
    .from(schema.integrationAccounts)
    .where(db.$eq(schema.integrationAccounts.id, INTEGRATION_ACCOUNT_ID))
    .limit(1)

  if (accountResult.length === 0) {
    throw new Error('Integration account not found')
  }

  const { credentials, tenantId } = accountResult[0]
  const apiToken = credentials?.apiToken || credentials?.api_token

  if (!apiToken) {
    throw new Error('No API token found')
  }

  console.log('Creating Monday.com client...')
  const mondayClient = new MondayClient(apiToken)

  const ctx = {
    db,
    client: mondayClient,
    integrationAccountId: INTEGRATION_ACCOUNT_ID,
    tenantId,
    onProgress: (msg, counts) => console.log(msg, counts ? JSON.stringify(counts) : ''),
  }

  console.log(`Syncing board ${FLEET_BOARD_ID}...`)
  const result = await syncFullBoard(ctx, FLEET_BOARD_ID, {
    syncActivity: false,
    trackValueChanges: false,
  })

  console.log('Schema sync:', result.schema)
  console.log('Items sync:', result.items)

  await client.end()
  console.log('Done!')
}

main().catch(console.error)
