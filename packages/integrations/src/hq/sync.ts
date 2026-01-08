/**
 * HQ Rental Sync Service
 * Syncs reservations, customers, and vehicles from HQ Rental Software
 */

import { eq, and } from 'drizzle-orm'
import { hashData, sleep, normalizePhone, generateS3Key, downloadAndUploadToS3 } from '@mrst/shared'
import {
  hqCustomers,
  hqVehicles,
  hqReservations,
  hqContracts,
  hqDocuments,
  type Database,
} from '@mrst/db'
import { HQClient } from './client'
import type {
  HQReservationListItem,
  HQReservationDetails,
  HQCustomer,
  HQVehicle,
  HQReservationVehicle,
  HQFile,
  HQSyncCounts,
  HQSyncResult,
} from './types'

export interface HQSyncContext {
  db: Database
  client: HQClient
  integrationAccountId: string
  tenantId: string
  onProgress?: (message: string, counts?: HQSyncCounts) => void
}

function createCounts(): HQSyncCounts {
  return { processed: 0, created: 0, updated: 0, unchanged: 0, errored: 0 }
}

/**
 * Sync a customer from reservation data
 */
async function syncCustomer(
  ctx: HQSyncContext,
  customer: HQCustomer
): Promise<string | null> {
  const now = new Date()
  const sourceHash = hashData(customer)

  try {
    const existing = await ctx.db
      .select({ id: hqCustomers.id, sourceHash: hqCustomers.sourceHash })
      .from(hqCustomers)
      .where(
        and(
          eq(hqCustomers.integrationAccountId, ctx.integrationAccountId),
          eq(hqCustomers.externalId, String(customer.id))
        )
      )
      .limit(1)

    const firstRow = existing[0]

    // Parse license expiry from custom field f256
    let licenseExpiry: Date | null = null
    if (customer.f256) {
      try {
        licenseExpiry = new Date(customer.f256)
      } catch {
        // Invalid date format
      }
    }

    // Parse birthdate
    let dateOfBirth: Date | null = null
    if (customer.birthdate) {
      try {
        dateOfBirth = new Date(customer.birthdate)
      } catch {
        // Invalid date format
      }
    }

    const customerData = {
      firstName: customer.first_name || null,
      lastName: customer.last_name || null,
      fullName: customer.label || null,
      email: customer.email || null,
      phone: customer.phone_number || null,
      phoneNormalized: normalizePhone(customer.phone_number),
      address: customer.street || null,
      city: customer.city || null,
      state: customer.state || null,
      zipCode: customer.zip || null,
      country: customer.country || null,
      licenseNumber: customer.driver_license || null,
      licenseState: customer.state || null, // Assume same as address state
      licenseExpiry,
      dateOfBirth,
      customerType: customer.entity || null,
      status: customer.verified ? 'verified' : 'unverified',
      raw: customer,
      sourceHash,
      lastSeenAt: now,
      syncedAt: now,
    }

    if (firstRow) {
      if (firstRow.sourceHash === sourceHash) {
        // No changes
        await ctx.db
          .update(hqCustomers)
          .set({ lastSeenAt: now, syncedAt: now })
          .where(eq(hqCustomers.id, firstRow.id))
        return firstRow.id
      } else {
        // Update existing
        await ctx.db
          .update(hqCustomers)
          .set(customerData)
          .where(eq(hqCustomers.id, firstRow.id))
        return firstRow.id
      }
    } else {
      // Create new with upsert to handle race conditions
      const result = await ctx.db
        .insert(hqCustomers)
        .values({
          integrationAccountId: ctx.integrationAccountId,
          externalId: String(customer.id),
          ...customerData,
          firstSeenAt: now,
        })
        .onConflictDoUpdate({
          target: [hqCustomers.integrationAccountId, hqCustomers.externalId],
          set: customerData,
        })
        .returning({ id: hqCustomers.id })

      const insertedRow = result[0]
      return insertedRow ? insertedRow.id : null
    }
  } catch (err) {
    console.error(`Error syncing customer ${customer.id}:`, err)
    return null
  }
}

