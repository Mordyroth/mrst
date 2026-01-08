/**
 * Test Spireon API connection
 * Run with: npx tsx packages/integrations/src/spireon/test-client.ts
 *
 * Uses Basic Auth + X-Nspire-AppToken header (matching archive implementation)
 */

import { createSpireonClient, SpireonConfig } from './client'

// Hardcoded config for testing (from API_CREDENTIALS.md)
const config: SpireonConfig = {
  identityUrl: 'https://identity.spireon.com/identity/token',
  restUrl: 'https://services.spireon.com/v0/rest',
  appToken: 'fb086736-9a8b-42f5-85b5-2852bdea37a1',
  username: 'Spireonintegration@PlatinumCarRental.com',
  password: 'TAh!3!Tsw3G!',
  nspireId: '305091',
}

async function main() {
  console.log('=== Spireon API Test ===\n')
  console.log('Using Basic Auth + X-Nspire-AppToken (matching archive)\n')

  const client = createSpireonClient(config)

  try {
    // Test getting assets (devices)
    console.log('Fetching assets...')
    const { content: assets, total } = await client.getAssets({ limit: 50 })
    console.log(`Found ${assets.length} assets (total: ${total})\n`)

    if (assets.length > 0) {
      console.log('First 5 assets:')
      for (const asset of assets.slice(0, 5)) {
        console.log(`  - ${asset.deviceName || asset.vehicleName} (ID: ${asset.deviceId})`)
        console.log(`    Vehicle: ${asset.vehicleYear} ${asset.vehicleMake} ${asset.vehicleModel}`)
        console.log(`    VIN: ${asset.vehicleVin}`)
        console.log(`    Status: ${asset.status}, Online: ${asset.isOnline}`)
        if (asset.lastLocation) {
          console.log(`    Last location: ${asset.lastLocation.lat}, ${asset.lastLocation.lng}`)
          console.log(`    Address: ${asset.lastLocation.address || 'N/A'}`)
        }
        console.log('')
      }

      // Test getting location history for first asset
      const firstAsset = assets[0]
      if (firstAsset) {
        console.log(`\nFetching location history for ${firstAsset.deviceName || firstAsset.vehicleName}...`)
        const endDate = new Date()
        const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000) // Last 24 hours

        try {
          const locations = await client.getDeviceLocations(firstAsset.deviceId, startDate, endDate)
          console.log(`Found ${locations.length} location records in last 24 hours`)

          if (locations.length > 0) {
            console.log('\nFirst 3 locations:')
            for (const loc of locations.slice(0, 3)) {
              console.log(`  - ${loc.recordedAt}: ${loc.lat}, ${loc.lng}`)
              console.log(`    Speed: ${loc.speed} mph, Heading: ${loc.heading}°`)
              console.log(`    Event: ${loc.eventType}, Ignition: ${loc.ignitionOn}`)
            }
          }
        } catch (err: any) {
          console.log(`  Location history error: ${err.message}`)
        }
      }
    }

    // Test getting geofences
    console.log('\n\nFetching geofences...')
    try {
      const geofences = await client.getGeofences()
      console.log(`Found ${geofences.length} geofences`)

      for (const gf of geofences.slice(0, 5)) {
        console.log(`  - ${gf.name} (${gf.type})`)
        if (gf.type === 'circle' && gf.centerLat && gf.centerLng) {
          console.log(`    Center: ${gf.centerLat}, ${gf.centerLng}, Radius: ${gf.radiusMeters}m`)
        }
      }
    } catch (err: any) {
      console.log(`  Geofences error: ${err.message}`)
    }

    // Test getting alerts
    console.log('\n\nFetching recent alerts...')
    try {
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      const alerts = await client.getAlerts(startDate, endDate)
      console.log(`Found ${alerts.length} alerts in last 7 days`)

      for (const alert of alerts.slice(0, 5)) {
        console.log(`  - ${alert.alertType}: ${alert.message}`)
        console.log(`    Device: ${alert.deviceName}, Time: ${alert.occurredAt}`)
      }
    } catch (err: any) {
      console.log(`  Alerts error: ${err.message}`)
    }

    console.log('\n\nTest complete!')

  } catch (err: any) {
    console.error('\nError:', err.message)
    if (err.message.includes('401')) {
      console.error('\nAuthentication failed (401).')
      console.error('Tried: Basic Auth + X-Nspire-AppToken header')
      console.error('Check if credentials are still valid.')
    }
  }
}

main().catch(console.error)
