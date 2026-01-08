/**
 * Populate core_customers and core_vehicles from HQ data
 * Creates external_links to connect core entities to HQ records
 */

import { eq, and, sql, isNull } from 'drizzle-orm'
import {
  hqCustomers,
  hqVehicles,
  hqReservations,
  coreCustomers,
  coreVehicles,
  externalLinks,
  type Database,
} from '@mrst/db'

export interface PopulateContext {
  db: Database
  tenantId: string
  integrationAccountId: string
  onProgress?: (message: string, counts?: { created: number; skipped: number }) => void
}

/**
 * Populate core_customers from hq_customers
 * Creates external_links for each customer
 */
export async function populateCoreCustomers(
  ctx: PopulateContext
): Promise<{ success: boolean; created: number; skipped: number; error?: string }> {
  let created = 0
  let skipped = 0

  try {
    ctx.onProgress?.('Fetching HQ customers without core links...')

    // Get HQ customers that don't have external links yet
    const hqCustomersWithoutLinks = await ctx.db
      .select({
        id: hqCustomers.id,
        externalId: hqCustomers.externalId,
        firstName: hqCustomers.firstName,
        lastName: hqCustomers.lastName,
        fullName: hqCustomers.fullName,
        email: hqCustomers.email,
        phoneNormalized: hqCustomers.phoneNormalized,
        phone: hqCustomers.phone,
        status: hqCustomers.status,
      })
      .from(hqCustomers)
      .leftJoin(
        externalLinks,
        and(
          eq(externalLinks.source, 'hq'),
          eq(externalLinks.sourceEntityType, 'hq_customer'),
          eq(externalLinks.sourceEntityId, hqCustomers.id)
        )
      )
      .where(
        and(
          eq(hqCustomers.integrationAccountId, ctx.integrationAccountId),
          isNull(externalLinks.id)
        )
      )

    ctx.onProgress?.(`Found ${hqCustomersWithoutLinks.length} HQ customers to process`)

    // Process each customer
    for (const hqCustomer of hqCustomersWithoutLinks) {
      try {
        // Check if core customer with same email/phone already exists
        let existingCoreCustomer = null

        if (hqCustomer.email) {
          const emailMatch = await ctx.db
            .select({ id: coreCustomers.id })
            .from(coreCustomers)
            .where(
              and(
                eq(coreCustomers.tenantId, ctx.tenantId),
                eq(coreCustomers.primaryEmail, hqCustomer.email)
              )
            )
            .limit(1)
          existingCoreCustomer = emailMatch[0] ?? null
        }

        if (!existingCoreCustomer && hqCustomer.phoneNormalized) {
          const phoneMatch = await ctx.db
            .select({ id: coreCustomers.id })
            .from(coreCustomers)
            .where(
              and(
                eq(coreCustomers.tenantId, ctx.tenantId),
                eq(coreCustomers.primaryPhone, hqCustomer.phoneNormalized)
              )
            )
            .limit(1)
          existingCoreCustomer = phoneMatch[0] ?? null
        }

        let coreCustomerId: string
        const matchedOn: string[] = []

        if (existingCoreCustomer) {
          // Use existing core customer
          coreCustomerId = existingCoreCustomer.id
          if (hqCustomer.email) matchedOn.push('email')
          if (hqCustomer.phoneNormalized) matchedOn.push('phone')
          skipped++
        } else {
          // Create new core customer
          const displayName = hqCustomer.fullName ||
            [hqCustomer.firstName, hqCustomer.lastName].filter(Boolean).join(' ') ||
            hqCustomer.email ||
            hqCustomer.phone ||
            'Unknown'

          const result = await ctx.db
            .insert(coreCustomers)
            .values({
              tenantId: ctx.tenantId,
              primaryEmail: hqCustomer.email,
              primaryPhone: hqCustomer.phoneNormalized || hqCustomer.phone,
              firstName: hqCustomer.firstName,
              lastName: hqCustomer.lastName,
              fullName: hqCustomer.fullName,
              displayName,
              status: hqCustomer.status || 'active',
            })
            .returning({ id: coreCustomers.id })

          const insertedRow = result[0]
          if (!insertedRow) {
            console.error(`Failed to insert core customer for HQ customer ${hqCustomer.id}`)
            continue
          }
          coreCustomerId = insertedRow.id
          created++
        }

        // Create external link
        await ctx.db
          .insert(externalLinks)
          .values({
            tenantId: ctx.tenantId,
            entityType: 'customer',
            entityId: coreCustomerId,
            source: 'hq',
            sourceEntityType: 'hq_customer',
            sourceEntityId: hqCustomer.id,
            externalId: hqCustomer.externalId,
            confidence: existingCoreCustomer ? 'auto' : 'confirmed',
            confidenceScore: existingCoreCustomer ? 80 : 100,
            matchedOn,
            status: 'active',
          })
          .onConflictDoNothing()

      } catch (err) {
        console.error(`Error processing HQ customer ${hqCustomer.id}:`, err)
      }
    }

    ctx.onProgress?.(`Core customers: ${created} created, ${skipped} linked to existing`, { created, skipped })
    return { success: true, created, skipped }
  } catch (error) {
    return { success: false, created, skipped, error: (error as Error).message }
  }
}

