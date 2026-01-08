/**
 * Timeline Event Generation Service
 * Creates timeline_events from various data sources
 */

import { eq, and, isNull, sql, desc } from 'drizzle-orm'
import {
  timelineEvents,
  timelineEventLinks,
  mondayUpdates,
  mondayReplies,
  mondayActivityLogs,
  mondayItems,
  mondayUsers,
  hqReservations,
  hqContracts,
  hqCustomers,
  externalLinks,
  type Database,
  type TimelineEventType,
} from '@mrst/db'

export interface GenerateContext {
  db: Database
  tenantId: string
  integrationAccountId: string
  onProgress?: (message: string, counts?: { created: number; skipped: number }) => void
}

interface GenerateResult {
  success: boolean
  created: number
  skipped: number
  error?: string
}

/**
 * Generate timeline events from Monday.com updates
 */
export async function generateFromMondayUpdates(
  ctx: GenerateContext
): Promise<GenerateResult> {
  let created = 0
  let skipped = 0

  try {
    ctx.onProgress?.('Fetching Monday updates without timeline events...')

    // Get updates that don't have timeline events yet
    const updates = await ctx.db
      .select({
        id: mondayUpdates.id,
        externalId: mondayUpdates.externalId,
        itemId: mondayUpdates.itemId,
        body: mondayUpdates.body,
        textBody: mondayUpdates.textBody,
        creatorId: mondayUpdates.creatorId,
        creatorName: mondayUpdates.creatorName,
        createdAtExternal: mondayUpdates.createdAtExternal,
      })
      .from(mondayUpdates)
      .leftJoin(
        timelineEvents,
        and(
          eq(timelineEvents.source, 'monday'),
          eq(timelineEvents.sourceEntityType, 'monday_update'),
          eq(timelineEvents.sourceEntityId, mondayUpdates.id)
        )
      )
      .where(
        and(
          eq(mondayUpdates.integrationAccountId, ctx.integrationAccountId),
          isNull(mondayUpdates.deletedAt),
          isNull(timelineEvents.id)
        )
      )
      .orderBy(desc(mondayUpdates.createdAtExternal))

    ctx.onProgress?.(`Found ${updates.length} Monday updates to process`)

    for (const update of updates) {
      try {
        // Get item info for context
        const itemResult = await ctx.db
          .select({ name: mondayItems.name, externalId: mondayItems.externalId })
          .from(mondayItems)
          .where(eq(mondayItems.id, update.itemId))
          .limit(1)
        const item = itemResult[0]

        // Create timeline event
        const eventResult = await ctx.db
          .insert(timelineEvents)
          .values({
            tenantId: ctx.tenantId,
            eventType: 'monday_update' as TimelineEventType,
            source: 'monday',
            sourceEntityType: 'monday_update',
            sourceEntityId: update.id,
            externalId: update.externalId,
            title: item ? `Update on ${item.name}` : 'Monday.com Update',
            summary: update.textBody?.substring(0, 200) ?? null,
            content: update.textBody,
            contentHtml: update.body,
            actorType: 'external',
            actorId: update.creatorId,
            actorName: update.creatorName,
            occurredAt: update.createdAtExternal || new Date(),
            collapseGroupKey: `monday_update_${update.itemId}`,
          })
          .returning({ id: timelineEvents.id })

        const event = eventResult[0]
        if (!event) continue

        // Link to item
        await ctx.db.insert(timelineEventLinks).values({
          timelineEventId: event.id,
          entityType: 'monday_item',
          entityId: update.itemId,
          linkType: 'primary',
        })

        // Try to link to core customer/vehicle via external_links
        const coreLinks = await ctx.db
          .select({
            entityType: externalLinks.entityType,
            entityId: externalLinks.entityId,
          })
          .from(externalLinks)
          .where(
            and(
              eq(externalLinks.source, 'monday'),
              eq(externalLinks.sourceEntityType, 'monday_item'),
              eq(externalLinks.sourceEntityId, update.itemId)
            )
          )

        for (const coreLink of coreLinks) {
          await ctx.db.insert(timelineEventLinks).values({
            timelineEventId: event.id,
            entityType: coreLink.entityType,
            entityId: coreLink.entityId,
            linkType: 'related',
          })
        }

        created++
      } catch (err) {
        console.error(`Error creating timeline event for update ${update.id}:`, err)
        skipped++
      }
    }

    ctx.onProgress?.(`Monday updates: ${created} created, ${skipped} skipped`, { created, skipped })
    return { success: true, created, skipped }
  } catch (error) {
    return { success: false, created, skipped, error: (error as Error).message }
  }
}

