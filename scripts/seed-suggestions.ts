/**
 * Seed AI Suggestions
 * Creates sample AI task suggestions for testing the UI
 */

import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { aiTasks, tenants } from '../packages/db/src/schema'
import { eq } from 'drizzle-orm'

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://mrst:mrst_dev_2025@localhost:5432/mrst',
  })

  const db = drizzle(pool)

  // Get the first tenant
  const [tenant] = await db.select().from(tenants).limit(1)
  if (!tenant) {
    console.error('No tenant found. Please run the database seed first.')
    process.exit(1)
  }

  console.log(`Using tenant: ${tenant.name} (${tenant.id})`)

  // Sample suggestions
  const suggestions = [
    // High priority
    {
      tenantId: tenant.id,
      taskType: 'action_required',
      priority: 'high',
      title: 'Urgent: Vehicle pickup tomorrow - John Smith',
      description: 'Reservation #R-2024-1234 is scheduled for pickup tomorrow at 9:00 AM. Vehicle needs to be prepared.',
      reasoning: 'Pickup date is within 24 hours and vehicle status shows it needs cleaning',
      status: 'pending',
    },
    {
      tenantId: tenant.id,
      taskType: 'action_required',
      priority: 'high',
      title: 'Overdue return: 2023 Toyota Camry',
      description: 'Contract #C-2024-5678 was due back 2 days ago. Customer Maria Garcia has not responded to calls.',
      reasoning: 'Return date has passed and no extension has been requested',
      status: 'pending',
    },
    {
      tenantId: tenant.id,
      taskType: 'follow_up',
      priority: 'high',
      title: 'Unanswered inquiry about collision estimate',
      description: 'Email from insurance@statefarm.com requesting updated estimate for claim #CLM-9876.',
      reasoning: 'Email marked as urgent and has been waiting 3 days without response',
      status: 'pending',
    },
    // Medium priority
    {
      tenantId: tenant.id,
      taskType: 'follow_up',
      priority: 'medium',
      title: 'Follow up on rental extension request',
      description: 'Customer David Lee requested an extension for his rental. Awaiting credit card authorization.',
      reasoning: 'Extension request received 2 days ago with no follow-up action',
      status: 'pending',
    },
    {
      tenantId: tenant.id,
      taskType: 'opportunity',
      priority: 'medium',
      title: 'Potential upsell: Add insurance to reservation',
      description: 'Customer Sarah Johnson has a reservation without insurance coverage for a luxury vehicle.',
      reasoning: 'High-value rental without protection - common upsell opportunity',
      status: 'pending',
    },
    {
      tenantId: tenant.id,
      taskType: 'anomaly',
      priority: 'medium',
      title: 'Unusual GPS pattern: 2022 Honda Accord',
      description: 'Vehicle has been stationary at unknown location for 5 days. Not at registered customer address.',
      reasoning: 'GPS tracking shows no movement and location differs from customer profile',
      status: 'pending',
    },
    {
      tenantId: tenant.id,
      taskType: 'follow_up',
      priority: 'medium',
      title: 'Pending estimate approval',
      description: 'Collision estimate for 2021 BMW X5 sent to Progressive 4 days ago. No response yet.',
      reasoning: 'Insurance estimates typically require follow-up after 3 business days',
      status: 'pending',
    },
    // Low priority
    {
      tenantId: tenant.id,
      taskType: 'opportunity',
      priority: 'low',
      title: 'Repeat customer birthday coming up',
      description: 'Long-term customer Michael Brown has a birthday next week. Consider sending a discount offer.',
      reasoning: 'Customer has rented 12 times in the past year - loyalty opportunity',
      status: 'pending',
    },
    {
      tenantId: tenant.id,
      taskType: 'anomaly',
      priority: 'low',
      title: 'Stationary vehicle at shop for 10+ days',
      description: '2020 Ford F-150 has been at the shop location for 12 days without status update.',
      reasoning: 'Repair jobs typically complete within 7-10 days',
      status: 'pending',
    },
    {
      tenantId: tenant.id,
      taskType: 'follow_up',
      priority: 'low',
      title: 'Request customer review',
      description: 'Customer Emily Davis completed a rental last week with positive feedback. Request Google review.',
      reasoning: 'Happy customers often willing to leave reviews if asked promptly',
      status: 'pending',
    },
    // Already acknowledged (for testing tabs)
    {
      tenantId: tenant.id,
      taskType: 'action_required',
      priority: 'high',
      title: 'Acknowledged: Update fleet insurance',
      description: 'Annual fleet insurance renewal is due in 2 weeks.',
      reasoning: 'Insurance renewal date approaching',
      status: 'acknowledged',
      acknowledgedAt: new Date(),
    },
    // Completed (for testing tabs)
    {
      tenantId: tenant.id,
      taskType: 'follow_up',
      priority: 'medium',
      title: 'Completed: Customer callback',
      description: 'Called customer regarding their inquiry about long-term rental rates.',
      reasoning: 'Customer requested callback in voicemail',
      status: 'completed',
      completedAt: new Date(),
    },
  ]

  console.log(`Inserting ${suggestions.length} sample suggestions...`)

  // Clear existing suggestions for this tenant
  await db.delete(aiTasks).where(eq(aiTasks.tenantId, tenant.id))

  // Insert new suggestions
  for (const suggestion of suggestions) {
    await db.insert(aiTasks).values(suggestion as any)
  }

  console.log('Done! Sample AI suggestions created.')
  await pool.end()
}

main().catch(console.error)
