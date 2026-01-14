/**
 * Spireon Sync Service
 *
 * Syncs devices (assets) from Spireon to the database
 */

import { eq, and, gte } from 'drizzle-orm'
import * as crypto from 'crypto'
import type { SpireonClient, SpireonDevice, SpireonGeofence } from './client'
import { isAtShop } from '@mrst/shared'

// Database types will be passed in
interface DrizzleDB {
  select: (fields?: unknown) => any
  insert: (table: any) => any
  update: (table: any) => any
  query: any
}

interface SyncStats {
  devicesCreated: number
  devicesUpdated: number
  devicesUnchanged: number
  geofencesCreated: number
  geofencesUpdated: number
  locationsCreated: number
  errors: number
}

/**
 * Generate hash of device data for change detection
 */
function hashDevice(device: SpireonDevice): string {
  const data = JSON.stringify({
    name: device.deviceName,
    serialNumber: device.serialNumber,
    imei: device.imei,
    deviceType: device.deviceType,
    vehicleName: device.vehicleName,
    vehicleVin: device.vehicleVin,
    vehicleLicensePlate: device.vehicleLicensePlate,
    vehicleYear: device.vehicleYear,
    vehicleMake: device.vehicleMake,
    vehicleModel: device.vehicleModel,
    status: device.status,
  })
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Generate hash of geofence data
 */
function hashGeofence(geofence: SpireonGeofence): string {
  const data = JSON.stringify({
    name: geofence.name,
    description: geofence.description,
    type: geofence.type,
    centerLat: geofence.centerLat,
    centerLng: geofence.centerLng,
    radiusMeters: geofence.radiusMeters,
    polygon: geofence.polygon,
    isActive: geofence.isActive,
  })
  return crypto.createHash('sha256').update(data).digest('hex')
}

export interface SpireonSyncConfig {
  db: DrizzleDB
  client: SpireonClient
  integrationAccountId: string
  schema: {
    spireonDevices: any
    spireonLocations: any
    spireonGeofences: any
    spireonGeofenceEvents: any
  }
}

/**
 * Sync all devices from Spireon
 */
export async function syncDevices(config: SpireonSyncConfig): Promise<SyncStats> {
  const { db, client, integrationAccountId, schema } = config
  const { spireonDevices } = schema

  const stats: SyncStats = {
    devicesCreated: 0,
    devicesUpdated: 0,
    devicesUnchanged: 0,
    geofencesCreated: 0,
    geofencesUpdated: 0,
    locationsCreated: 0,
    errors: 0,
  }

  // Fetch all devices from Spireon (paginate if needed)
  let allDevices: SpireonDevice[] = []
  let offset = 0
  const limit = 100

  while (true) {
    const result = await client.getAssets({ limit, offset })
    allDevices = allDevices.concat(result.content)

    if (result.content.length < limit || allDevices.length >= result.total) {
      break
    }
    offset += limit
  }

  console.log(`Fetched ${allDevices.length} devices from Spireon`)

  // Process each device
  for (const device of allDevices) {
    try {
      const sourceHash = hashDevice(device)
      const now = new Date()

      // Check if device exists
      const existing = await db.query.spireonDevices.findFirst({
        where: and(
          eq(spireonDevices.integrationAccountId, integrationAccountId),
          eq(spireonDevices.externalId, device.deviceId)
        ),
      })

      if (existing) {
        // Check if changed
        if (existing.sourceHash === sourceHash) {
          stats.devicesUnchanged++
          continue
        }

        // Update existing device
        await db.update(spireonDevices)
          .set({
            name: device.deviceName,
            serialNumber: device.serialNumber,
            imei: device.imei,
            deviceType: device.deviceType,
            vehicleName: device.vehicleName,
            vehicleVin: device.vehicleVin,
            vehicleLicensePlate: device.vehicleLicensePlate,
            vehicleYear: device.vehicleYear || null,
            vehicleMake: device.vehicleMake,
            vehicleModel: device.vehicleModel,
            status: device.status,
            isOnline: device.isOnline,
            lastCommunication: device.lastCommunication ? new Date(device.lastCommunication) : null,
            currentLat: device.lastLocation?.lat || null,
            currentLng: device.lastLocation?.lng || null,
            currentSpeed: device.lastLocation?.speed?.toString() || null,
            currentHeading: device.lastLocation?.heading || null,
            currentAddress: device.lastLocation?.address || null,
            currentLocationAt: device.lastLocation?.recordedAt ? new Date(device.lastLocation.recordedAt) : null,
            ignitionOn: device.lastLocation?.ignitionOn || false,
            raw: device.raw,
            lastSeenAt: now,
            sourceHash,
            syncedAt: now,
            deletedAt: null, // Clear deleted flag if re-appeared
          })
          .where(eq(spireonDevices.id, existing.id))

        stats.devicesUpdated++
      } else {
        // Create new device
        await db.insert(spireonDevices).values({
          integrationAccountId,
          externalId: device.deviceId,
          name: device.deviceName,
          serialNumber: device.serialNumber,
          imei: device.imei,
          deviceType: device.deviceType,
          vehicleName: device.vehicleName,
          vehicleVin: device.vehicleVin,
          vehicleLicensePlate: device.vehicleLicensePlate,
          vehicleYear: device.vehicleYear || null,
          vehicleMake: device.vehicleMake,
          vehicleModel: device.vehicleModel,
          status: device.status,
          isOnline: device.isOnline,
          lastCommunication: device.lastCommunication ? new Date(device.lastCommunication) : null,
          currentLat: device.lastLocation?.lat || null,
          currentLng: device.lastLocation?.lng || null,
          currentSpeed: device.lastLocation?.speed?.toString() || null,
          currentHeading: device.lastLocation?.heading || null,
          currentAddress: device.lastLocation?.address || null,
          currentLocationAt: device.lastLocation?.recordedAt ? new Date(device.lastLocation.recordedAt) : null,
          ignitionOn: device.lastLocation?.ignitionOn || false,
          raw: device.raw,
          firstSeenAt: now,
          lastSeenAt: now,
          sourceHash,
          syncedAt: now,
        })

        stats.devicesCreated++
      }
    } catch (error) {
      console.error(`Error syncing device ${device.deviceId}:`, error)
      stats.errors++
    }
  }

  return stats
}

/**
 * Sync geofences from Spireon
 */
export async function syncGeofences(config: SpireonSyncConfig): Promise<SyncStats> {
  const { db, client, integrationAccountId, schema } = config
  const { spireonGeofences } = schema

  const stats: SyncStats = {
    devicesCreated: 0,
    devicesUpdated: 0,
    devicesUnchanged: 0,
    geofencesCreated: 0,
    geofencesUpdated: 0,
    locationsCreated: 0,
    errors: 0,
  }

  try {
    const geofences = await client.getGeofences()
    console.log(`Fetched ${geofences.length} geofences from Spireon`)

    for (const geofence of geofences) {
      try {
        const sourceHash = hashGeofence(geofence)
        const now = new Date()

        const existing = await db.query.spireonGeofences.findFirst({
          where: and(
            eq(spireonGeofences.integrationAccountId, integrationAccountId),
            eq(spireonGeofences.externalId, geofence.geofenceId)
          ),
        })

        if (existing) {
          if (existing.sourceHash === sourceHash) {
            continue
          }

          await db.update(spireonGeofences)
            .set({
              name: geofence.name,
              description: geofence.description,
              geofenceType: geofence.type,
              centerLat: geofence.centerLat,
              centerLng: geofence.centerLng,
              radiusMeters: geofence.radiusMeters?.toString() || null,
              polygon: geofence.polygon,
              isActive: geofence.isActive,
              raw: geofence.raw,
              lastSeenAt: now,
              sourceHash,
              syncedAt: now,
              deletedAt: null,
            })
            .where(eq(spireonGeofences.id, existing.id))

          stats.geofencesUpdated++
        } else {
          await db.insert(spireonGeofences).values({
            integrationAccountId,
            externalId: geofence.geofenceId,
            name: geofence.name,
            description: geofence.description,
            geofenceType: geofence.type,
            centerLat: geofence.centerLat,
            centerLng: geofence.centerLng,
            radiusMeters: geofence.radiusMeters?.toString() || null,
            polygon: geofence.polygon,
            isActive: geofence.isActive,
            raw: geofence.raw,
            firstSeenAt: now,
            lastSeenAt: now,
            sourceHash,
            syncedAt: now,
          })

          stats.geofencesCreated++
        }
      } catch (error) {
        console.error(`Error syncing geofence ${geofence.geofenceId}:`, error)
        stats.errors++
      }
    }
  } catch (error) {
    console.error('Error fetching geofences:', error)
    stats.errors++
  }

  return stats
}

/**
 * Sync location history for a device
 */
export async function syncDeviceLocations(
  config: SpireonSyncConfig,
  deviceDbId: string,
  externalDeviceId: string,
  startDate: Date,
  endDate: Date
): Promise<SyncStats> {
  const { db, client, integrationAccountId, schema } = config
  const { spireonLocations } = schema

  const stats: SyncStats = {
    devicesCreated: 0,
    devicesUpdated: 0,
    devicesUnchanged: 0,
    geofencesCreated: 0,
    geofencesUpdated: 0,
    locationsCreated: 0,
    errors: 0,
  }

  try {
    const locations = await client.getDeviceLocations(externalDeviceId, startDate, endDate)
    console.log(`Fetched ${locations.length} locations for device ${externalDeviceId}`)

    for (const location of locations) {
      try {
        const now = new Date()

        await db.insert(spireonLocations).values({
          integrationAccountId,
          deviceId: deviceDbId,
          lat: location.lat,
          lng: location.lng,
          altitude: location.altitude?.toString() || null,
          speed: location.speed?.toString() || null,
          heading: location.heading || null,
          address: location.address,
          city: location.city,
          state: location.state,
          zipCode: location.zipCode,
          eventType: location.eventType,
          recordedAt: new Date(location.recordedAt),
          receivedAt: now,
          raw: location.raw,
          firstSeenAt: now,
          syncedAt: now,
        })

        stats.locationsCreated++
      } catch (error) {
        // Skip duplicate locations (unique constraint)
        if (!(error instanceof Error && error.message.includes('duplicate'))) {
          console.error(`Error inserting location:`, error)
          stats.errors++
        }
      }
    }
  } catch (error) {
    console.error(`Error fetching locations for device ${externalDeviceId}:`, error)
    stats.errors++
  }

  return stats
}

/**
 * Full sync: devices and geofences
 */
export async function syncAll(config: SpireonSyncConfig): Promise<SyncStats> {
  console.log('Starting Spireon full sync...')

  const deviceStats = await syncDevices(config)
  const geofenceStats = await syncGeofences(config)

  const stats: SyncStats = {
    devicesCreated: deviceStats.devicesCreated,
    devicesUpdated: deviceStats.devicesUpdated,
    devicesUnchanged: deviceStats.devicesUnchanged,
    geofencesCreated: geofenceStats.geofencesCreated,
    geofencesUpdated: geofenceStats.geofencesUpdated,
    locationsCreated: 0,
    errors: deviceStats.errors + geofenceStats.errors,
  }

  console.log('Spireon sync complete:', stats)
  return stats
}

/**
 * Poll current locations for all devices
 * This updates the cached current location on each device
 */
export async function pollCurrentLocations(config: SpireonSyncConfig): Promise<SyncStats> {
  const { db, client, integrationAccountId, schema } = config
  const { spireonDevices, spireonLocations } = schema

  const stats: SyncStats = {
    devicesCreated: 0,
    devicesUpdated: 0,
    devicesUnchanged: 0,
    geofencesCreated: 0,
    geofencesUpdated: 0,
    locationsCreated: 0,
    errors: 0,
  }

  console.log('Polling current locations for all devices...')

  // Get all devices from API - this includes current location
  let allDevices: SpireonDevice[] = []
  let offset = 0
  const limit = 100

  while (true) {
    const result = await client.getAssets({ limit, offset })
    allDevices = allDevices.concat(result.content)

    if (result.content.length < limit || allDevices.length >= result.total) {
      break
    }
    offset += limit
  }

  console.log(`Fetched ${allDevices.length} devices with current locations`)

  const now = new Date()

  for (const device of allDevices) {
    if (!device.lastLocation) {
      continue
    }

    try {
      // Find the device in database
      const existing = await db.query.spireonDevices.findFirst({
        where: and(
          eq(spireonDevices.integrationAccountId, integrationAccountId),
          eq(spireonDevices.externalId, device.deviceId)
        ),
      })

      if (!existing) {
        console.log(`Device ${device.deviceId} not in database, skipping`)
        continue
      }

      // Parse and validate timestamp
      const recordedAtStr = device.lastLocation.recordedAt
      let recordedAt: Date | null = null
      if (recordedAtStr) {
        const parsed = new Date(recordedAtStr)
        if (!isNaN(parsed.getTime())) {
          recordedAt = parsed
        }
      }

      // Check if location changed
      const locChanged =
        existing.currentLat !== device.lastLocation.lat ||
        existing.currentLng !== device.lastLocation.lng

      if (!locChanged && existing.currentLocationAt && recordedAt) {
        const lastLocTime = recordedAt.getTime()
        const dbLocTime = existing.currentLocationAt.getTime()
        if (Math.abs(lastLocTime - dbLocTime) < 60000) {
          // Same location, skip
          stats.devicesUnchanged++
          continue
        }
      }

      // Parse lastCommunication timestamp
      let lastCommunication: Date | null = null
      if (device.lastCommunication) {
        const parsed = new Date(device.lastCommunication)
        if (!isNaN(parsed.getTime())) {
          lastCommunication = parsed
        }
      }

      // Check if vehicle is at shop
      const atShop = device.lastLocation.lat != null && device.lastLocation.lng != null
        ? isAtShop(device.lastLocation.lat, device.lastLocation.lng)
        : false

      // Update device's current location
      const updateData: Record<string, unknown> = {
        isOnline: device.isOnline,
        lastCommunication,
        currentLat: device.lastLocation.lat,
        currentLng: device.lastLocation.lng,
        currentSpeed: device.lastLocation.speed?.toString() || null,
        currentHeading: device.lastLocation.heading || null,
        currentAddress: device.lastLocation.address || null,
        currentLocationAt: recordedAt,
        ignitionOn: device.lastLocation.ignitionOn || false,
        lastSeenAt: now,
        syncedAt: now,
      }

      // Set lastAtShopAt if vehicle is currently at shop
      if (atShop && recordedAt) {
        updateData.lastAtShopAt = recordedAt
      }

      await db.update(spireonDevices)
        .set(updateData)
        .where(eq(spireonDevices.id, existing.id))

      stats.devicesUpdated++

      // Insert location record (only if we have a valid recordedAt timestamp)
      if (recordedAt) {
        try {
          await db.insert(spireonLocations).values({
            integrationAccountId,
            deviceId: existing.id,
            lat: device.lastLocation.lat,
            lng: device.lastLocation.lng,
            altitude: device.lastLocation.altitude?.toString() || null,
            speed: device.lastLocation.speed?.toString() || null,
            heading: device.lastLocation.heading || null,
            address: device.lastLocation.address,
            city: device.lastLocation.city,
            state: device.lastLocation.state,
            zipCode: device.lastLocation.zipCode,
            eventType: device.lastLocation.eventType || 'poll',
            recordedAt,
            receivedAt: now,
            raw: device.lastLocation.raw,
            firstSeenAt: now,
            syncedAt: now,
          })
          stats.locationsCreated++
        } catch (error) {
          // Skip duplicate locations
          if (!(error instanceof Error && error.message.includes('duplicate'))) {
            throw error
          }
        }
      }
    } catch (error) {
      console.error(`Error updating location for device ${device.deviceId}:`, error)
      stats.errors++
    }
  }

  console.log('Location poll complete:', stats)
  return stats
}

/**
 * Backfill historical locations for all devices
 */
export async function backfillLocations(
  config: SpireonSyncConfig,
  options: { startDate: Date; endDate: Date; maxDevices?: number }
): Promise<SyncStats> {
  const { db, integrationAccountId, schema } = config
  const { spireonDevices } = schema

  const stats: SyncStats = {
    devicesCreated: 0,
    devicesUpdated: 0,
    devicesUnchanged: 0,
    geofencesCreated: 0,
    geofencesUpdated: 0,
    locationsCreated: 0,
    errors: 0,
  }

  console.log(`Backfilling locations from ${options.startDate.toISOString()} to ${options.endDate.toISOString()}`)

  // Get all devices from database
  const devices = await db.query.spireonDevices.findMany({
    where: eq(spireonDevices.integrationAccountId, integrationAccountId),
    limit: options.maxDevices || 300,
  })

  console.log(`Found ${devices.length} devices to backfill`)

  for (const device of devices) {
    try {
      console.log(`Backfilling locations for device ${device.name} (${device.externalId})...`)

      const locationStats = await syncDeviceLocations(
        config,
        device.id,
        device.externalId,
        options.startDate,
        options.endDate
      )

      stats.locationsCreated += locationStats.locationsCreated
      stats.errors += locationStats.errors

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))
    } catch (error) {
      console.error(`Error backfilling device ${device.externalId}:`, error)
      stats.errors++
    }
  }

  console.log('Backfill complete:', stats)
  return stats
}