/**
 * Populate core_vehicles from hq_vehicles
 * Creates external_links for each vehicle
 */
export async function populateCoreVehicles(
  ctx: PopulateContext
): Promise<{ success: boolean; created: number; skipped: number; error?: string }> {
  let created = 0
  let skipped = 0

  try {
    ctx.onProgress?.('Fetching HQ vehicles without core links...')

    // Get HQ vehicles that don't have external links yet
    const hqVehiclesWithoutLinks = await ctx.db
      .select({
        id: hqVehicles.id,
        externalId: hqVehicles.externalId,
        vin: hqVehicles.vin,
        licensePlate: hqVehicles.licensePlate,
        make: hqVehicles.make,
        model: hqVehicles.model,
        year: hqVehicles.year,
        color: hqVehicles.color,
        currentMileage: hqVehicles.currentMileage,
        status: hqVehicles.status,
      })
      .from(hqVehicles)
      .leftJoin(
        externalLinks,
        and(
          eq(externalLinks.source, 'hq'),
          eq(externalLinks.sourceEntityType, 'hq_vehicle'),
          eq(externalLinks.sourceEntityId, hqVehicles.id)
        )
      )
      .where(
        and(
          eq(hqVehicles.integrationAccountId, ctx.integrationAccountId),
          isNull(externalLinks.id)
        )
      )

    ctx.onProgress?.(`Found ${hqVehiclesWithoutLinks.length} HQ vehicles to process`)

    // Process each vehicle
    for (const hqVehicle of hqVehiclesWithoutLinks) {
      try {
        // Check if core vehicle with same VIN or plate already exists
        let existingCoreVehicle = null
        const matchedOn: string[] = []

        if (hqVehicle.vin) {
          const vinMatch = await ctx.db
            .select({ id: coreVehicles.id })
            .from(coreVehicles)
            .where(
              and(
                eq(coreVehicles.tenantId, ctx.tenantId),
                eq(coreVehicles.vin, hqVehicle.vin)
              )
            )
            .limit(1)
          existingCoreVehicle = vinMatch[0] ?? null
          if (existingCoreVehicle) matchedOn.push('vin')
        }

        if (!existingCoreVehicle && hqVehicle.licensePlate) {
          const plateMatch = await ctx.db
            .select({ id: coreVehicles.id })
            .from(coreVehicles)
            .where(
              and(
                eq(coreVehicles.tenantId, ctx.tenantId),
                eq(coreVehicles.licensePlate, hqVehicle.licensePlate)
              )
            )
            .limit(1)
          existingCoreVehicle = plateMatch[0] ?? null
          if (existingCoreVehicle) matchedOn.push('license_plate')
        }

        let coreVehicleId: string

        if (existingCoreVehicle) {
          // Use existing core vehicle
          coreVehicleId = existingCoreVehicle.id
          skipped++
        } else {
          // Create new core vehicle
          const result = await ctx.db
            .insert(coreVehicles)
            .values({
              tenantId: ctx.tenantId,
              vin: hqVehicle.vin,
              licensePlate: hqVehicle.licensePlate,
              year: hqVehicle.year,
              make: hqVehicle.make,
              model: hqVehicle.model,
              color: hqVehicle.color,
              currentMileage: hqVehicle.currentMileage,
              status: hqVehicle.status || 'available',
            })
            .returning({ id: coreVehicles.id })

          const insertedRow = result[0]
          if (!insertedRow) {
            console.error(`Failed to insert core vehicle for HQ vehicle ${hqVehicle.id}`)
            continue
          }
          coreVehicleId = insertedRow.id
          created++
        }

        // Create external link
        await ctx.db
          .insert(externalLinks)
          .values({
            tenantId: ctx.tenantId,
            entityType: 'vehicle',
            entityId: coreVehicleId,
            source: 'hq',
            sourceEntityType: 'hq_vehicle',
            sourceEntityId: hqVehicle.id,
            externalId: hqVehicle.externalId,
            confidence: existingCoreVehicle ? 'auto' : 'confirmed',
            confidenceScore: existingCoreVehicle ? 80 : 100,
            matchedOn,
            status: 'active',
          })
          .onConflictDoNothing()

      } catch (err) {
        console.error(`Error processing HQ vehicle ${hqVehicle.id}:`, err)
      }
    }

    ctx.onProgress?.(`Core vehicles: ${created} created, ${skipped} linked to existing`, { created, skipped })
    return { success: true, created, skipped }
  } catch (error) {
    return { success: false, created, skipped, error: (error as Error).message }
  }
}

