/**
 * Embedding Pipeline
 *
 * Processes content from various sources and generates embeddings
 * for semantic search.
 */

import * as crypto from 'crypto'
import { eq, and, isNull, sql } from 'drizzle-orm'
import type { EmbeddingsService } from './embeddings'

// Source type definitions
export type EmbeddingSourceType =
  | 'timeline_event'
  | 'gmail_message'
  | 'monday_item'
  | 'hq_reservation'
  | 'core_customer'
  | 'core_vehicle'
  | 'spireon_device'

interface ContentExtractor<T> {
  sourceType: EmbeddingSourceType
  extractContent: (record: T) => string
  extractMetadata: (record: T) => Record<string, unknown>
}

interface DrizzleDB {
  select: (fields?: unknown) => any
  insert: (table: any) => any
  update: (table: any) => any
  delete: (table: any) => any
  query: any
  execute: (query: any) => any
}

interface PipelineConfig {
  db: DrizzleDB
  embeddings: EmbeddingsService
  tenantId: string
  schema: {
    embeddings: any
    embeddingQueue: any
    timelineEvents?: any
    gmailMessages?: any
    mondayItems?: any
    hqReservations?: any
    coreCustomers?: any
    coreVehicles?: any
    spireonDevices?: any
  }
  batchSize?: number
}

interface PipelineStats {
  processed: number
  created: number
  updated: number
  skipped: number
  errors: number
}

/**
 * Generate content hash for change detection
 */
function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

/**
 * Timeline Event Content Extractor
 */
const timelineEventExtractor: ContentExtractor<any> = {
  sourceType: 'timeline_event',
  extractContent: (event) => {
    const parts = [
      event.eventType,
      event.title,
      event.description,
      event.metadata?.subject,
      event.metadata?.body_snippet,
      event.metadata?.from_email,
      event.metadata?.to_email,
    ].filter(Boolean)
    return parts.join(' | ')
  },
  extractMetadata: (event) => ({
    eventType: event.eventType,
    source: event.source,
    customerIds: event.customerIds || [],
    vehicleIds: event.vehicleIds || [],
    date: event.occurredAt?.toISOString?.() || event.occurredAt,
  }),
}

/**
 * Gmail Message Content Extractor
 */
const gmailMessageExtractor: ContentExtractor<any> = {
  sourceType: 'gmail_message',
  extractContent: (message) => {
    const parts = [
      message.subject,
      message.snippet,
      message.fromEmail,
      message.toEmail,
      message.bodyText?.substring(0, 5000), // Limit body length
    ].filter(Boolean)
    return parts.join(' | ')
  },
  extractMetadata: (message) => ({
    threadId: message.threadId,
    fromEmail: message.fromEmail,
    toEmail: message.toEmail,
    date: message.receivedAt?.toISOString?.() || message.receivedAt,
  }),
}

/**
 * Monday Item Content Extractor
 */
const mondayItemExtractor: ContentExtractor<any> = {
  sourceType: 'monday_item',
  extractContent: (item) => {
    const parts = [item.name]

    // Add column values if available
    if (item.columnValues && Array.isArray(item.columnValues)) {
      for (const cv of item.columnValues) {
        if (cv.displayValue || cv.textValue) {
          parts.push(`${cv.columnTitle || cv.columnId}: ${cv.displayValue || cv.textValue}`)
        }
      }
    }

    return parts.join(' | ')
  },
  extractMetadata: (item) => ({
    boardId: item.boardId,
    groupId: item.groupId,
  }),
}

/**
 * HQ Reservation Content Extractor
 */
const hqReservationExtractor: ContentExtractor<any> = {
  sourceType: 'hq_reservation',
  extractContent: (reservation) => {
    const parts = [
      `Reservation ${reservation.externalId}`,
      reservation.status,
      reservation.customerName,
      reservation.vehicleDescription,
      reservation.pickupLocation,
      reservation.returnLocation,
    ].filter(Boolean)
    return parts.join(' | ')
  },
  extractMetadata: (reservation) => ({
    customerId: reservation.customerId,
    vehicleId: reservation.vehicleId,
    status: reservation.status,
    date: reservation.pickupDate?.toISOString?.() || reservation.pickupDate,
  }),
}

/**
 * Core Customer Content Extractor
 */
const coreCustomerExtractor: ContentExtractor<any> = {
  sourceType: 'core_customer',
  extractContent: (customer) => {
    const parts = [
      customer.displayName,
      customer.email,
      customer.phone,
      customer.company,
      customer.address,
      customer.city,
      customer.state,
    ].filter(Boolean)
    return parts.join(' | ')
  },
  extractMetadata: (customer) => ({
    email: customer.email,
    phone: customer.phone,
  }),
}

