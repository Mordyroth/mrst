/**
 * Direct Gmail access test (bypasses Admin SDK discovery)
 */

import { createGmailClient } from './client'

const TEST_EMAILS = [
  'info@travelautorental.com',
  'claims@certifiedautocollision.com',
]

async function main() {
  console.log('=== Direct Gmail Access Test ===\n')

  for (const email of TEST_EMAILS) {
    console.log(`Testing: ${email}`)
    try {
      const client = await createGmailClient({ userEmail: email })
      const profile = await client.gmail.users.getProfile({ userId: 'me' })
      console.log('  SUCCESS!')
      console.log(`  Email: ${profile.data.emailAddress}`)
      console.log(`  Total messages: ${profile.data.messagesTotal}`)
      console.log(`  Total threads: ${profile.data.threadsTotal}`)
    } catch (error: any) {
      console.log(`  FAILED: ${error.message}`)
      if (error.response?.data) {
        console.log(`  Error details: ${JSON.stringify(error.response.data)}`)
      }
    }
    console.log()
  }
}

main().catch(console.error)