/**
 * Generate timeline events from Monday.com replies
 */
export async function generateFromMondayReplies(
  ctx: GenerateContext
): Promise<GenerateResult> {
  let created = 0
  let skipped = 0

  try {
    ctx.onProgress?.('Fetching Monday replies without timeline events...')

    const replies = await ctx.db
      .select({
        id: mondayReplies.id,
        externalId: mondayReplies.externalId,
        updateId: mondayReplies.updateId,
        body: mondayReplies.body,
        textBody: mondayReplies.textBody,
        creatorId: mondayReplies.creatorId,
        creatorName: mondayReplies.creatorName,
        createdAtExternal: mondayReplies.createdAtExternal,
      })
      .from(mondayReplies)
      .leftJoin(
        timelineEvents,
        and(
          eq(timelineEvents.source, 'monday'),
          eq(timelineEvents.sourceEntityType, 'monday_reply'),
          eq(timelineEvents.sourceEntityId, mondayReplies.id)
        )
      )
      .where(
        and(
          eq(mondayReplies.integrationAccountId, ctx.integrationAccountId),
          isNull(mondayReplies.deletedAt),
          isNull(timelineEvents.id)
        )
      )
      .orderBy(desc(mondayReplies.createdAtExternal))

    ctx.onProgress?.(`Found ${replies.length} Monday replies to process`)

    for (const reply of replies) {
      try {
        // Get parent update's item for context
        const updateResult = await ctx.db
          .select({ itemId: mondayUpdates.itemId })
          .from(mondayUpdates)
          .where(eq(mondayUpdates.id, reply.updateId))
          .limit(1)
        const update = updateResult[0]

        const eventResult = await ctx.db
          .insert(timelineEvents)
          .values({
            tenantId: ctx.tenantId,
            eventType: 'monday_reply' as TimelineEventType,
            source: 'monday',
            sourceEntityType: 'monday_reply',
            sourceEntityId: reply.id,
            externalId: reply.externalId,
            title: 'Reply',
            summary: reply.textBody?.substring(0, 200) ?? null,
            content: reply.textBody,
            contentHtml: reply.body,
            actorType: 'external',
            actorId: reply.creatorId,
            actorName: reply.creatorName,
            occurredAt: reply.createdAtExternal || new Date(),
            collapseGroupKey: update ? `monday_update_${update.itemId}` : null,
          })
          .returning({ id: timelineEvents.id })

        const event = eventResult[0]
        if (!event) continue

        // Link to update
        await ctx.db.insert(timelineEventLinks).values({
          timelineEventId: event.id,
          entityType: 'monday_update',
          entityId: reply.updateId,
          linkType: 'primary',
        })

        // Link to item if available
        if (update) {
          await ctx.db.insert(timelineEventLinks).values({
            timelineEventId: event.id,
            entityType: 'monday_item',
            entityId: update.itemId,
            linkType: 'related',
          })
        }

        created++
      } catch (err) {
        console.error(`Error creating timeline event for reply ${reply.id}:`, err)
        skipped++
      }
    }

    ctx.onProgress?.(`Monday replies: ${created} created, ${skipped} skipped`, { created, skipped })
    return { success: true, created, skipped }
  } catch (error) {
    return { success: false, created, skipped, error: (error as Error).message }
  }
}

/**
 * Generate timeline events from Monday.com activity logs
 */