/**
 * Sync a vehicle from reservation data
 */
async function syncVehicle(
  ctx: HQSyncContext,
  vehicle: HQVehicle
): Promise<string | null> {
  const now = new Date()
  const sourceHash = hashData(vehicle)

  try {
    const existing = await ctx.db
      .select({ id: hqVehicles.id, sourceHash: hqVehicles.sourceHash })
      .from(hqVehicles)
      .where(
        and(
          eq(hqVehicles.integrationAccountId, ctx.integrationAccountId),
          eq(hqVehicles.externalId, String(vehicle.id))
        )
      )
      .limit(1)

    const firstRow = existing[0]

    // Parse vehicle label to extract make/model
    // Format is typically "Make Model - Plate" e.g. "Acura MDX - LTY5158"
    let make: string | null = null
    let model: string | null = null
    if (vehicle.label) {
      const parts = vehicle.label.split(' - ')
      if (parts.length >= 1) {
        const makeModelParts = parts[0]?.split(' ') || []
        make = makeModelParts[0] || null
        model = makeModelParts.slice(1).join(' ') || null
      }
    }

    const vehicleData = {
      licensePlate: vehicle.plate || null,
      color: vehicle.color || null,
      make,
      model,
      currentMileage: vehicle.odometer || null,
      fuelLevel: vehicle.fuel_level ? String(vehicle.fuel_level) : null,
      status: 'active',
      raw: vehicle,
      sourceHash,
      lastSeenAt: now,
      syncedAt: now,
    }

    if (firstRow) {
      if (firstRow.sourceHash === sourceHash) {
        await ctx.db
          .update(hqVehicles)
          .set({ lastSeenAt: now, syncedAt: now })
          .where(eq(hqVehicles.id, firstRow.id))
        return firstRow.id
      } else {
        await ctx.db
          .update(hqVehicles)
          .set(vehicleData)
          .where(eq(hqVehicles.id, firstRow.id))
        return firstRow.id
      }
    } else {
      // Use upsert to handle race conditions in parallel processing
      const result = await ctx.db
        .insert(hqVehicles)
        .values({
          integrationAccountId: ctx.integrationAccountId,
          externalId: String(vehicle.id),
          ...vehicleData,
          firstSeenAt: now,
        })
        .onConflictDoUpdate({
          target: [hqVehicles.integrationAccountId, hqVehicles.externalId],
          set: vehicleData,
        })
        .returning({ id: hqVehicles.id })

      const insertedRow = result[0]
      return insertedRow ? insertedRow.id : null
    }
  } catch (err) {
    console.error(`Error syncing vehicle ${vehicle.id}:`, err)
    return null
  }
}

/**
 * Sync customer files/documents
 */
async function syncCustomerDocuments(
  ctx: HQSyncContext,
  customerId: string,
  externalCustomerId: string,
  files: HQFile[]
): Promise<void> {
  const now = new Date()

  for (const file of files) {
    const sourceHash = hashData(file)

    try {
      const existing = await ctx.db
        .select({ id: hqDocuments.id, sourceHash: hqDocuments.sourceHash })
        .from(hqDocuments)
        .where(
          and(
            eq(hqDocuments.integrationAccountId, ctx.integrationAccountId),
            eq(hqDocuments.externalId, String(file.id))
          )
        )
        .limit(1)

      const firstRow = existing[0]

      const docData = {
        documentType: 'customer_file',
        filename: file.label || null,
        mimeType: file.extension ? `image/${file.extension}` : null,
        url: file.public_download_link || file.public_link || null,
        raw: file,
        sourceHash,
        lastSeenAt: now,
        syncedAt: now,
      }

      if (firstRow) {
        if (firstRow.sourceHash !== sourceHash) {
          await ctx.db
            .update(hqDocuments)
            .set(docData)
            .where(eq(hqDocuments.id, firstRow.id))
        } else {
          await ctx.db
            .update(hqDocuments)
            .set({ lastSeenAt: now, syncedAt: now })
            .where(eq(hqDocuments.id, firstRow.id))
        }
      } else {
        // Use upsert to handle race conditions
        await ctx.db
          .insert(hqDocuments)
          .values({
            integrationAccountId: ctx.integrationAccountId,
            customerId,
            externalId: String(file.id),
            externalCustomerId,
            ...docData,
            firstSeenAt: now,
          })
          .onConflictDoUpdate({
            target: [hqDocuments.integrationAccountId, hqDocuments.externalId],
            set: docData,
          })
      }
    } catch (err) {
      console.error(`Error syncing document ${file.id}:`, err)
    }
  }
}

