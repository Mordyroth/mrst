/**
 * Debug Spireon API response
 */

import { createSpireonClient } from './client'

async function main() {
  const client = createSpireonClient({
    appToken: 'fb086736-9a8b-42f5-85b5-2852bdea37a1',
    username: 'Spireonintegration@PlatinumCarRental.com',
    password: 'TAh!3!Tsw3G!',
    nspireId: '305091',
  })

  // Get devices
  const result = await client.getAssets({ limit: 250 })
  console.log('Total devices:', result.total)

  // Look for devices with location
  const withLocation = result.content.filter(d => d.lastLocation !== null)
  console.log('Devices with location:', withLocation.length)

  // Find active devices
  const active = result.content.filter(d => (d.raw as any).active === true)
  console.log('Active devices:', active.length)

  if (active.length > 0) {
    console.log('\nSample active device raw:')
    console.log(JSON.stringify(active[0].raw, null, 2))
  }

  // Try getting device info directly
  if (result.content.length > 0) {
    const deviceId = result.content[0].deviceId
    console.log('\nTrying to get device directly:', deviceId)
    try {
      const device = await client.getDevice(deviceId)
      console.log('Device info:', JSON.stringify(device, null, 2))
    } catch (err) {
      console.log('Error getting device:', (err as Error).message)
    }
  }
}

main().catch(console.error)
