/**
 * AI Suggestions
 *
 * "What should I do next?" feature - analyzes data and suggests actions
 */

import { sql, desc, and, eq, gt, isNull } from 'drizzle-orm'
import type { ClaudeClient } from './claude'

interface DrizzleDB {
  execute: (query: any) => Promise<{ rows: any[] }>
  query: any
  select: (fields?: unknown) => any
  insert: (table: any) => any
  update: (table: any) => any
}

interface SuggestionsConfig {
  db: DrizzleDB
  claude: ClaudeClient
  tenantId: string
  schema: {
    aiTasks: any
    timelineEvents?: any
    gmailMessages?: any
    hqReservations?: any
    coreCustomers?: any
    spireonDevices?: any
  }
}

interface Suggestion {
  type: 'follow_up' | 'action_required' | 'anomaly' | 'opportunity'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  reasoning: string
  relatedCustomerId?: string
  relatedVehicleId?: string
  relatedSources: Array<{ type: string; id: string }>
}

/**
 * Analyze recent emails for follow-up opportunities
 */
async function analyzeEmailsForFollowUps(config: SuggestionsConfig): Promise<Suggestion[]> {
  const { db, schema } = config
  const suggestions: Suggestion[] = []

  if (!schema.gmailMessages) return suggestions

  // Find emails from the last 3 days that might need follow-up
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

  try {
    const recentEmails = await db.query.gmailMessages.findMany({
      where: gt(schema.gmailMessages.receivedAt, threeDaysAgo),
      orderBy: [desc(schema.gmailMessages.receivedAt)],
      limit: 50,
    })

    // Look for patterns indicating needed follow-up
    for (const email of recentEmails) {
      const snippet = (email.snippet || '').toLowerCase()
      const subject = (email.subject || '').toLowerCase()

      // Check for questions without responses
      if (
        (snippet.includes('?') || subject.includes('?')) &&
        !email.labels?.includes('SENT')
      ) {
        suggestions.push({
          type: 'follow_up',
          priority: 'medium',
          title: `Unanswered email: ${email.subject?.substring(0, 50)}`,
          description: `Email from ${email.fromEmail} may need a response`,
          reasoning: 'Email contains a question and was not sent by you',
          relatedSources: [{ type: 'gmail_message', id: email.id }],
        })
      }

      // Check for urgent keywords
      if (
        subject.includes('urgent') ||
        subject.includes('asap') ||
        snippet.includes('urgent') ||
        snippet.includes('immediately')
      ) {
        suggestions.push({
          type: 'action_required',
          priority: 'high',
          title: `Urgent email: ${email.subject?.substring(0, 50)}`,
          description: `Marked as urgent from ${email.fromEmail}`,
          reasoning: 'Email contains urgent keywords',
          relatedSources: [{ type: 'gmail_message', id: email.id }],
        })
      }
    }
  } catch (error) {
    console.error('Error analyzing emails:', error)
  }

  return suggestions
}

/**
 * Analyze reservations for upcoming actions
 */
async function analyzeReservationsForActions(config: SuggestionsConfig): Promise<Suggestion[]> {
  const { db, schema } = config
  const suggestions: Suggestion[] = []

  if (!schema.hqReservations) return suggestions

  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  try {
    const upcomingReservations = await db.query.hqReservations.findMany({
      where: and(
        gt(schema.hqReservations.pickupDate, today),
        gt(schema.hqReservations.pickupDate, today) // Pickup is tomorrow
      ),
      limit: 20,
    })

    for (const reservation of upcomingReservations) {
      suggestions.push({
        type: 'action_required',
        priority: 'high',
        title: `Pickup tomorrow: ${reservation.customerName}`,
        description: `Reservation ${reservation.externalId} scheduled for pickup`,
        reasoning: 'Vehicle pickup is scheduled for tomorrow',
        relatedCustomerId: reservation.customerId,
        relatedVehicleId: reservation.vehicleId,
        relatedSources: [{ type: 'hq_reservation', id: reservation.id }],
      })
    }

    // Check for returns today
    const returnsToday = await db.query.hqReservations.findMany({
      where: and(
        eq(schema.hqReservations.status, 'active'),
        // Would need returnDate field
      ),
      limit: 20,
    })
  } catch (error) {
    console.error('Error analyzing reservations:', error)
  }

  return suggestions
}

/**
 * Analyze GPS data for anomalies
 */
async function analyzeGPSForAnomalies(config: SuggestionsConfig): Promise<Suggestion[]> {
  const { db, schema } = config
  const suggestions: Suggestion[] = []

  if (!schema.spireonDevices) return suggestions

  try {
    // Find vehicles that haven't moved in 7+ days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const stationaryDevices = await db.query.spireonDevices.findMany({
      where: and(
        isNull(schema.spireonDevices.deletedAt),
        gt(schema.spireonDevices.lastSeenAt, sevenDaysAgo) // Seen in last 7 days but not moved
      ),
      limit: 20,
    })

    for (const device of stationaryDevices) {
      if (device.vehicleVin) {
        suggestions.push({
          type: 'anomaly',
          priority: 'low',
          title: `Stationary vehicle: ${device.vehicleMake} ${device.vehicleModel}`,
          description: `${device.name} hasn't moved in over 7 days`,
          reasoning: 'Vehicle GPS shows no movement for extended period',
          relatedVehicleId: device.vehicleVin,
          relatedSources: [{ type: 'spireon_device', id: device.id }],
        })
      }
    }

    // Find vehicles with low battery (if tracked)
    const lowBatteryDevices = await db.query.spireonDevices.findMany({
      where: and(
        isNull(schema.spireonDevices.deletedAt),
        // Would check currentBatteryVoltage < 12.0
      ),
      limit: 10,
    })
  } catch (error) {
    console.error('Error analyzing GPS data:', error)
  }

  return suggestions
}