/**
 * Core Vehicle Content Extractor
 */
const coreVehicleExtractor: ContentExtractor<any> = {
  sourceType: 'core_vehicle',
  extractContent: (vehicle) => {
    const parts = [
      vehicle.displayName,
      vehicle.vin,
      vehicle.licensePlate,
      `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      vehicle.color,
      vehicle.status,
    ].filter(Boolean)
    return parts.join(' | ')
  },
  extractMetadata: (vehicle) => ({
    vin: vehicle.vin,
    licensePlate: vehicle.licensePlate,
    status: vehicle.status,
  }),
}

/**
 * Spireon Device Content Extractor
 */
const spireonDeviceExtractor: ContentExtractor<any> = {
  sourceType: 'spireon_device',
  extractContent: (device) => {
    const parts = [
      device.name,
      device.vehicleVin,
      device.vehicleLicensePlate,
      `${device.vehicleYear} ${device.vehicleMake} ${device.vehicleModel}`,
      device.currentAddress,
      device.status,
    ].filter(Boolean)
    return parts.join(' | ')
  },
  extractMetadata: (device) => ({
    vehicleVin: device.vehicleVin,
    status: device.status,
  }),
}

/**
 * Process a batch of records and generate embeddings
 */
async function processBatch<T>(
  config: PipelineConfig,
  records: T[],
  extractor: ContentExtractor<T>,
  stats: PipelineStats
): Promise<void> {
  const { db, embeddings, tenantId, schema } = config

  // Extract content and prepare for embedding
  const contents: string[] = []
  const recordMap: Map<number, T> = new Map()

  for (let i = 0; i < records.length; i++) {
    const record = records[i]
    if (!record) continue
    const content = extractor.extractContent(record)
    if (content && content.length > 10) {
      contents.push(content)
      recordMap.set(contents.length - 1, record)
    } else {
      stats.skipped++
    }
  }

  if (contents.length === 0) return

  // Generate embeddings in batch
  let embeddingResults
  try {
    embeddingResults = await embeddings.embedBatch(contents)
  } catch (error) {
    console.error('Error generating embeddings:', error)
    stats.errors += contents.length
    return
  }

  // Store embeddings
  for (let i = 0; i < embeddingResults.length; i++) {
    const result = embeddingResults[i]
    const record = recordMap.get(i)
    if (!result || !record) continue

    const content = contents[i]
    if (!content) continue
    const contentHash = hashContent(content)
    const recordId = (record as any).id

    try {
      // Check if embedding exists
      const existing = await db.query.embeddings.findFirst({
        where: and(
          eq(schema.embeddings.sourceType, extractor.sourceType),
          eq(schema.embeddings.sourceId, recordId)
        ),
      })

      if (existing) {
        // Check if content changed
        if (existing.contentHash === contentHash) {
          stats.skipped++
          continue
        }

        // Update existing
        await db.update(schema.embeddings)
          .set({
            content,
            contentHash,
            embedding: JSON.stringify(result.embedding),
            embeddingModel: result.model,
            embeddingDimensions: result.dimensions,
            metadata: extractor.extractMetadata(record),
            updatedAt: new Date(),
          })
          .where(eq(schema.embeddings.id, existing.id))

        stats.updated++
      } else {
        // Create new
        await db.insert(schema.embeddings).values({
          tenantId,
          sourceType: extractor.sourceType,
          sourceId: recordId,
          content,
          contentHash,
          embedding: JSON.stringify(result.embedding),
          embeddingModel: result.model,
          embeddingDimensions: result.dimensions,
          metadata: extractor.extractMetadata(record),
        })

        stats.created++
      }

      stats.processed++
    } catch (error) {
      console.error(`Error storing embedding for ${extractor.sourceType}/${recordId}:`, error)
      stats.errors++
    }
  }
}

/**
 * Embed all timeline events
 */
export async function embedTimelineEvents(config: PipelineConfig): Promise<PipelineStats> {
  const stats: PipelineStats = { processed: 0, created: 0, updated: 0, skipped: 0, errors: 0 }

  if (!config.schema.timelineEvents) {
    console.log('Timeline events schema not provided, skipping')
    return stats
  }

  const batchSize = config.batchSize || 50

  // Get events that need embedding (no existing embedding or content changed)
  let offset = 0
  while (true) {
    const events = await config.db.query.timelineEvents.findMany({
      where: eq(config.schema.timelineEvents.tenantId, config.tenantId),
      limit: batchSize,
      offset,
      orderBy: (events: any, { desc }: any) => [desc(events.occurredAt)],
    })

    if (events.length === 0) break

    console.log(`Processing timeline events ${offset + 1} - ${offset + events.length}`)
    await processBatch(config, events, timelineEventExtractor, stats)

    offset += batchSize

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return stats
}

/**
 * Embed all Gmail messages
 */
export async function embedGmailMessages(config: PipelineConfig): Promise<PipelineStats> {
  const stats: PipelineStats = { processed: 0, created: 0, updated: 0, skipped: 0, errors: 0 }

  if (!config.schema.gmailMessages) {
    console.log('Gmail messages schema not provided, skipping')
    return stats
  }

  const batchSize = config.batchSize || 50
  let offset = 0

  while (true) {
    const messages = await config.db.query.gmailMessages.findMany({
      limit: batchSize,
      offset,
      orderBy: (msgs: any, { desc }: any) => [desc(msgs.receivedAt)],
    })

    if (messages.length === 0) break

    console.log(`Processing Gmail messages ${offset + 1} - ${offset + messages.length}`)
    await processBatch(config, messages, gmailMessageExtractor, stats)

    offset += batchSize
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return stats
}

/**
 * Embed all core customers
 */
export async function embedCoreCustomers(config: PipelineConfig): Promise<PipelineStats> {
  const stats: PipelineStats = { processed: 0, created: 0, updated: 0, skipped: 0, errors: 0 }

  if (!config.schema.coreCustomers) {
    console.log('Core customers schema not provided, skipping')
    return stats
  }

  const batchSize = config.batchSize || 100
  let offset = 0

  while (true) {
    const customers = await config.db.query.coreCustomers.findMany({
      where: eq(config.schema.coreCustomers.tenantId, config.tenantId),
      limit: batchSize,
      offset,
    })

    if (customers.length === 0) break

    console.log(`Processing customers ${offset + 1} - ${offset + customers.length}`)
    await processBatch(config, customers, coreCustomerExtractor, stats)

    offset += batchSize
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return stats
}

/**
 * Embed all core vehicles
 */
export async function embedCoreVehicles(config: PipelineConfig): Promise<PipelineStats> {
  const stats: PipelineStats = { processed: 0, created: 0, updated: 0, skipped: 0, errors: 0 }

  if (!config.schema.coreVehicles) {
    console.log('Core vehicles schema not provided, skipping')
    return stats
  }

  const batchSize = config.batchSize || 100
  let offset = 0

  while (true) {
    const vehicles = await config.db.query.coreVehicles.findMany({
      where: eq(config.schema.coreVehicles.tenantId, config.tenantId),
      limit: batchSize,
      offset,
    })

    if (vehicles.length === 0) break

    console.log(`Processing vehicles ${offset + 1} - ${offset + vehicles.length}`)
    await processBatch(config, vehicles, coreVehicleExtractor, stats)

    offset += batchSize
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return stats
}

/**
 * Embed all Spireon devices
 */
export async function embedSpireonDevices(config: PipelineConfig): Promise<PipelineStats> {
  const stats: PipelineStats = { processed: 0, created: 0, updated: 0, skipped: 0, errors: 0 }

  if (!config.schema.spireonDevices) {
    console.log('Spireon devices schema not provided, skipping')
    return stats
  }

  const batchSize = config.batchSize || 100
  let offset = 0

  while (true) {
    const devices = await config.db.query.spireonDevices.findMany({
      where: isNull(config.schema.spireonDevices.deletedAt),
      limit: batchSize,
      offset,
    })

    if (devices.length === 0) break

    console.log(`Processing Spireon devices ${offset + 1} - ${offset + devices.length}`)
    await processBatch(config, devices, spireonDeviceExtractor, stats)

    offset += batchSize
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return stats
}

/**
 * Run full embedding pipeline for all data types
 */
export async function runFullPipeline(config: PipelineConfig): Promise<Record<string, PipelineStats>> {
  console.log('Starting full embedding pipeline...')

  const results: Record<string, PipelineStats> = {}

  // Process each data type
  console.log('\n=== Embedding Core Customers ===')
  results.coreCustomers = await embedCoreCustomers(config)

  console.log('\n=== Embedding Core Vehicles ===')
  results.coreVehicles = await embedCoreVehicles(config)

  console.log('\n=== Embedding Spireon Devices ===')
  results.spireonDevices = await embedSpireonDevices(config)

  console.log('\n=== Embedding Timeline Events ===')
  results.timelineEvents = await embedTimelineEvents(config)

  console.log('\n=== Embedding Gmail Messages ===')
  results.gmailMessages = await embedGmailMessages(config)

  console.log('\n=== Pipeline Complete ===')
  for (const [type, stats] of Object.entries(results)) {
    console.log(`${type}: processed=${stats.processed}, created=${stats.created}, updated=${stats.updated}, skipped=${stats.skipped}, errors=${stats.errors}`)
  }

  return results
}
