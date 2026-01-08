/**
 * Spireon Sync Service
 *
 * Syncs devices (assets) from Spireon to the database
 */

import { eq, and } from 'drizzle-orm'
import * as crypto from 'crypto'
import type { SpireonClient, SpireonDevice, SpireonGeofence } from './client'

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
