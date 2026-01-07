/**
 * Timeline tables - unified event timeline across all data sources
 */

import { pgTable, uuid, text, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tenants } from './platform'

export type TimelineEventType =
  // Monday.com
  | 'monday_update'
  | 'monday_reply'
  | 'monday_activity'
  | 'monday_value_change'
  // HQ
  | 'hq_reservation_created'
  | 'hq_reservation_updated'
  | 'hq_contract_started'
  | 'hq_contract_ended'
  | 'hq_payment'
  | 'hq_charge'
  // Gmail
  | 'gmail_received'
  | 'gmail_sent'
  // Spireon
  | 'spireon_location'
  | 'spireon_diagnostic'
  | 'spireon_geofence_enter'
  | 'spireon_geofence_exit'
  | 'spireon_ignition_on'
  | 'spireon_ignition_off'
  // WhatsApp
  | 'whatsapp_received'
  | 'whatsapp_sent'
  // System
  | 'system_note'
  | 'system_alert'
  | 'system_merge'

/**
 * Timeline events - the unified activity feed
 */
export const timelineEvents = pgTable('timeline_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  // Event classification
  eventType: text('event_type').$type<TimelineEventType>().notNull(),
  source: text('source').notNull(), // 'monday', 'hq', 'gmail', 'spireon', 'whatsapp', 'system'
  // Source record reference
  sourceEntityType: text('source_entity_type'), // 'monday_update', 'hq_payment', etc.
  sourceEntityId: uuid('source_entity_id'),
  externalId: text('external_id'), // External system's ID
  // Event content
  title: text('title'),
  summary: text('summary'), // Short description
  content: text('content'), // Full content (message body, note text, etc.)
  contentHtml: text('content_html'), // HTML version if available
  // Event metadata
  metadata: jsonb('metadata'), // Type-specific data
  // Actor (who did this)
  actorType: text('actor_type'), // 'user', 'system', 'external'
  actorId: text('actor_id'), // Internal user ID or external user ID
  actorName: text('actor_name'),
  actorEmail: text('actor_email'),
  // Timing
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  // Collapse grouping (for consecutive similar events)
  collapseGroupKey: text('collapse_group_key'),
  isCollapsed: boolean('is_collapsed').default(false),
  // Visibility
  isInternal: boolean('is_internal').default(false), // Only visible to staff
  isPinned: boolean('is_pinned').default(false),
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('timeline_events_tenant_id_idx').on(table.tenantId),
  index('timeline_events_event_type_idx').on(table.eventType),
  index('timeline_events_source_idx').on(table.source),
  index('timeline_events_source_entity_idx').on(table.sourceEntityType, table.sourceEntityId),
  index('timeline_events_occurred_at_idx').on(table.occurredAt),
  index('timeline_events_collapse_group_key_idx').on(table.collapseGroupKey),
  index('timeline_events_actor_idx').on(table.actorType, table.actorId),
])

/**
 * Timeline event links - connect events to entities
 */
export const timelineEventLinks = pgTable('timeline_event_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  timelineEventId: uuid('timeline_event_id').notNull().references(() => timelineEvents.id, { onDelete: 'cascade' }),
  // Entity reference
  entityType: text('entity_type').notNull(), // 'customer', 'vehicle', 'reservation', etc.
  entityId: uuid('entity_id').notNull(),
  // Link metadata
  linkType: text('link_type').default('related'), // 'primary', 'related', 'mentioned'
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('timeline_event_links_event_id_idx').on(table.timelineEventId),
  index('timeline_event_links_entity_idx').on(table.entityType, table.entityId),
])

/**
 * Timeline views - saved timeline filters/views
 */
export const timelineViews = pgTable('timeline_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  // View definition
  name: text('name').notNull(),
  description: text('description'),
  // Filter criteria
  filters: jsonb('filters').$type<TimelineViewFilters>().notNull(),
  // Display options
  displayOptions: jsonb('display_options'),
  // Sharing
  isShared: boolean('is_shared').default(false),
  createdBy: uuid('created_by'),
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('timeline_views_tenant_id_idx').on(table.tenantId),
])

export interface TimelineViewFilters {
  sources?: string[]
  eventTypes?: string[]
  entityTypes?: string[]
  entityIds?: string[]
  dateRange?: {
    start?: string
    end?: string
  }
  actors?: string[]
  searchQuery?: string
}

// Relations
export const timelineEventsRelations = relations(timelineEvents, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [timelineEvents.tenantId],
    references: [tenants.id],
  }),
  links: many(timelineEventLinks),
}))

export const timelineEventLinksRelations = relations(timelineEventLinks, ({ one }) => ({
  timelineEvent: one(timelineEvents, {
    fields: [timelineEventLinks.timelineEventId],
    references: [timelineEvents.id],
  }),
}))

export const timelineViewsRelations = relations(timelineViews, ({ one }) => ({
  tenant: one(tenants, {
    fields: [timelineViews.tenantId],
    references: [tenants.id],
  }),
}))