export interface TimelineEventConfig {
  timelineEvents: any
  timelineEventLinks: any
  coreVehicles: any
  tenants: any
}

export interface TimelineStats {
  eventsCreated: number
  linksCreated: number
  errors: number
}

/**
 * Generate timeline events from Spireon locations
 * Creates events for significant location changes, ignition events, etc.
 */
export async function generateTimelineEvents(
  config: SpireonSyncConfig & { timelineConfig: TimelineEventConfig; tenantId: string }
): Promise<TimelineStats> {
  const { db, integrationAccountId, schema, timelineConfig, tenantId } = config
  const { spireonLocations, spireonDevices } = schema
  const { timelineEvents, timelineEventLinks, coreVehicles } = timelineConfig

  const stats: TimelineStats = {
    eventsCreated: 0,
    linksCreated: 0,
    errors: 0,
  }

  console.log('Generating timeline events from Spireon locations...')

  // Get locations that don't have timeline events yet
  // We look for locations from the last 24 hours to catch up
  const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const locations = await db.select({
    locationId: spireonLocations.id,
    deviceId: spireonLocations.deviceId,
    lat: spireonLocations.lat,
    lng: spireonLocations.lng,
    address: spireonLocations.address,
    city: spireonLocations.city,
    state: spireonLocations.state,
    eventType: spireonLocations.eventType,
    recordedAt: spireonLocations.recordedAt,
    speed: spireonLocations.speed,
    deviceName: spireonDevices.name,
    vehicleVin: spireonDevices.vehicleVin,
    vehicleMake: spireonDevices.vehicleMake,
    vehicleModel: spireonDevices.vehicleModel,
    vehicleYear: spireonDevices.vehicleYear,
  })
    .from(spireonLocations)
    .innerJoin(spireonDevices, eq(spireonLocations.deviceId, spireonDevices.id))
    .where(
      and(
        eq(spireonLocations.integrationAccountId, integrationAccountId),
        gte(spireonLocations.recordedAt, cutoffDate)
      )
    )
    .orderBy(spireonLocations.recordedAt)

  console.log(`Found ${locations.length} locations to process`)

  // Group by device to detect ignition changes
  const deviceLocations = new Map<string, typeof locations>()
  for (const loc of locations) {
    const existing = deviceLocations.get(loc.deviceId)
    if (existing) {
      existing.push(loc)
    } else {
      deviceLocations.set(loc.deviceId, [loc])
    }
  }

  // Process each device's locations
  for (const [deviceId, locs] of deviceLocations) {
    // Skip if only one location (can't detect changes)
    if (locs.length < 1) continue

    const firstLoc = locs[0]
    if (!firstLoc) continue

    try {
      // Check if we already have a timeline event for this device today
      const existingEvents = await db.select({ id: timelineEvents.id })
        .from(timelineEvents)
        .where(
          and(
            eq(timelineEvents.source, 'spireon'),
            eq(timelineEvents.sourceEntityId, deviceId),
            gte(timelineEvents.occurredAt, cutoffDate)
          )
        )
        .limit(1)

      if (existingEvents.length > 0) {
        // Already have events for this device today, skip
        continue
      }

      // Generate location summary event for the device
      const latestLoc = locs[locs.length - 1]
      if (!latestLoc) continue
      const addressParts = [latestLoc.address, latestLoc.city, latestLoc.state].filter(Boolean)
      const locationStr = addressParts.join(', ') || `${latestLoc.lat.toFixed(4)}, ${latestLoc.lng.toFixed(4)}`

      // Determine event type based on eventType field
      let eventType: string = 'spireon_location'
      const locEventType = latestLoc.eventType?.toLowerCase() || ''
      if (locEventType.includes('ignition_on') || locEventType.includes('start')) {
        eventType = 'spireon_ignition_on'
      } else if (locEventType.includes('ignition_off') || locEventType.includes('stop')) {
        eventType = 'spireon_ignition_off'
      }

      const vehicleDesc = [
        latestLoc.vehicleYear,
        latestLoc.vehicleMake,
        latestLoc.vehicleModel,
      ].filter(Boolean).join(' ')

      const title = eventType === 'spireon_ignition_on'
        ? `${latestLoc.deviceName || vehicleDesc} started`
        : eventType === 'spireon_ignition_off'
        ? `${latestLoc.deviceName || vehicleDesc} stopped`
        : `${latestLoc.deviceName || vehicleDesc} location update`

      // Insert timeline event
      const [event] = await db.insert(timelineEvents).values({
        tenantId,
        eventType,
        source: 'spireon',
        sourceEntityType: 'spireon_location',
        sourceEntityId: deviceId,
        externalId: latestLoc.locationId,
        title,
        summary: `Last seen at ${locationStr}`,
        content: `${locs.length} location update(s). Current location: ${locationStr}`,
        metadata: {
          lat: latestLoc.lat,
          lng: latestLoc.lng,
          address: locationStr,
          speed: latestLoc.speed,
          vehicleVin: latestLoc.vehicleVin,
          deviceName: latestLoc.deviceName,
          locationCount: locs.length,
        },
        actorType: 'system',
        actorName: 'Spireon GPS',
        occurredAt: latestLoc.recordedAt,
        collapseGroupKey: `spireon-${deviceId}-${new Date(latestLoc.recordedAt).toISOString().slice(0, 10)}`,
      }).returning()

      stats.eventsCreated++

      // Try to link to core_vehicle if VIN matches
      if (latestLoc.vehicleVin && event) {
        const vehicles = await db.select({ id: coreVehicles.id })
          .from(coreVehicles)
          .where(eq(coreVehicles.vin, latestLoc.vehicleVin.toLowerCase()))
          .limit(1)

        const vehicle = vehicles[0]
        if (vehicle) {
          await db.insert(timelineEventLinks).values({
            timelineEventId: event.id,
            entityType: 'vehicle',
            entityId: vehicle.id,
            linkType: 'primary',
          })
          stats.linksCreated++
        }
      }
    } catch (error) {
      console.error(`Error creating timeline event for device ${deviceId}:`, error)
      stats.errors++
    }
  }

  console.log('Timeline event generation complete:', stats)
  return stats
}

/**
 * Get Spireon integration account from database
 */
export async function getSpireonIntegrationAccount(
  db: DrizzleDB,
  tenantId: string,
  schema: { integrationAccounts: any }
): Promise<{ id: string; credentials: Record<string, string> } | null> {
  const { integrationAccounts } = schema

  const accounts = await db.select()
    .from(integrationAccounts)
    .where(
      and(
        eq(integrationAccounts.tenantId, tenantId),
        eq(integrationAccounts.type, 'spireon'),
        eq(integrationAccounts.isActive, true)
      )
    )
    .limit(1)

  const account = accounts[0]
  if (!account) {
    return null
  }

  return {
    id: account.id,
    credentials: account.credentials as Record<string, string>,
  }
}
