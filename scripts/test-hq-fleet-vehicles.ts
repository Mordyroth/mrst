/**
 * Test HQ /fleets/vehicles and /contacts endpoints
 */

const BASE_URL = 'https://api-america-3.caagcrm.com/api-america-3'
const TENANT_TOKEN = 'A50uV6M0jDUcM1ehJsF6kh1YtFfNXkSrDQvqEaJJnPrk3dwFeW'
const USER_TOKEN = 'jLwBdr7fMzbrl54elfwm6Um4DqSYcbxGHhTSmYOI72CrowvUSO'

const authToken = Buffer.from(`${TENANT_TOKEN}:${USER_TOKEN}`).toString('base64')

async function testEndpoint(path: string, description: string): Promise<any> {
  const url = `${BASE_URL}${path}`
  console.log(`\n=== ${description} ===`)
  console.log(`URL: ${url}`)

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${authToken}`,
        'Accept': 'application/json',
      },
    })

    const data = await response.json()

    console.log(`Status: ${response.status}`)
    console.log(`Success: ${data.success}`)

    if (data.total !== undefined) {
      console.log(`Total: ${data.total}`)
    }

    if (data.errors) {
      console.log(`Errors: ${JSON.stringify(data.errors)}`)
    }

    return data
  } catch (err) {
    console.log(`Error: ${(err as Error).message}`)
    return null
  }
}

async function main() {
  console.log('=== Testing HQ Fleet & Contacts Endpoints ===\n')

  // Test /fleets/vehicles - the key endpoint!
  const fleetData = await testEndpoint('/fleets/vehicles?limit=200&page=1', 'Fleet Vehicles List')

  if (fleetData?.success && fleetData.data) {
    console.log(`\n--- Fleet Vehicles Summary ---`)
    console.log(`Count: ${fleetData.data.length}`)

    if (fleetData.data[0]) {
      console.log(`\nFirst vehicle keys: ${Object.keys(fleetData.data[0]).join(', ')}`)
      console.log(`\nSample vehicles:`)
      for (const v of fleetData.data.slice(0, 5)) {
        console.log(`  - ID: ${v.id}, Label: ${v.label}, Plate: ${v.plate}, VIN: ${v.vin || 'N/A'}, Status: ${v.status || 'N/A'}`)
      }
    }
  }

  // Test /contacts
  const contactsData = await testEndpoint('/contacts?limit=100&page=1', 'Contacts List')

  if (contactsData?.success && contactsData.data) {
    console.log(`\n--- Contacts Summary ---`)
    console.log(`Count: ${contactsData.data.length}`)

    if (contactsData.data[0]) {
      console.log(`\nFirst contact keys: ${Object.keys(contactsData.data[0]).join(', ')}`)
      console.log(`\nSample contacts:`)
      for (const c of contactsData.data.slice(0, 3)) {
        console.log(`  - ID: ${c.id}, Name: ${c.label || c.full_name}, Email: ${c.email || 'N/A'}`)
      }
    }
  }

  // Test reservation statuses to understand the flow
  console.log('\n\n=== Reservation Status Counts ===')
  const statusRes = await testEndpoint('/car-rental/reservations?per_page=1', 'All Reservations')
  console.log(`Total reservations: ${statusRes?.total || 'N/A'}`)

  // Test for rental (active) status
  const rentalRes = await testEndpoint('/car-rental/reservations?status=rental&per_page=1', 'Active Rentals')
  if (rentalRes?.data?.[0]) {
    console.log(`Active rental count (from first page meta): check total field`)
  }
}

main().catch(console.error)