/**
 * Update customer rental statistics from HQ reservations
 */
export async function updateCustomerStats(
  ctx: PopulateContext
): Promise<{ success: boolean; updated: number; error?: string }> {
  let updated = 0

  try {
    ctx.onProgress?.('Updating customer rental statistics...')

    // Get rental counts and totals per HQ customer
    const stats = await ctx.db
      .select({
        hqCustomerId: hqReservations.customerId,
        totalRentals: sql<number>`count(*)::int`,
        totalSpent: sql<string>`coalesce(sum(${hqReservations.totalEstimate}::decimal), 0)`,
        lastRentalAt: sql<Date>`max(${hqReservations.pickupDate})`,
      })
      .from(hqReservations)
      .where(eq(hqReservations.integrationAccountId, ctx.integrationAccountId))
      .groupBy(hqReservations.customerId)

    ctx.onProgress?.(`Found stats for ${stats.length} customers`)

    // Update core customers via external links
    for (const stat of stats) {
      if (!stat.hqCustomerId) continue

      try {
        // Find the core customer via external link
        const link = await ctx.db
          .select({ entityId: externalLinks.entityId })
          .from(externalLinks)
          .where(
            and(
              eq(externalLinks.source, 'hq'),
              eq(externalLinks.sourceEntityType, 'hq_customer'),
              eq(externalLinks.sourceEntityId, stat.hqCustomerId)
            )
          )
          .limit(1)

        const linkRow = link[0]
        if (!linkRow) continue

        // Update the core customer (convert lastRentalAt to proper Date if needed)
        const lastRentalAt = stat.lastRentalAt
          ? (stat.lastRentalAt instanceof Date ? stat.lastRentalAt : new Date(stat.lastRentalAt))
          : null

        await ctx.db
          .update(coreCustomers)
          .set({
            totalRentals: stat.totalRentals,
            totalSpent: stat.totalSpent,
            lastRentalAt,
            updatedAt: new Date(),
          })
          .where(eq(coreCustomers.id, linkRow.entityId))

        updated++
      } catch (err) {
        console.error(`Error updating stats for customer ${stat.hqCustomerId}:`, err)
      }
    }

    ctx.onProgress?.(`Updated rental stats for ${updated} customers`)
    return { success: true, updated }
  } catch (error) {
    return { success: false, updated, error: (error as Error).message }
  }
}

/**
 * Populate all core tables from HQ data
 */
export async function populateAll(
  ctx: PopulateContext
): Promise<{
  customers: { success: boolean; created: number; skipped: number; error?: string }
  vehicles: { success: boolean; created: number; skipped: number; error?: string }
  stats: { success: boolean; updated: number; error?: string }
}> {
  ctx.onProgress?.('Starting core table population from HQ data...')

  const customers = await populateCoreCustomers(ctx)
  const vehicles = await populateCoreVehicles(ctx)
  const stats = await updateCustomerStats(ctx)

  ctx.onProgress?.('Core table population complete')

  return { customers, vehicles, stats }
}
