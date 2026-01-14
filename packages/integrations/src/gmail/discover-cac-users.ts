/**
 * Discover all users in certifiedautocollision.com domain
 * Uses Admin SDK to list users
 */

import { google } from 'googleapis'
import * as fs from 'fs'

const SERVICE_ACCOUNT_PATH = '/home/ec2-user/projects/mrst/config/certified-service-account.json'
const DOMAIN = 'certifiedautocollision.com'

// Common email prefixes to try if Admin SDK doesn't work
const COMMON_PREFIXES = [
  'info', 'admin', 'claims', 'office', 'support', 'sales',
  'billing', 'accounting', 'parts', 'service', 'front',
  'manager', 'owner', 'general', 'contact', 'help',
  'reception', 'bodyshop', 'estimates', 'shop', 'main',
  // Names
  'moishy', 'yossi', 'eli', 'david', 'moshe', 'chaim', 'mendy', 'shlomo', 'yanky', 'aaron',
  // More departments
  'dispatch', 'repairs', 'tow', 'towing', 'rentals', 'insurance', 'hr', 'team',
  'bookings', 'orders', 'invoices', 'fleet', 'drivers', 'tech', 'it',
  // More common
  'hello', 'mail', 'email', 'desk', 'appointments', 'quotes', 'jobs',
]

async function discoverViaAdminSDK() {
  console.log('Trying Admin SDK to discover users...\n')

  const credentials = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'))

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [
      'https://www.googleapis.com/auth/admin.directory.user.readonly',
      'https://www.googleapis.com/auth/admin.directory.user',
    ],
    subject: 'claims@certifiedautocollision.com', // Admin user to impersonate
  })

  try {
    const admin = google.admin({ version: 'directory_v1', auth })
    const response = await admin.users.list({
      domain: DOMAIN,
      maxResults: 100,
    })

    if (response.data.users && response.data.users.length > 0) {
      console.log('Users found via Admin SDK:')
      for (const user of response.data.users) {
        console.log(`  - ${user.primaryEmail}`)
      }
      return response.data.users.map(u => u.primaryEmail!)
    } else {
      console.log('No users returned from Admin SDK')
      return null
    }
  } catch (err: any) {
    console.log(`Admin SDK failed: ${err.message}`)
    return null
  }
}

interface FoundEmail {
  email: string
  messages: number
  threads: number
}

async function testEmailAccess(email: string): Promise<FoundEmail | null> {
  const credentials = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'))

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://mail.google.com/'],
    subject: email,
  })

  try {
    const gmail = google.gmail({ version: 'v1', auth })
    const profile = await gmail.users.getProfile({ userId: 'me' })
    return {
      email: profile.data.emailAddress || email,
      messages: profile.data.messagesTotal || 0,
      threads: profile.data.threadsTotal || 0,
    }
  } catch {
    return null
  }
}

async function bruteForceDiscovery() {
  console.log('\nTrying common email prefixes...\n')

  const found: FoundEmail[] = []

  for (const prefix of COMMON_PREFIXES) {
    const email = `${prefix}@${DOMAIN}`
    process.stdout.write(`  Testing ${email}... `)

    const result = await testEmailAccess(email)
    if (result) {
      console.log(`FOUND! (${result.messages.toLocaleString()} msgs)`)
      found.push(result)
    } else {
      console.log('no')
    }
  }

  return found
}

async function main() {
  console.log('=== Discovering CAC Domain Users ===\n')

  // Try Admin SDK first
  const adminUsers = await discoverViaAdminSDK()

  if (!adminUsers) {
    // Fall back to brute force
    const foundEmails = await bruteForceDiscovery()

    console.log('\n=== Summary ===')
    console.log(`Found ${foundEmails.length} accessible emails:\n`)

    let totalMsgs = 0
    let totalThreads = 0
    for (const found of foundEmails) {
      console.log(`  ${found.email}`)
      console.log(`    Messages: ${found.messages.toLocaleString()}, Threads: ${found.threads.toLocaleString()}`)
      totalMsgs += found.messages
      totalThreads += found.threads
    }

    console.log(`\n  TOTAL: ${totalMsgs.toLocaleString()} messages, ${totalThreads.toLocaleString()} threads`)
  }
}

main().catch(console.error)
