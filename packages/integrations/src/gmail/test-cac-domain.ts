/**
 * Test certifiedautocollision.com domain access
 */

import { createGmailClient } from './client'

const EMAILS_TO_TRY = [
  'claims@certifiedautocollision.com',
  'office@certifiedautocollision.com',
  'moishy@certifiedautocollision.com',
]

async function main() {
  console.log('=== Testing certifiedautocollision.com Domain Access ===\n')

  for (const email of EMAILS_TO_TRY) {
    console.log(`\nTrying: ${email}`)
    console.log('-'.repeat(50))

    try {
      const client = await createGmailClient({ userEmail: email })
      const profile = await client.gmail.users.getProfile({ userId: 'me' })

      console.log('SUCCESS!')
      console.log(`  Email: ${profile.data.emailAddress}`)
      console.log(`  Messages: ${profile.data.messagesTotal}`)
      console.log(`  Threads: ${profile.data.threadsTotal}`)
      console.log(`  History ID: ${profile.data.historyId}`)

    } catch (err: any) {
      console.log('FAILED!')
      console.log(`  Error: ${err.message}`)

      // Extract more details if available
      if (err.response?.data) {
        console.log(`  Details: ${JSON.stringify(err.response.data)}`)
      }
      if (err.code) {
        console.log(`  Code: ${err.code}`)
      }
    }
  }

  console.log('\n\nTest complete!')
}

main().catch(console.error)