export async function generateFromMondayActivity(
  ctx: GenerateContext
): Promise<GenerateResult> {
  let created = 0
  let skipped = 0

  try {
    ctx.onProgress?.('Fetching Monday activity logs without timeline events...')

    const activities = await ctx.db
      .select({
        id: mondayActivityLogs.id,
        externalId: mondayActivityLogs.externalId,
        boardId: mondayActivityLogs.boardId,
        itemId: mondayActivityLogs.itemId,
        event: mondayActivityLogs.event,
        data: mondayActivityLogs.data,
        userId: mondayActivityLogs.userId,
        createdAtExternal: mondayActivityLogs.createdAtExternal,
      })
      .from(mondayActivityLogs)
      .leftJoin(
        timelineEvents,
        and(
          eq(timelineEvents.source, 'monday'),
          eq(timelineEvents.sourceEntityType, 'monday_activity'),
          eq(timelineEvents.sourceEntityId, mondayActivityLogs.id)
        )
      )
      .where(
        and(
          eq(mondayActivityLogs.integrationAccountId, ctx.integrationAccountId),
          isNull(timelineEvents.id)
        )
      )
      .orderBy(desc(mondayActivityLogs.createdAtExternal))

    ctx.onProgress?.(`Found ${activities.length} Monday activities to process`)

    // Get user lookup for actor names
    const users = await ctx.db
      .select({ externalId: mondayUsers.externalId, name: mondayUsers.name })
      .from(mondayUsers)
      .where(eq(mondayUsers.integrationAccountId, ctx.integrationAccountId))
    const userMap = new Map(users.map(u => [u.externalId, u.name]))

    for (const activity of activities) {
      try {
        // Determine event type based on activity event
        let eventType: TimelineEventType = 'monday_activity'
        let title = formatActivityEvent(activity.event)
        let summary: string | null = null

        if (activity.event === 'update_column_value') {
          eventType = 'monday_value_change'
          const data = activity.data as { column_title?: string; previous_value?: unknown; value?: unknown } | null
          if (data?.column_title) {
            title = `Changed "${data.column_title}"`
            summary = formatValueChange(data.previous_value, data.value)
          }
        }

        const actorName = activity.userId ? userMap.get(activity.userId) ?? null : null

        const eventResult = await ctx.db
          .insert(timelineEvents)
          .values({
            tenantId: ctx.tenantId,
            eventType,
            source: 'monday',
            sourceEntityType: 'monday_activity',
            sourceEntityId: activity.id,
            externalId: activity.externalId,
            title,
            summary,
            metadata: activity.data,
            actorType: 'external',
            actorId: activity.userId,
            actorName,
            occurredAt: activity.createdAtExternal || new Date(),
            collapseGroupKey: activity.itemId ? `monday_activity_${activity.itemId}` : null,
            isInternal: true, // Activity logs are internal
          })
          .returning({ id: timelineEvents.id })

        const event = eventResult[0]
        if (!event) continue

        // Link to item if available
        if (activity.itemId) {
          await ctx.db.insert(timelineEventLinks).values({
            timelineEventId: event.id,
            entityType: 'monday_item',
            entityId: activity.itemId,
            linkType: 'primary',
          })
        }

        // Link to board
        if (activity.boardId) {
          await ctx.db.insert(timelineEventLinks).values({
            timelineEventId: event.id,
            entityType: 'monday_board',
            entityId: activity.boardId,
            linkType: 'related',
          })
        }

        created++
      } catch (err) {
        console.error(`Error creating timeline event for activity ${activity.id}:`, err)
        skipped++
      }
    }

    ctx.onProgress?.(`Monday activity: ${created} created, ${skipped} skipped`, { created, skipped })
    return { success: true, created, skipped }
  } catch (error) {
    return { success: false, created, skipped, error: (error as Error).message }
  }
}

/**
 * Generate timeline events from HQ reservations
 */