/**
 * Sync a single reservation with full details
 */
async function syncReservationDetails(
  ctx: HQSyncContext,
  reservationId: number,
  customerIds: Map<number, string>,
  vehicleIds: Map<number, string>,
  counts: { customers: HQSyncCounts; vehicles: HQSyncCounts; reservations: HQSyncCounts; documents: HQSyncCounts }
): Promise<void> {
  const now = new Date()

  try {
    // Fetch full reservation details
    const details = await ctx.client.getReservation(reservationId)
    const reservation = details.reservation
    const sourceHash = hashData(details)

    counts.reservations.processed++

    // Sync customer if not already synced
    if (details.customer && !customerIds.has(details.customer.id)) {
      counts.customers.processed++
      const customerId = await syncCustomer(ctx, details.customer)
      if (customerId) {
        customerIds.set(details.customer.id, customerId)
        counts.customers.created++

        // Sync customer documents
        const customerFiles = details.customer.f252
        if (customerFiles && Array.isArray(customerFiles)) {
          for (const _file of customerFiles) {
            counts.documents.processed++
          }
          await syncCustomerDocuments(ctx, customerId, String(details.customer.id), customerFiles)
          counts.documents.created += customerFiles.length
        }
      } else {
        counts.customers.errored++
      }
    }

    // Sync vehicles
    for (const rv of details.vehicles || []) {
      if (rv.vehicle && !vehicleIds.has(rv.vehicle.id)) {
        counts.vehicles.processed++
        const vehicleId = await syncVehicle(ctx, rv.vehicle)
        if (vehicleId) {
          vehicleIds.set(rv.vehicle.id, vehicleId)
          counts.vehicles.created++
        } else {
          counts.vehicles.errored++
        }
      }
    }

    // Get internal IDs for customer and first vehicle
    const customerId = details.customer ? customerIds.get(details.customer.id) : null
    const firstVehicle = details.vehicles?.[0]?.vehicle
    const vehicleId = firstVehicle ? vehicleIds.get(firstVehicle.id) : null

    // Check if reservation exists
    const existing = await ctx.db
      .select({ id: hqReservations.id, sourceHash: hqReservations.sourceHash })
      .from(hqReservations)
      .where(
        and(
          eq(hqReservations.integrationAccountId, ctx.integrationAccountId),
          eq(hqReservations.externalId, String(reservation.id))
        )
      )
      .limit(1)

    const firstRow = existing[0]

    // Parse total price
    const totalEstimate = typeof reservation.total_price === 'object'
      ? (reservation.total_price as { amount: string }).amount
      : reservation.total_price

    const reservationData = {
      customerId: customerId || null,
      vehicleId: vehicleId || null,
      externalCustomerId: details.customer ? String(details.customer.id) : null,
      externalVehicleId: firstVehicle ? String(firstVehicle.id) : null,
      reservationNumber: reservation.prefixed_id || String(reservation.id),
      status: reservation.status || null,
      pickupDate: reservation.pick_up_date ? new Date(reservation.pick_up_date) : null,
      returnDate: reservation.return_date ? new Date(reservation.return_date) : null,
      pickupLocation: reservation.pick_up_location_label || null,
      returnLocation: reservation.return_location_label || null,
      totalEstimate: totalEstimate || null,
      notes: (details.reservation.comments?.map(c => c.comment).join('\n')) ?? null,
      raw: details,
      sourceHash,
      lastSeenAt: now,
      syncedAt: now,
    }

    if (firstRow) {
      if (firstRow.sourceHash === sourceHash) {
        await ctx.db
          .update(hqReservations)
          .set({ lastSeenAt: now, syncedAt: now })
          .where(eq(hqReservations.id, firstRow.id))
        counts.reservations.unchanged++
      } else {
        await ctx.db
          .update(hqReservations)
          .set(reservationData)
          .where(eq(hqReservations.id, firstRow.id))
        counts.reservations.updated++
      }
    } else {
      await ctx.db
        .insert(hqReservations)
        .values({
          integrationAccountId: ctx.integrationAccountId,
          externalId: String(reservation.id),
          ...reservationData,
          firstSeenAt: now,
        })
        .onConflictDoUpdate({
          target: [hqReservations.integrationAccountId, hqReservations.externalId],
          set: reservationData,
        })
      counts.reservations.created++
    }

    // If status is 'rental' (active), also create/update a contract
    if (reservation.status === 'rental') {
      await syncContract(ctx, details, customerId ?? null, vehicleId ?? null, customerIds, vehicleIds)
    }
  } catch (err) {
    console.error(`Error syncing reservation ${reservationId}:`, err)
    counts.reservations.errored++
  }
}

