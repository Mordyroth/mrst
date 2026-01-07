/**
 * Integration tables - accounts, sync runs, file storage
 */

import { pgTable, uuid, text, timestamp, boolean, jsonb, integer, bigint, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tenants } from './platform'

export type IntegrationType = 'monday' | 'hq' | 'gmail' | 'spireon' | 'whatsapp'
export type SyncStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled'

/**
 * Integration accounts - credentials for each external system
 */
export const integrationAccounts = pgTable('integration_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  type: text('type').$type<IntegrationType>().notNull(),
  name: text('name').notNull(),
  credentials: jsonb('credentials').notNull(), // Encrypted at rest
  settings: jsonb('settings').$type<IntegrationSettings>().default({}),
  isActive: boolean('is_active').notNull().default(true),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  lastSyncStatus: text('last_sync_status').$type<SyncStatus>(),
  lastSyncError: text('last_sync_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('integration_accounts_tenant_id_idx').on(table.tenantId),
  index('integration_accounts_type_idx').on(table.type),
])

export interface IntegrationSettings {
  syncIntervalSeconds?: number
  syncScope?: string[]
  // Gmail specific
  historyId?: string
  emailAddress?: string
  // Monday specific
  boardIds?: string[]
  // HQ specific
  baseUrl?: string
}

/**
 * Sync runs - track each sync operation
 */
export const syncRuns = pgTable('sync_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  status: text('status').$type<SyncStatus>().notNull().default('pending'),
  syncType: text('sync_type').notNull(), // 'full', 'incremental', 'backfill'
  entityType: text('entity_type'), // 'boards', 'items', 'customers', etc.
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  recordsProcessed: integer('records_processed').default(0),
  recordsCreated: integer('records_created').default(0),
  recordsUpdated: integer('records_updated').default(0),
  recordsDeleted: integer('records_deleted').default(0),
  recordsErrored: integer('records_errored').default(0),
  errorMessage: text('error_message'),
  errorDetails: jsonb('error_details'),
  metadata: jsonb('metadata'), // API-specific data like cursor/page info
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('sync_runs_integration_account_id_idx').on(table.integrationAccountId),
  index('sync_runs_status_idx').on(table.status),
  index('sync_runs_created_at_idx').on(table.createdAt),
])

/**
 * Sync cursors - track incremental sync position
 */
export const syncCursors = pgTable('sync_cursors', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  entityType: text('entity_type').notNull(),
  cursorValue: text('cursor_value').notNull(),
  cursorType: text('cursor_type').notNull(), // 'timestamp', 'id', 'page', 'historyId'
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('sync_cursors_account_entity_idx').on(table.integrationAccountId, table.entityType),
])

/**
 * File storage - track all downloaded files
 */
export const files = pgTable('files', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  source: text('source').$type<IntegrationType | 'upload'>().notNull(),
  sourceId: text('source_id'), // External ID from source system
  sourceEntityType: text('source_entity_type'), // 'monday_file', 'hq_document', etc.
  sourceEntityId: text('source_entity_id'),
  originalFilename: text('original_filename').notNull(),
  mimeType: text('mime_type'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  s3Bucket: text('s3_bucket').notNull(),
  s3Key: text('s3_key').notNull(),
  checksum: text('checksum'), // MD5 or SHA256
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('files_tenant_id_idx').on(table.tenantId),
  index('files_source_idx').on(table.source, table.sourceId),
  index('files_s3_key_idx').on(table.s3Key),
])

// Relations
export const integrationAccountsRelations = relations(integrationAccounts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [integrationAccounts.tenantId],
    references: [tenants.id],
  }),
  syncRuns: many(syncRuns),
  syncCursors: many(syncCursors),
}))

export const syncRunsRelations = relations(syncRuns, ({ one }) => ({
  integrationAccount: one(integrationAccounts, {
    fields: [syncRuns.integrationAccountId],
    references: [integrationAccounts.id],
  }),
}))

export const syncCursorsRelations = relations(syncCursors, ({ one }) => ({
  integrationAccount: one(integrationAccounts, {
    fields: [syncCursors.integrationAccountId],
    references: [integrationAccounts.id],
  }),
}))

export const filesRelations = relations(files, ({ one }) => ({
  tenant: one(tenants, {
    fields: [files.tenantId],
    references: [tenants.id],
  }),
}))