export async function generateFromHQReservations(
  ctx: GenerateContext
): Promise<GenerateResult> {
  let created = 0
  let skipped = 0

  try {
    ctx.onProgress?.('Fetching HQ reservations without timeline events...')

    const reservations = await ctx.db
      .select({
        id: hqReservations.id,
        externalId: hqReservations.externalId,
        customerId: hqReservations.customerId,
        vehicleId: hqReservations.vehicleId,
        reservationNumber: hqReservations.reservationNumber,
        status: hqReservations.status,
        pickupDate: hqReservations.pickupDate,
        returnDate: hqReservations.returnDate,
        pickupLocation: hqReservations.pickupLocation,
        returnLocation: hqReservations.returnLocation,
        totalEstimate: hqReservations.totalEstimate,
        firstSeenAt: hqReservations.firstSeenAt,
      })
      .from(hqReservations)
      .leftJoin(
        timelineEvents,
        and(
          eq(timelineEvents.source, 'hq'),
          eq(timelineEvents.sourceEntityType, 'hq_reservation'),
          eq(timelineEvents.sourceEntityId, hqReservations.id)
        )
      )
      .where(
        and(
          eq(hqReservations.integrationAccountId, ctx.integrationAccountId),
          isNull(timelineEvents.id)
        )
      )
      .orderBy(desc(hqReservations.firstSeenAt))

    ctx.onProgress?.(`Found ${reservations.length} HQ reservations to process`)

    for (const reservation of reservations) {
      try {
        // Get customer name for context
        let customerName: string | null = null
        if (reservation.customerId) {
          const customerResult = await ctx.db
            .select({ fullName: hqCustomers.fullName })
            .from(hqCustomers)
            .where(eq(hqCustomers.id, reservation.customerId))
            .limit(1)
          customerName = customerResult[0]?.fullName ?? null
        }

        const eventType: TimelineEventType = 'hq_reservation_created'
        const title = `Reservation #${reservation.reservationNumber}`
        const summary = [
          customerName,
          reservation.pickupDate ? `Pickup: ${formatDate(reservation.pickupDate)}` : null,
          reservation.returnDate ? `Return: ${formatDate(reservation.returnDate)}` : null,
        ].filter(Boolean).join(' • ')

        const eventResult = await ctx.db
          .insert(timelineEvents)
          .values({
            tenantId: ctx.tenantId,
            eventType,
            source: 'hq',
            sourceEntityType: 'hq_reservation',
            sourceEntityId: reservation.id,
            externalId: reservation.externalId,
            title,
            summary,
            metadata: {
              status: reservation.status,
              pickupLocation: reservation.pickupLocation,
              returnLocation: reservation.returnLocation,
              totalEstimate: reservation.totalEstimate,
            },
            actorType: 'system',
            occurredAt: reservation.firstSeenAt || new Date(),
            collapseGroupKey: reservation.customerId ? `hq_customer_${reservation.customerId}` : null,
          })
          .returning({ id: timelineEvents.id })

        const event = eventResult[0]
        if (!event) continue

        // Link to HQ reservation
        await ctx.db.insert(timelineEventLinks).values({
          timelineEventId: event.id,
          entityType: 'hq_reservation',
          entityId: reservation.id,
          linkType: 'primary',
        })

        // Link to HQ customer
        if (reservation.customerId) {
          await ctx.db.insert(timelineEventLinks).values({
            timelineEventId: event.id,
            entityType: 'hq_customer',
            entityId: reservation.customerId,
            linkType: 'related',
          })

          // Also link to core customer
          const coreLink = await ctx.db
            .select({ entityId: externalLinks.entityId })
            .from(externalLinks)
            .where(
              and(
                eq(externalLinks.source, 'hq'),
                eq(externalLinks.sourceEntityType, 'hq_customer'),
                eq(externalLinks.sourceEntityId, reservation.customerId)
              )
            )
            .limit(1)

          if (coreLink[0]) {
            await ctx.db.insert(timelineEventLinks).values({
              timelineEventId: event.id,
              entityType: 'customer',
              entityId: coreLink[0].entityId,
              linkType: 'related',
            })
          }
        }

        // Link to HQ vehicle
        if (reservation.vehicleId) {
          await ctx.db.insert(timelineEventLinks).values({
            timelineEventId: event.id,
            entityType: 'hq_vehicle',
            entityId: reservation.vehicleId,
            linkType: 'related',
          })

          // Also link to core vehicle
          const coreLink = await ctx.db
            .select({ entityId: externalLinks.entityId })
            .from(externalLinks)
            .where(
              and(
                eq(externalLinks.source, 'hq'),
                eq(externalLinks.sourceEntityType, 'hq_vehicle'),
                eq(externalLinks.sourceEntityId, reservation.vehicleId)
              )
            )
            .limit(1)

          if (coreLink[0]) {
            await ctx.db.insert(timelineEventLinks).values({
              timelineEventId: event.id,
              entityType: 'vehicle',
              entityId: coreLink[0].entityId,
              linkType: 'related',
            })
          }
        }

        created++
      } catch (err) {
        console.error(`Error creating timeline event for reservation ${reservation.id}:`, err)
        skipped++
      }
    }

    ctx.onProgress?.(`HQ reservations: ${created} created, ${skipped} skipped`, { created, skipped })
    return { success: true, created, skipped }
  } catch (error) {
    return { success: false, created, skipped, error: (error as Error).message }
  }
}

