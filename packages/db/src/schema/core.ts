/**
 * Core unified tables
 * These are MRST's internal entities that link to external records
 */

import { pgTable, uuid, text, timestamp, boolean, jsonb, integer, decimal, index, unique } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tenants } from './platform'

export type IdentityConfidence = 'auto' | 'review' | 'confirmed' | 'rejected'
export type LinkStatus = 'active' | 'pending_review' | 'rejected'

/**
 * Core customers - unified customer entity
 */
export const coreCustomers = pgTable('core_customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  // Primary identity
  primaryEmail: text('primary_email'),
  primaryPhone: text('primary_phone'), // E.164 normalized
  // Name
  firstName: text('first_name'),
  lastName: text('last_name'),
  fullName: text('full_name'),
  displayName: text('display_name'), // What to show in UI
  // Business info
  companyName: text('company_name'),
  // Status
  status: text('status').default('active'),
  isVip: boolean('is_vip').default(false),
  tags: jsonb('tags').$type<string[]>().default([]),
  notes: text('notes'),
  // Stats (computed)
  totalRentals: integer('total_rentals').default(0),
  totalSpent: decimal('total_spent', { precision: 12, scale: 2 }).default('0'),
  lastRentalAt: timestamp('last_rental_at', { withTimezone: true }),
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('core_customers_tenant_id_idx').on(table.tenantId),
  index('core_customers_primary_email_idx').on(table.primaryEmail),
  index('core_customers_primary_phone_idx').on(table.primaryPhone),
  index('core_customers_full_name_idx').on(table.fullName),
])

/**
 * Core vehicles - unified vehicle entity
 */
export const coreVehicles = pgTable('core_vehicles', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  // Vehicle identity
  vin: text('vin'),
  licensePlate: text('license_plate'),
  unitNumber: text('unit_number'), // Internal fleet number
  // Vehicle details
  year: integer('year'),
  make: text('make'),
  model: text('model'),
  trim: text('trim'),
  color: text('color'),
  vehicleType: text('vehicle_type'),
  // Status
  status: text('status').default('available'),
  availability: text('availability'),
  // Location
  currentLat: decimal('current_lat', { precision: 10, scale: 7 }),
  currentLng: decimal('current_lng', { precision: 10, scale: 7 }),
  currentLocationAt: timestamp('current_location_at', { withTimezone: true }),
  isAtShop: boolean('is_at_shop').default(true),
  // Mileage
  currentMileage: integer('current_mileage'),
  mileageUpdatedAt: timestamp('mileage_updated_at', { withTimezone: true }),
  // Rates
  dailyRate: decimal('daily_rate', { precision: 10, scale: 2 }),
  weeklyRate: decimal('weekly_rate', { precision: 10, scale: 2 }),
  monthlyRate: decimal('monthly_rate', { precision: 10, scale: 2 }),
  // Notes and tags
  tags: jsonb('tags').$type<string[]>().default([]),
  notes: text('notes'),
  // Primary image (S3 key)
  primaryImageKey: text('primary_image_key'),
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('core_vehicles_tenant_id_idx').on(table.tenantId),
  unique('core_vehicles_tenant_vin').on(table.tenantId, table.vin),
  index('core_vehicles_license_plate_idx').on(table.licensePlate),
  index('core_vehicles_unit_number_idx').on(table.unitNumber),
  index('core_vehicles_status_idx').on(table.status),
])

/**
 * External links - connects core entities to mirror table records
 */
export const externalLinks = pgTable('external_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  // Core entity
  entityType: text('entity_type').notNull(), // 'customer', 'vehicle'
  entityId: uuid('entity_id').notNull(),
  // External record
  source: text('source').notNull(), // 'hq', 'monday', 'gmail', 'spireon', 'whatsapp'
  sourceEntityType: text('source_entity_type').notNull(), // 'hq_customer', 'monday_item', etc.
  sourceEntityId: uuid('source_entity_id').notNull(),
  externalId: text('external_id'), // The external system's ID
  // Link quality
  confidence: text('confidence').$type<IdentityConfidence>().notNull().default('auto'),
  confidenceScore: integer('confidence_score'), // 0-100
  matchedOn: jsonb('matched_on').$type<string[]>().default([]), // What fields matched: ['email', 'phone']
  status: text('status').$type<LinkStatus>().notNull().default('active'),
  // Review tracking
  reviewedBy: uuid('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNotes: text('review_notes'),
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('external_links_source_entity').on(table.source, table.sourceEntityType, table.sourceEntityId),
  index('external_links_tenant_id_idx').on(table.tenantId),
  index('external_links_entity_idx').on(table.entityType, table.entityId),
  index('external_links_source_idx').on(table.source, table.sourceEntityType),
  index('external_links_status_idx').on(table.status),
  index('external_links_confidence_idx').on(table.confidence),
])

/**
 * Identity merge log - track when entities are merged
 */
export const identityMerges = pgTable('identity_merges', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  entityType: text('entity_type').notNull(), // 'customer', 'vehicle'
  survivorId: uuid('survivor_id').notNull(), // The entity that remains
  mergedId: uuid('merged_id').notNull(), // The entity that was merged
  // Merge details
  mergedBy: uuid('merged_by'), // User who performed merge
  mergeReason: text('merge_reason'),
  // Snapshot of merged entity before deletion
  mergedSnapshot: jsonb('merged_snapshot').notNull(),
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('identity_merges_tenant_id_idx').on(table.tenantId),
  index('identity_merges_survivor_id_idx').on(table.survivorId),
  index('identity_merges_merged_id_idx').on(table.mergedId),
])

/**
 * Alerts - system-generated notifications
 */
export const alerts = pgTable('alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  // Target
  entityType: text('entity_type'), // 'customer', 'vehicle', etc.
  entityId: uuid('entity_id'),
  // Alert details
  alertType: text('alert_type').notNull(), // 'overdue_return', 'license_expiring', 'maintenance_due', etc.
  severity: text('severity').$type<'low' | 'medium' | 'high' | 'critical'>().notNull().default('medium'),
  title: text('title').notNull(),
  message: text('message'),
  data: jsonb('data'),
  // Status
  status: text('status').$type<'active' | 'acknowledged' | 'resolved' | 'dismissed'>().notNull().default('active'),
  acknowledgedBy: uuid('acknowledged_by'),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  resolvedBy: uuid('resolved_by'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (table) => [
  index('alerts_tenant_id_idx').on(table.tenantId),
  index('alerts_entity_idx').on(table.entityType, table.entityId),
  index('alerts_status_idx').on(table.status),
  index('alerts_severity_idx').on(table.severity),
  index('alerts_created_at_idx').on(table.createdAt),
])

// Relations
export const coreCustomersRelations = relations(coreCustomers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [coreCustomers.tenantId],
    references: [tenants.id],
  }),
  externalLinks: many(externalLinks),
  alerts: many(alerts),
}))

export const coreVehiclesRelations = relations(coreVehicles, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [coreVehicles.tenantId],
    references: [tenants.id],
  }),
  externalLinks: many(externalLinks),
  alerts: many(alerts),
}))

export const externalLinksRelations = relations(externalLinks, ({ one }) => ({
  tenant: one(tenants, {
    fields: [externalLinks.tenantId],
    references: [tenants.id],
  }),
}))

export const identityMergesRelations = relations(identityMerges, ({ one }) => ({
  tenant: one(tenants, {
    fields: [identityMerges.tenantId],
    references: [tenants.id],
  }),
}))

export const alertsRelations = relations(alerts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [alerts.tenantId],
    references: [tenants.id],
  }),
}))