/**
 * Sync contract from active rental
 */
async function syncContract(
  ctx: HQSyncContext,
  details: HQReservationDetails,
  customerId: string | null,
  vehicleId: string | null,
  _customerIds: Map<number, string>,
  _vehicleIds: Map<number, string>
): Promise<void> {
  const now = new Date()
  const reservation = details.reservation
  const sourceHash = hashData({ type: 'contract', ...details })

  try {
    // Check if contract exists
    const existing = await ctx.db
      .select({ id: hqContracts.id, sourceHash: hqContracts.sourceHash })
      .from(hqContracts)
      .where(
        and(
          eq(hqContracts.integrationAccountId, ctx.integrationAccountId),
          eq(hqContracts.externalId, `contract-${reservation.id}`)
        )
      )
      .limit(1)

    const firstRow = existing[0]

    // Get reservation ID
    const reservationResult = await ctx.db
      .select({ id: hqReservations.id })
      .from(hqReservations)
      .where(
        and(
          eq(hqReservations.integrationAccountId, ctx.integrationAccountId),
          eq(hqReservations.externalId, String(reservation.id))
        )
      )
      .limit(1)

    const reservationRow = reservationResult[0]
    const reservationId = reservationRow?.id || null

    // Get vehicle mileage from reservation vehicles
    const firstVehicleData = details.vehicles?.[0]
    const mileageOut = firstVehicleData?.odometer_pick_up || null
    const mileageIn = firstVehicleData?.odometer_return || null
    const fuelOut = firstVehicleData?.fuel_level_pick_up != null ? String(firstVehicleData.fuel_level_pick_up) : null
    const fuelIn = firstVehicleData?.fuel_level_return != null ? String(firstVehicleData.fuel_level_return) : null

    const totalPrice = typeof reservation.total_price === 'object'
      ? (reservation.total_price as { amount: string }).amount
      : reservation.total_price

    const totalPaid = details.total?.total_paid
      ? (typeof details.total.total_paid === 'object' ? details.total.total_paid.amount : details.total.total_paid)
      : '0'

    const balance = details.total?.outstanding_balance
      ? (typeof details.total.outstanding_balance === 'object' ? details.total.outstanding_balance.amount : details.total.outstanding_balance)
      : null

    const contractData = {
      customerId: customerId || null,
      vehicleId: vehicleId || null,
      reservationId,
      externalCustomerId: details.customer ? String(details.customer.id) : null,
      externalVehicleId: firstVehicleData?.vehicle ? String(firstVehicleData.vehicle.id) : null,
      externalReservationId: String(reservation.id),
      contractNumber: reservation.prefixed_id || String(reservation.id),
      status: 'active',
      pickupDate: reservation.pick_up_date ? new Date(reservation.pick_up_date) : null,
      expectedReturnDate: reservation.return_date ? new Date(reservation.return_date) : null,
      mileageOut,
      mileageIn,
      fuelOut,
      fuelIn,
      totalCharges: totalPrice || null,
      totalPayments: totalPaid || null,
      balance: balance || null,
      raw: details,
      sourceHash,
      lastSeenAt: now,
      syncedAt: now,
    }

    if (firstRow) {
      if (firstRow.sourceHash !== sourceHash) {
        await ctx.db
          .update(hqContracts)
          .set(contractData)
          .where(eq(hqContracts.id, firstRow.id))
      } else {
        await ctx.db
          .update(hqContracts)
          .set({ lastSeenAt: now, syncedAt: now })
          .where(eq(hqContracts.id, firstRow.id))
      }
    } else {
      await ctx.db
        .insert(hqContracts)
        .values({
          integrationAccountId: ctx.integrationAccountId,
          externalId: `contract-${reservation.id}`,
          ...contractData,
          firstSeenAt: now,
        })
        .onConflictDoUpdate({
          target: [hqContracts.integrationAccountId, hqContracts.externalId],
          set: contractData,
        })
    }
  } catch (err) {
    console.error(`Error syncing contract for reservation ${reservation.id}:`, err)
  }
}