/**
 * Generate timeline events from HQ contracts
 */
export async function generateFromHQContracts(
  ctx: GenerateContext
): Promise<GenerateResult> {
  let created = 0
  let skipped = 0

  try {
    ctx.onProgress?.('Fetching HQ contracts without timeline events...')

    const contracts = await ctx.db
      .select({
        id: hqContracts.id,
        externalId: hqContracts.externalId,
        customerId: hqContracts.customerId,
        vehicleId: hqContracts.vehicleId,
        reservationId: hqContracts.reservationId,
        contractNumber: hqContracts.contractNumber,
        status: hqContracts.status,
        startDate: hqContracts.startDate,
        endDate: hqContracts.endDate,
        totalPrice: hqContracts.totalPrice,
        firstSeenAt: hqContracts.firstSeenAt,
      })
      .from(hqContracts)
      .leftJoin(
        timelineEvents,
        and(
          eq(timelineEvents.source, 'hq'),
          eq(timelineEvents.sourceEntityType, 'hq_contract'),
          eq(timelineEvents.sourceEntityId, hqContracts.id)
        )
      )
      .where(
        and(
          eq(hqContracts.integrationAccountId, ctx.integrationAccountId),
          isNull(timelineEvents.id)
        )
      )
      .orderBy(desc(hqContracts.firstSeenAt))

    ctx.onProgress?.(`Found ${contracts.length} HQ contracts to process`)

    for (const contract of contracts) {
      try {
        // Get customer name
        let customerName: string | null = null
        if (contract.customerId) {
          const customerResult = await ctx.db
            .select({ fullName: hqCustomers.fullName })
            .from(hqCustomers)
            .where(eq(hqCustomers.id, contract.customerId))
            .limit(1)
          customerName = customerResult[0]?.fullName ?? null
        }

        const eventType: TimelineEventType = contract.status === 'active' ? 'hq_contract_started' : 'hq_contract_ended'
        const title = `Contract #${contract.contractNumber} ${contract.status === 'active' ? 'Started' : 'Ended'}`
        const summary = [
          customerName,
          contract.startDate ? `Started: ${formatDate(contract.startDate)}` : null,
          contract.totalPrice ? `Total: $${contract.totalPrice}` : null,
        ].filter(Boolean).join(' • ')

        const eventResult = await ctx.db
          .insert(timelineEvents)
          .values({
            tenantId: ctx.tenantId,
            eventType,
            source: 'hq',
            sourceEntityType: 'hq_contract',
            sourceEntityId: contract.id,
            externalId: contract.externalId,
            title,
            summary,
            metadata: {
              status: contract.status,
              totalPrice: contract.totalPrice,
            },
            actorType: 'system',
            occurredAt: contract.startDate || contract.firstSeenAt || new Date(),
            collapseGroupKey: contract.customerId ? `hq_customer_${contract.customerId}` : null,
          })
          .returning({ id: timelineEvents.id })

        const event = eventResult[0]
        if (!event) continue

        // Link to contract
        await ctx.db.insert(timelineEventLinks).values({
          timelineEventId: event.id,
          entityType: 'hq_contract',
          entityId: contract.id,
          linkType: 'primary',
        })

        // Link to reservation
        if (contract.reservationId) {
          await ctx.db.insert(timelineEventLinks).values({
            timelineEventId: event.id,
            entityType: 'hq_reservation',
            entityId: contract.reservationId,
            linkType: 'related',
          })
        }

        // Link to customer (HQ and core)
        if (contract.customerId) {
          await ctx.db.insert(timelineEventLinks).values({
            timelineEventId: event.id,
            entityType: 'hq_customer',
            entityId: contract.customerId,
            linkType: 'related',
          })

          const coreLink = await ctx.db
            .select({ entityId: externalLinks.entityId })
            .from(externalLinks)
            .where(
              and(
                eq(externalLinks.source, 'hq'),
                eq(externalLinks.sourceEntityType, 'hq_customer'),
                eq(externalLinks.sourceEntityId, contract.customerId)
              )
            )
            .limit(1)

          if (coreLink[0]) {
            await ctx.db.insert(timelineEventLinks).values({
              timelineEventId: event.id,
              entityType: 'customer',
              entityId: coreLink[0].entityId,
              linkType: 'related',
            })
          }
        }

        // Link to vehicle
        if (contract.vehicleId) {
          await ctx.db.insert(timelineEventLinks).values({
            timelineEventId: event.id,
            entityType: 'hq_vehicle',
            entityId: contract.vehicleId,
            linkType: 'related',
          })

          const coreLink = await ctx.db
            .select({ entityId: externalLinks.entityId })
            .from(externalLinks)
            .where(
              and(
                eq(externalLinks.source, 'hq'),
                eq(externalLinks.sourceEntityType, 'hq_vehicle'),
                eq(externalLinks.sourceEntityId, contract.vehicleId)
              )
            )
            .limit(1)

          if (coreLink[0]) {
            await ctx.db.insert(timelineEventLinks).values({
              timelineEventId: event.id,
              entityType: 'vehicle',
              entityId: coreLink[0].entityId,
              linkType: 'related',
            })
          }
        }

        created++
      } catch (err) {
        console.error(`Error creating timeline event for contract ${contract.id}:`, err)
        skipped++
      }
    }

    ctx.onProgress?.(`HQ contracts: ${created} created, ${skipped} skipped`, { created, skipped })
    return { success: true, created, skipped }
  } catch (error) {
    return { success: false, created, skipped, error: (error as Error).message }
  }
}

