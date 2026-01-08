#!/usr/bin/env npx tsx
/**
 * Run Embedding Pipeline
 *
 * Generates embeddings for all data in the database
 *
 * Usage:
 *   VOYAGE_API_KEY=xxx npx tsx packages/ai/src/run-pipeline.ts
 *   GOOGLE_API_KEY=xxx npx tsx packages/ai/src/run-pipeline.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@mrst/db/schema'
import { createEmbeddingsService } from './embeddings'
import { runFullPipeline } from './pipeline'

async function main() {
  // Check for API keys
  const voyageKey = process.env.VOYAGE_API_KEY
  const googleKey = process.env.GOOGLE_API_KEY

  if (!voyageKey && !googleKey) {
    console.error('Error: Set VOYAGE_API_KEY or GOOGLE_API_KEY environment variable')
    console.log('\nUsage:')
    console.log('  VOYAGE_API_KEY=xxx npx tsx packages/ai/src/run-pipeline.ts')
    console.log('  GOOGLE_API_KEY=xxx npx tsx packages/ai/src/run-pipeline.ts')
    process.exit(1)
  }

  console.log('Connecting to database...')
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://mrst:mrst_dev_2025@localhost:5432/mrst',
  })

  const db = drizzle(pool, { schema })

  // Get tenant
  const tenant = await db.query.tenants.findFirst()
  if (!tenant) {
    throw new Error('No tenant found')
  }

  console.log(`Using tenant: ${tenant.name} (${tenant.id})`)
  console.log(`Using embeddings: ${voyageKey ? 'Voyage AI' : 'Google AI'}`)

  // Create embeddings service
  const embeddings = createEmbeddingsService({
    voyageApiKey: voyageKey,
    googleApiKey: googleKey,
  })

  // Run pipeline
  const results = await runFullPipeline({
    db: db as any,
    embeddings,
    tenantId: tenant.id,
    schema: {
      embeddings: schema.embeddings,
      embeddingQueue: schema.embeddingQueue,
      timelineEvents: schema.timelineEvents,
      gmailMessages: schema.gmailMessages,
      coreCustomers: schema.coreCustomers,
      coreVehicles: schema.coreVehicles,
      spireonDevices: schema.spireonDevices,
    },
    batchSize: 25, // Smaller batches for API rate limits
  })

  // Summary
  console.log('\n=== Final Summary ===')
  let totalProcessed = 0
  let totalCreated = 0
  let totalErrors = 0

  for (const [type, stats] of Object.entries(results)) {
    totalProcessed += stats.processed
    totalCreated += stats.created
    totalErrors += stats.errors
  }

  console.log(`Total processed: ${totalProcessed}`)
  console.log(`Total created: ${totalCreated}`)
  console.log(`Total errors: ${totalErrors}`)

  // Check embedding count
  const embeddingCount = await db.select().from(schema.embeddings)
  console.log(`\nTotal embeddings in database: ${embeddingCount.length}`)

  await pool.end()
}

main().catch(console.error)