/**
 * Full sync of all HQ data
 * Fetches all reservations and extracts customers/vehicles
 */
export async function syncAll(
  ctx: HQSyncContext,
  options: {
    /** Only sync reservations updated after this date */
    updatedAfter?: string
    /** Maximum reservations to process */
    maxReservations?: number
    /** Batch size for fetching details */
    batchSize?: number
  } = {}
): Promise<{
  reservations: HQSyncResult
  customers: HQSyncResult
  vehicles: HQSyncResult
  documents: HQSyncResult
}> {
  const { maxReservations, batchSize = 10 } = options

  const counts = {
    reservations: createCounts(),
    customers: createCounts(),
    vehicles: createCounts(),
    documents: createCounts(),
  }

  // Track synced customer/vehicle IDs to avoid re-fetching
  const customerIds = new Map<number, string>()
  const vehicleIds = new Map<number, string>()

  try {
    ctx.onProgress?.('Starting HQ sync...')

    // Test connection
    const connectionTest = await ctx.client.testConnection()
    if (!connectionTest.success) {
      return {
        reservations: { success: false, counts: counts.reservations, error: 'Connection failed' },
        customers: { success: false, counts: counts.customers, error: 'Connection failed' },
        vehicles: { success: false, counts: counts.vehicles, error: 'Connection failed' },
        documents: { success: false, counts: counts.documents, error: 'Connection failed' },
      }
    }

    ctx.onProgress?.(`Found ${connectionTest.total} total reservations`)

    // First pass: get all reservation IDs
    const reservationIds: number[] = []
    for await (const reservation of ctx.client.iterateReservations({
      updatedAfter: options.updatedAfter,
    })) {
      reservationIds.push(reservation.id)

      if (maxReservations && reservationIds.length >= maxReservations) {
        break
      }
    }

    ctx.onProgress?.(`Processing ${reservationIds.length} reservations...`)

    // Process in batches
    for (let i = 0; i < reservationIds.length; i += batchSize) {
      const batch = reservationIds.slice(i, i + batchSize)

      await Promise.all(
        batch.map(id => syncReservationDetails(ctx, id, customerIds, vehicleIds, counts))
      )

      ctx.onProgress?.(
        `Processed ${Math.min(i + batchSize, reservationIds.length)}/${reservationIds.length} reservations`,
        counts.reservations
      )

      // Delay between batches
      if (i + batchSize < reservationIds.length) {
        await sleep(500)
      }
    }

    ctx.onProgress?.('HQ sync complete', counts.reservations)

    return {
      reservations: { success: true, counts: counts.reservations },
      customers: { success: true, counts: counts.customers },
      vehicles: { success: true, counts: counts.vehicles },
      documents: { success: true, counts: counts.documents },
    }
  } catch (error) {
    const errorMessage = (error as Error).message
    return {
      reservations: { success: false, counts: counts.reservations, error: errorMessage },
      customers: { success: false, counts: counts.customers, error: errorMessage },
      vehicles: { success: false, counts: counts.vehicles, error: errorMessage },
      documents: { success: false, counts: counts.documents, error: errorMessage },
    }
  }
}

