import { db } from '../packages/db/src/index.js'
import {
  gmailAccounts,
  gmailMessages,
  gmailThreads,
  gmailAttachments,
  coreCustomers,
  hqCustomers,
  mondayItems,
  timelineEvents,
  embeddings,
  spireonLocations,
  hqVehicles,
  coreVehicles
} from '../packages/db/src/schema/index.js'
import { sql } from 'drizzle-orm'

async function getCounts() {
  const counts = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(gmailAccounts).then(r => ({ name: 'Gmail Accounts', count: Number(r[0].count) })),
    db.select({ count: sql<number>`count(*)` }).from(gmailMessages).then(r => ({ name: 'Gmail Messages', count: Number(r[0].count) })),
    db.select({ count: sql<number>`count(*)` }).from(gmailThreads).then(r => ({ name: 'Gmail Threads', count: Number(r[0].count) })),
    db.select({ count: sql<number>`count(*)` }).from(gmailAttachments).then(r => ({ name: 'Gmail Attachments', count: Number(r[0].count) })),
    db.select({ count: sql<number>`count(*)` }).from(coreCustomers).then(r => ({ name: 'Core Customers', count: Number(r[0].count) })),
    db.select({ count: sql<number>`count(*)` }).from(hqCustomers).then(r => ({ name: 'HQ Customers', count: Number(r[0].count) })),
    db.select({ count: sql<number>`count(*)` }).from(coreVehicles).then(r => ({ name: 'Core Vehicles', count: Number(r[0].count) })),
    db.select({ count: sql<number>`count(*)` }).from(hqVehicles).then(r => ({ name: 'HQ Vehicles', count: Number(r[0].count) })),
    db.select({ count: sql<number>`count(*)` }).from(mondayItems).then(r => ({ name: 'Monday Items', count: Number(r[0].count) })),
    db.select({ count: sql<number>`count(*)` }).from(timelineEvents).then(r => ({ name: 'Timeline Events', count: Number(r[0].count) })),
    db.select({ count: sql<number>`count(*)` }).from(embeddings).then(r => ({ name: 'AI Embeddings', count: Number(r[0].count) })),
    db.select({ count: sql<number>`count(*)` }).from(spireonLocations).then(r => ({ name: 'Spireon Locations (GPS points)', count: Number(r[0].count) })),
  ])

  console.log('\n=== MRST Database Counts ===\n')
  counts.sort((a, b) => b.count - a.count)
  counts.forEach(({ name, count }) => {
    console.log(`${name.padEnd(35)} ${count.toLocaleString()}`)
  })

  // Get email accounts breakdown
  const emailAccounts = await db.select({
    email: gmailAccounts.email,
    messageCount: sql<number>`count(${gmailMessages.id})`
  })
  .from(gmailAccounts)
  .leftJoin(gmailMessages, sql`${gmailMessages.accountId} = ${gmailAccounts.id}`)
  .groupBy(gmailAccounts.email)
  .orderBy(sql`count(${gmailMessages.id}) desc`)

  console.log('\n=== Email Accounts ===\n')
  emailAccounts.forEach(({ email, messageCount }) => {
    console.log(`${email.padEnd(40)} ${Number(messageCount).toLocaleString()} messages`)
  })

  process.exit(0)
}

getCounts()
