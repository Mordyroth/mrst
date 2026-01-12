/**
 * Test HQ API endpoints to discover available resources
 */

const BASE_URL = 'https://api-america-3.caagcrm.com/api-america-3'
const TENANT_TOKEN = 'A50uV6M0jDUcM1ehJsF6kh1YtFfNXkSrDQvqEaJJnPrk3dwFeW'
const USER_TOKEN = 'jLwBdr7fMzbrl54elfwm6Um4DqSYcbxGHhTSmYOI72CrowvUSO'

const authToken = Buffer.from(`${TENANT_TOKEN}:${USER_TOKEN}`).toString('base64')

async function testEndpoint(path: string): Promise<void> {
  const url = `${BASE_URL}${path}`
  console.log(`\n=== Testing: ${path} ===`)

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${authToken}`,
        'Accept': 'application/json',
      },
    })

    const text = await response.text()
    let data: any
    try {
      data = JSON.parse(text)
    } catch {
      console.log(`Status: ${response.status}`)
      console.log(`Response (not JSON): ${text.substring(0, 200)}...`)
      return
    }

    console.log(`Status: ${response.status}`)
    console.log(`Success: ${data.success}`)

    if (data.total !== undefined) {
      console.log(`Total: ${data.total}`)
    }

    if (data.errors && data.errors.length > 0) {
      console.log(`Errors: ${JSON.stringify(data.errors)}`)
    }

    if (data.data && Array.isArray(data.data)) {
      console.log(`Data count: ${data.data.length}`)
      if (data.data[0]) {
        console.log(`First item keys: ${Object.keys(data.data[0]).join(', ')}`)
      }
    } else if (data.data && typeof data.data === 'object') {
      console.log(`Data keys: ${Object.keys(data.data).join(', ')}`)
    }

  } catch (err) {
    console.log(`Error: ${(err as Error).message}`)
  }
}

async function main() {
  console.log('=== HQ API Endpoint Discovery ===')
  console.log(`Base URL: ${BASE_URL}`)

  // Test various potential endpoints
  const endpoints = [
    // Vehicles / Fleet
    '/car-rental/vehicles',
    '/car-rental/vehicles?per_page=5',
    '/car-rental/fleet',
    '/car-rental/fleet?per_page=5',
    '/vehicles',
    '/fleet',

    // Customers / Contacts
    '/customers',
    '/customers?per_page=5',
    '/contacts',
    '/contacts?per_page=5',

    // Reservations (we know this works)
    '/car-rental/reservations?per_page=1',

    // Other potential endpoints
    '/car-rental/contracts',
    '/car-rental/locations',
    '/car-rental/vehicle-classes',
    '/car-rental/brands',
    '/settings',
    '/users',
  ]

  for (const endpoint of endpoints) {
    await testEndpoint(endpoint)
    // Small delay between requests
    await new Promise(r => setTimeout(r, 200))
  }
}

main().catch(console.error)