/**
 * Quick sync - only process recent/updated reservations
 */
export async function syncIncremental(
  ctx: HQSyncContext,
  options: {
    /** Number of days to look back */
    days?: number
  } = {}
): Promise<{
  reservations: HQSyncResult
  customers: HQSyncResult
  vehicles: HQSyncResult
  documents: HQSyncResult
}> {
  const days = options.days || 7
  const since = new Date()
  since.setDate(since.getDate() - days)

  return syncAll(ctx, {
    updatedAfter: since.toISOString(),
    batchSize: 5,
  })
}

/**
 * Download pending HQ documents to S3
 */
export async function downloadPendingDocuments(
  ctx: HQSyncContext,
  options: { batchSize?: number; maxFiles?: number } = {}
): Promise<HQSyncResult> {
  const { batchSize = 10, maxFiles = 100 } = options
  const counts = createCounts()

  try {
    ctx.onProgress?.('Fetching pending HQ documents to download...')

    // Get documents that haven't been downloaded to S3
    const pendingDocs = await ctx.db
      .select({
        id: hqDocuments.id,
        externalId: hqDocuments.externalId,
        filename: hqDocuments.filename,
        url: hqDocuments.url,
        customerId: hqDocuments.customerId,
        externalCustomerId: hqDocuments.externalCustomerId,
      })
      .from(hqDocuments)
      .where(
        and(
          eq(hqDocuments.integrationAccountId, ctx.integrationAccountId),
          eq(hqDocuments.s3Downloaded, false)
        )
      )
      .limit(maxFiles)

    if (pendingDocs.length === 0) {
      ctx.onProgress?.('No pending HQ documents to download')
      return { success: true, counts }
    }

    ctx.onProgress?.(`Found ${pendingDocs.length} HQ documents to download`)

    // Process in batches
    for (let i = 0; i < pendingDocs.length; i += batchSize) {
      const batch = pendingDocs.slice(i, i + batchSize)

      await Promise.all(
        batch.map(async (doc) => {
          counts.processed++

          try {
            // Skip if no URL
            if (!doc.url) {
              counts.errored++
              return
            }

            // Generate S3 key
            const s3Key = generateS3Key({
              tenantId: ctx.tenantId,
              source: 'hq',
              entityType: 'customer_document',
              entityId: doc.externalCustomerId || doc.externalId,
              filename: doc.filename || `document_${doc.externalId}`,
            })

            // Download and upload to S3
            const result = await downloadAndUploadToS3({
              sourceUrl: doc.url,
              key: s3Key,
            })

            // Update the document record
            await ctx.db
              .update(hqDocuments)
              .set({
                s3Downloaded: true,
                s3Bucket: result.bucket,
                s3Key: result.key,
                downloadedAt: new Date(),
              })
              .where(eq(hqDocuments.id, doc.id))

            counts.updated++
            ctx.onProgress?.(`Downloaded: ${doc.filename || doc.externalId}`)
          } catch (err) {
            console.error(`Error downloading HQ document ${doc.id} (${doc.filename}):`, err)
            counts.errored++
          }
        })
      )

      // Small delay between batches
      if (i + batchSize < pendingDocs.length) {
        await sleep(500)
      }
    }

    ctx.onProgress?.(`Downloaded ${counts.updated} HQ documents to S3`, counts)
    return { success: true, counts }
  } catch (error) {
    return { success: false, counts, error: (error as Error).message }
  }
}

// HQSyncContext interface is exported above; HQSyncResult and HQSyncCounts are in types.ts