/**
 * Generate all timeline events from all sources
 */
export async function generateAll(
  ctx: GenerateContext
): Promise<{
  mondayUpdates: GenerateResult
  mondayReplies: GenerateResult
  mondayActivity: GenerateResult
  hqReservations: GenerateResult
  hqContracts: GenerateResult
}> {
  ctx.onProgress?.('Starting timeline event generation...')

  const mondayUpdates = await generateFromMondayUpdates(ctx)
  const mondayReplies = await generateFromMondayReplies(ctx)
  const mondayActivity = await generateFromMondayActivity(ctx)
  const hqReservations = await generateFromHQReservations(ctx)
  const hqContracts = await generateFromHQContracts(ctx)

  ctx.onProgress?.('Timeline event generation complete')

  return {
    mondayUpdates,
    mondayReplies,
    mondayActivity,
    hqReservations,
    hqContracts,
  }
}

// Helper functions
function formatActivityEvent(event: string): string {
  const eventLabels: Record<string, string> = {
    'create_pulse': 'Item Created',
    'delete_pulse': 'Item Deleted',
    'archive_pulse': 'Item Archived',
    'restore_pulse': 'Item Restored',
    'update_column_value': 'Value Changed',
    'move_pulse': 'Item Moved',
    'duplicate_pulse': 'Item Duplicated',
    'create_update': 'Update Added',
    'delete_update': 'Update Deleted',
    'like_update': 'Update Liked',
  }
  return eventLabels[event] || event.replace(/_/g, ' ')
}

function formatValueChange(previous: unknown, current: unknown): string | null {
  if (previous === null && current !== null) {
    return `Set to "${formatValue(current)}"`
  }
  if (previous !== null && current === null) {
    return `Cleared (was "${formatValue(previous)}")`
  }
  if (previous !== current) {
    return `Changed from "${formatValue(previous)}" to "${formatValue(current)}"`
  }
  return null
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (obj.text) return String(obj.text)
    if (obj.label) return String(obj.label)
    return JSON.stringify(value)
  }
  return String(value)
}

function formatDate(date: Date | string | null): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