/**
 * Generate AI-powered suggestions using Claude
 */
async function generateAISuggestions(
  config: SuggestionsConfig,
  context: string
): Promise<Suggestion[]> {
  const { claude } = config

  const systemPrompt = `You are an AI assistant for a vehicle rental and collision repair business. Based on the context provided, suggest 2-3 actionable tasks the user should do next.

For each suggestion, provide:
- type: one of "follow_up", "action_required", "anomaly", "opportunity"
- priority: "high", "medium", or "low"
- title: short title (max 60 chars)
- description: brief description
- reasoning: why this action is suggested

Format your response as a JSON array.`

  try {
    const result = await claude.chat(
      [{ role: 'user', content: `Based on this context, what should I do next?\n\n${context}` }],
      { systemPrompt, maxTokens: 1024 }
    )

    // Parse JSON response
    const jsonMatch = result.content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return parsed.map((s: any) => ({
        type: s.type || 'action_required',
        priority: s.priority || 'medium',
        title: s.title || 'Action needed',
        description: s.description || '',
        reasoning: s.reasoning || '',
        relatedSources: [],
      }))
    }
  } catch (error) {
    console.error('Error generating AI suggestions:', error)
  }

  return []
}

/**
 * Get pending suggestions from the database
 */
export async function getPendingSuggestions(
  config: SuggestionsConfig,
  limit: number = 10
): Promise<any[]> {
  const { db, schema, tenantId } = config

  return db.query.aiTasks.findMany({
    where: and(
      eq(schema.aiTasks.tenantId, tenantId),
      eq(schema.aiTasks.status, 'pending')
    ),
    orderBy: [
      // High priority first
      sql`CASE WHEN priority = 'high' THEN 1 WHEN priority = 'medium' THEN 2 ELSE 3 END`,
      desc(schema.aiTasks.createdAt),
    ],
    limit,
  })
}

/**
 * Generate new suggestions by analyzing recent data
 */
export async function generateSuggestions(config: SuggestionsConfig): Promise<Suggestion[]> {
  console.log('Generating suggestions...')

  const allSuggestions: Suggestion[] = []

  // Analyze different data sources
  const emailSuggestions = await analyzeEmailsForFollowUps(config)
  allSuggestions.push(...emailSuggestions)

  const reservationSuggestions = await analyzeReservationsForActions(config)
  allSuggestions.push(...reservationSuggestions)

  const gpsSuggestions = await analyzeGPSForAnomalies(config)
  allSuggestions.push(...gpsSuggestions)

  // Deduplicate and sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  allSuggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  console.log(`Generated ${allSuggestions.length} suggestions`)
  return allSuggestions
}

/**
 * Save suggestions to the database
 */
export async function saveSuggestions(
  config: SuggestionsConfig,
  suggestions: Suggestion[]
): Promise<number> {
  const { db, schema, tenantId } = config
  let saved = 0

  for (const suggestion of suggestions) {
    try {
      await db.insert(schema.aiTasks).values({
        tenantId,
        taskType: suggestion.type,
        priority: suggestion.priority,
        title: suggestion.title,
        description: suggestion.description,
        reasoning: suggestion.reasoning,
        relatedCustomerId: suggestion.relatedCustomerId,
        relatedVehicleId: suggestion.relatedVehicleId,
        relatedSources: suggestion.relatedSources,
        status: 'pending',
      })
      saved++
    } catch (error) {
      // Skip duplicates
      console.error('Error saving suggestion:', error)
    }
  }

  return saved
}

/**
 * Acknowledge a suggestion (mark as seen)
 */
export async function acknowledgeSuggestion(
  config: SuggestionsConfig,
  taskId: string,
  userId?: string
): Promise<void> {
  const { db, schema } = config

  await db.update(schema.aiTasks)
    .set({
      status: 'acknowledged',
      acknowledgedBy: userId,
      acknowledgedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.aiTasks.id, taskId))
}

/**
 * Complete a suggestion
 */
export async function completeSuggestion(
  config: SuggestionsConfig,
  taskId: string
): Promise<void> {
  const { db, schema } = config

  await db.update(schema.aiTasks)
    .set({
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.aiTasks.id, taskId))
}

/**
 * Dismiss a suggestion
 */
export async function dismissSuggestion(
  config: SuggestionsConfig,
  taskId: string,
  reason?: string
): Promise<void> {
  const { db, schema } = config

  await db.update(schema.aiTasks)
    .set({
      status: 'dismissed',
      dismissedAt: new Date(),
      dismissReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(schema.aiTasks.id, taskId))
}
