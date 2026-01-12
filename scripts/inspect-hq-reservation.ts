/**
 * Inspect a single HQ reservation to understand vehicle data structure
 */

const BASE_URL = 'https://api-america-3.caagcrm.com/api-america-3'
const TENANT_TOKEN = 'A50uV6M0jDUcM1ehJsF6kh1YtFfNXkSrDQvqEaJJnPrk3dwFeW'
const USER_TOKEN = 'jLwBdr7fMzbrl54elfwm6Um4DqSYcbxGHhTSmYOI72CrowvUSO'

const authToken = Buffer.from(`${TENANT_TOKEN}:${USER_TOKEN}`).toString('base64')

async function main() {
  // First get a list of reservations with status 'rental' (active)
  console.log('=== Fetching active rentals ===')

  const listRes = await fetch(`${BASE_URL}/car-rental/reservations?status=rental&per_page=5`, {
    headers: {
      'Authorization': `Basic ${authToken}`,
      'Accept': 'application/json',
    },
  })

  const listData = await listRes.json()
  console.log(`Active rentals total: ${listData.total}`)
  console.log(`Sample reservation IDs: ${listData.data?.slice(0, 3).map((r: any) => r.id).join(', ')}`)

  if (!listData.data?.[0]) {
    console.log('No active rentals found')
    return
  }

  // Get full details of one reservation
  const resId = listData.data[0].id
  console.log(`\n=== Fetching full details for reservation ${resId} ===`)

  const detailRes = await fetch(`${BASE_URL}/car-rental/reservations/${resId}`, {
    headers: {
      'Authorization': `Basic ${authToken}`,
      'Accept': 'application/json',
    },
  })

  const detailData = await detailRes.json()
  const data = detailData.data

  console.log('\n--- Reservation Info ---')
  console.log(`ID: ${data.reservation?.id}`)
  console.log(`Status: ${data.reservation?.status}`)
  console.log(`Customer ID: ${data.customer?.id}`)

  console.log('\n--- Customer ---')
  if (data.customer) {
    console.log(`ID: ${data.customer.id}`)
    console.log(`Label: ${data.customer.label}`)
    console.log(`Email: ${data.customer.email}`)
    console.log(`Phone: ${data.customer.phone_number}`)
  }

  console.log('\n--- Vehicles from reservation ---')
  if (data.vehicles && Array.isArray(data.vehicles)) {
    for (const rv of data.vehicles) {
      console.log(`\nReservation Vehicle:`)
      console.log(`  Active: ${rv.active}`)
      if (rv.vehicle) {
        console.log(`  Vehicle ID: ${rv.vehicle.id}`)
        console.log(`  Label: ${rv.vehicle.label}`)
        console.log(`  Plate: ${rv.vehicle.plate}`)
        console.log(`  VIN: ${rv.vehicle.vin || 'N/A'}`)
        console.log(`  Color: ${rv.vehicle.color}`)
        console.log(`  Odometer: ${rv.vehicle.odometer}`)
        console.log(`  Fuel: ${rv.vehicle.fuel_level}`)
        console.log(`  Vehicle keys: ${Object.keys(rv.vehicle).join(', ')}`)
      }
    }
  }

  console.log('\n--- Active Vehicle Information ---')
  if (data.active_vehicle_information) {
    console.log(JSON.stringify(data.active_vehicle_information, null, 2).substring(0, 500))
  }

  console.log('\n--- Reservation Vehicle Information ---')
  if (data.reservation_vehicle_information) {
    console.log(JSON.stringify(data.reservation_vehicle_information, null, 2).substring(0, 500))
  }

  console.log('\n--- Vehicle Class ---')
  if (data.selected_vehicle_class?.vehicle_class) {
    const vc = data.selected_vehicle_class.vehicle_class
    console.log(`Label: ${vc.label}`)
    console.log(`Description: ${vc.short_description}`)
  }

  // Also fetch a cancelled/completed reservation to see all vehicle states
  console.log('\n\n=== Checking different reservation statuses ===')

  const statuses = ['completed', 'cancelled', 'pending', 'quote']
  for (const status of statuses) {
    const res = await fetch(`${BASE_URL}/car-rental/reservations?status=${status}&per_page=1`, {
      headers: {
        'Authorization': `Basic ${authToken}`,
        'Accept': 'application/json',
      },
    })
    const data = await res.json()
    console.log(`${status}: ${data.total} total`)
    await new Promise(r => setTimeout(r, 100))
  }
}

main().catch(console.error)
