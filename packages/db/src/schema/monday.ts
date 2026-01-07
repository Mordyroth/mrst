/**
 * Monday.com mirror tables
 * Mirrors: workspaces, boards, columns, items, values, updates, replies, activity
 */

import { pgTable, uuid, text, timestamp, boolean, jsonb, integer, bigint, index, unique } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { integrationAccounts } from './integrations'

/**
 * Monday.com workspaces
 */
export const mondayWorkspaces = pgTable('monday_workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalId: text('external_id').notNull(),
  name: text('name').notNull(),
  kind: text('kind'), // 'open' or 'closed'
  description: text('description'),
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  sourceHash: text('source_hash').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  unique('monday_workspaces_account_external_id').on(table.integrationAccountId, table.externalId),
  index('monday_workspaces_integration_account_id_idx').on(table.integrationAccountId),
])

/**
 * Monday.com boards
 */
export const mondayBoards = pgTable('monday_boards', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  workspaceId: uuid('workspace_id').references(() => mondayWorkspaces.id),
  externalId: text('external_id').notNull(),
  externalWorkspaceId: text('external_workspace_id'),
  name: text('name').notNull(),
  description: text('description'),
  boardKind: text('board_kind'), // 'public', 'private', 'share'
  state: text('state'), // 'active', 'archived', 'deleted'
  itemsCount: integer('items_count').default(0),
  inScope: boolean('in_scope').notNull().default(false), // Is this board in our sync scope?
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  sourceHash: text('source_hash').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  unique('monday_boards_account_external_id').on(table.integrationAccountId, table.externalId),
  index('monday_boards_integration_account_id_idx').on(table.integrationAccountId),
  index('monday_boards_workspace_id_idx').on(table.workspaceId),
  index('monday_boards_in_scope_idx').on(table.inScope),
])

/**
 * Monday.com board columns (schema definition)
 */
export const mondayColumns = pgTable('monday_columns', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  boardId: uuid('board_id').notNull().references(() => mondayBoards.id, { onDelete: 'cascade' }),
  externalId: text('external_id').notNull(), // The column ID
  externalBoardId: text('external_board_id').notNull(),
  title: text('title').notNull(), // Display name
  type: text('type').notNull(), // 'text', 'status', 'date', 'person', etc.
  description: text('description'),
  settings: jsonb('settings'), // Column-specific settings
  width: integer('width'),
  position: integer('position'),
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  sourceHash: text('source_hash').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  unique('monday_columns_board_external_id').on(table.boardId, table.externalId),
  index('monday_columns_board_id_idx').on(table.boardId),
])

/**
 * Monday.com groups (within boards)
 */
export const mondayGroups = pgTable('monday_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  boardId: uuid('board_id').notNull().references(() => mondayBoards.id, { onDelete: 'cascade' }),
  externalId: text('external_id').notNull(),
  externalBoardId: text('external_board_id').notNull(),
  title: text('title').notNull(),
  color: text('color'),
  position: integer('position'),
  isArchived: boolean('is_archived').default(false),
  isDeleted: boolean('is_deleted').default(false),
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  sourceHash: text('source_hash').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  unique('monday_groups_board_external_id').on(table.boardId, table.externalId),
  index('monday_groups_board_id_idx').on(table.boardId),
])

/**
 * Monday.com items (rows)
 */
export const mondayItems = pgTable('monday_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  boardId: uuid('board_id').notNull().references(() => mondayBoards.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id').references(() => mondayGroups.id),
  externalId: text('external_id').notNull(),
  externalBoardId: text('external_board_id').notNull(),
  externalGroupId: text('external_group_id'),
  name: text('name').notNull(),
  state: text('state'), // 'active', 'archived', 'deleted'
  createdAtExternal: timestamp('created_at_external', { withTimezone: true }),
  updatedAtExternal: timestamp('updated_at_external', { withTimezone: true }),
  creatorId: text('creator_id'),
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  sourceHash: text('source_hash').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  unique('monday_items_account_external_id').on(table.integrationAccountId, table.externalId),
  index('monday_items_board_id_idx').on(table.boardId),
  index('monday_items_group_id_idx').on(table.groupId),
  index('monday_items_name_idx').on(table.name),
])

/**
 * Monday.com item column values (current values)
 */
export const mondayItemColumnValues = pgTable('monday_item_column_values', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  itemId: uuid('item_id').notNull().references(() => mondayItems.id, { onDelete: 'cascade' }),
  columnId: uuid('column_id').notNull().references(() => mondayColumns.id, { onDelete: 'cascade' }),
  externalItemId: text('external_item_id').notNull(),
  externalColumnId: text('external_column_id').notNull(),
  valueJson: jsonb('value_json'), // The raw JSON value
  textValue: text('text_value'), // Extracted text for searching
  dateValue: timestamp('date_value', { withTimezone: true }), // Extracted date
  numberValue: bigint('number_value', { mode: 'number' }), // Extracted number
  valueHash: text('value_hash').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('monday_item_column_values_item_column').on(table.itemId, table.columnId),
  index('monday_item_column_values_item_id_idx').on(table.itemId),
  index('monday_item_column_values_column_id_idx').on(table.columnId),
  index('monday_item_column_values_text_value_idx').on(table.textValue),
])

/**
 * Monday.com item column value history (track changes)
 */
export const mondayItemColumnValueVersions = pgTable('monday_item_column_value_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  itemId: uuid('item_id').notNull().references(() => mondayItems.id, { onDelete: 'cascade' }),
  columnId: uuid('column_id').notNull().references(() => mondayColumns.id, { onDelete: 'cascade' }),
  externalItemId: text('external_item_id').notNull(),
  externalColumnId: text('external_column_id').notNull(),
  valueJson: jsonb('value_json'),
  textValue: text('text_value'),
  valueHash: text('value_hash').notNull(),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull(),
  detectedBy: text('detected_by').$type<'activity_log' | 'diff_snapshot'>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('monday_item_column_value_versions_item_id_idx').on(table.itemId),
  index('monday_item_column_value_versions_changed_at_idx').on(table.changedAt),
])

/**
 * Monday.com updates (comments on items)
 */
export const mondayUpdates = pgTable('monday_updates', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  itemId: uuid('item_id').notNull().references(() => mondayItems.id, { onDelete: 'cascade' }),
  externalId: text('external_id').notNull(),
  externalItemId: text('external_item_id').notNull(),
  body: text('body'),
  textBody: text('text_body'), // Plain text version for search
  creatorId: text('creator_id'),
  creatorName: text('creator_name'),
  createdAtExternal: timestamp('created_at_external', { withTimezone: true }),
  updatedAtExternal: timestamp('updated_at_external', { withTimezone: true }),
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  sourceHash: text('source_hash').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  unique('monday_updates_account_external_id').on(table.integrationAccountId, table.externalId),
  index('monday_updates_item_id_idx').on(table.itemId),
  index('monday_updates_created_at_external_idx').on(table.createdAtExternal),
])

/**
 * Monday.com update replies
 */
export const mondayReplies = pgTable('monday_replies', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  updateId: uuid('update_id').notNull().references(() => mondayUpdates.id, { onDelete: 'cascade' }),
  externalId: text('external_id').notNull(),
  externalUpdateId: text('external_update_id').notNull(),
  body: text('body'),
  textBody: text('text_body'),
  creatorId: text('creator_id'),
  creatorName: text('creator_name'),
  createdAtExternal: timestamp('created_at_external', { withTimezone: true }),
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  sourceHash: text('source_hash').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  unique('monday_replies_account_external_id').on(table.integrationAccountId, table.externalId),
  index('monday_replies_update_id_idx').on(table.updateId),
])

/**
 * Monday.com activity logs
 */
export const mondayActivityLogs = pgTable('monday_activity_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  boardId: uuid('board_id').references(() => mondayBoards.id),
  itemId: uuid('item_id').references(() => mondayItems.id),
  externalId: text('external_id').notNull(),
  externalBoardId: text('external_board_id'),
  externalItemId: text('external_item_id'),
  event: text('event').notNull(), // 'create_pulse', 'update_column_value', etc.
  data: jsonb('data'),
  userId: text('user_id'),
  createdAtExternal: timestamp('created_at_external', { withTimezone: true }),
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('monday_activity_logs_account_external_id').on(table.integrationAccountId, table.externalId),
  index('monday_activity_logs_board_id_idx').on(table.boardId),
  index('monday_activity_logs_item_id_idx').on(table.itemId),
  index('monday_activity_logs_event_idx').on(table.event),
  index('monday_activity_logs_created_at_external_idx').on(table.createdAtExternal),
])

/**
 * Monday.com files (assets)
 */
export const mondayFiles = pgTable('monday_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  itemId: uuid('item_id').references(() => mondayItems.id),
  updateId: uuid('update_id').references(() => mondayUpdates.id),
  externalId: text('external_id').notNull(),
  externalItemId: text('external_item_id'),
  externalUpdateId: text('external_update_id'),
  name: text('name').notNull(),
  url: text('url').notNull(),
  urlExpiresAt: timestamp('url_expires_at', { withTimezone: true }),
  fileExtension: text('file_extension'),
  fileSize: bigint('file_size', { mode: 'number' }),
  isImage: boolean('is_image').default(false),
  // S3 storage
  s3Downloaded: boolean('s3_downloaded').default(false),
  s3Bucket: text('s3_bucket'),
  s3Key: text('s3_key'),
  downloadedAt: timestamp('downloaded_at', { withTimezone: true }),
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  sourceHash: text('source_hash').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('monday_files_account_external_id').on(table.integrationAccountId, table.externalId),
  index('monday_files_item_id_idx').on(table.itemId),
  index('monday_files_update_id_idx').on(table.updateId),
])

/**
 * Monday.com users (people)
 */
export const mondayUsers = pgTable('monday_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  externalId: text('external_id').notNull(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  title: text('title'),
  birthday: text('birthday'),
  countryCode: text('country_code'),
  location: text('location'),
  timeZoneIdentifier: text('time_zone_identifier'),
  isAdmin: boolean('is_admin').default(false),
  isGuest: boolean('is_guest').default(false),
  isViewOnly: boolean('is_view_only').default(false),
  photoUrl: text('photo_url'),
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  sourceHash: text('source_hash').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('monday_users_account_external_id').on(table.integrationAccountId, table.externalId),
  index('monday_users_email_idx').on(table.email),
])

// Relations
export const mondayWorkspacesRelations = relations(mondayWorkspaces, ({ one, many }) => ({
  integrationAccount: one(integrationAccounts, {
    fields: [mondayWorkspaces.integrationAccountId],
    references: [integrationAccounts.id],
  }),
  boards: many(mondayBoards),
}))

export const mondayBoardsRelations = relations(mondayBoards, ({ one, many }) => ({
  integrationAccount: one(integrationAccounts, {
    fields: [mondayBoards.integrationAccountId],
    references: [integrationAccounts.id],
  }),
  workspace: one(mondayWorkspaces, {
    fields: [mondayBoards.workspaceId],
    references: [mondayWorkspaces.id],
  }),
  columns: many(mondayColumns),
  groups: many(mondayGroups),
  items: many(mondayItems),
  activityLogs: many(mondayActivityLogs),
}))

export const mondayColumnsRelations = relations(mondayColumns, ({ one, many }) => ({
  board: one(mondayBoards, {
    fields: [mondayColumns.boardId],
    references: [mondayBoards.id],
  }),
  values: many(mondayItemColumnValues),
}))

export const mondayGroupsRelations = relations(mondayGroups, ({ one, many }) => ({
  board: one(mondayBoards, {
    fields: [mondayGroups.boardId],
    references: [mondayBoards.id],
  }),
  items: many(mondayItems),
}))

export const mondayItemsRelations = relations(mondayItems, ({ one, many }) => ({
  integrationAccount: one(integrationAccounts, {
    fields: [mondayItems.integrationAccountId],
    references: [integrationAccounts.id],
  }),
  board: one(mondayBoards, {
    fields: [mondayItems.boardId],
    references: [mondayBoards.id],
  }),
  group: one(mondayGroups, {
    fields: [mondayItems.groupId],
    references: [mondayGroups.id],
  }),
  columnValues: many(mondayItemColumnValues),
  updates: many(mondayUpdates),
  activityLogs: many(mondayActivityLogs),
  files: many(mondayFiles),
}))

export const mondayItemColumnValuesRelations = relations(mondayItemColumnValues, ({ one }) => ({
  item: one(mondayItems, {
    fields: [mondayItemColumnValues.itemId],
    references: [mondayItems.id],
  }),
  column: one(mondayColumns, {
    fields: [mondayItemColumnValues.columnId],
    references: [mondayColumns.id],
  }),
}))

export const mondayUpdatesRelations = relations(mondayUpdates, ({ one, many }) => ({
  item: one(mondayItems, {
    fields: [mondayUpdates.itemId],
    references: [mondayItems.id],
  }),
  replies: many(mondayReplies),
  files: many(mondayFiles),
}))

export const mondayRepliesRelations = relations(mondayReplies, ({ one }) => ({
  update: one(mondayUpdates, {
    fields: [mondayReplies.updateId],
    references: [mondayUpdates.id],
  }),
}))

export const mondayActivityLogsRelations = relations(mondayActivityLogs, ({ one }) => ({
  board: one(mondayBoards, {
    fields: [mondayActivityLogs.boardId],
    references: [mondayBoards.id],
  }),
  item: one(mondayItems, {
    fields: [mondayActivityLogs.itemId],
    references: [mondayItems.id],
  }),
}))

export const mondayFilesRelations = relations(mondayFiles, ({ one }) => ({
  item: one(mondayItems, {
    fields: [mondayFiles.itemId],
    references: [mondayItems.id],
  }),
  update: one(mondayUpdates, {
    fields: [mondayFiles.updateId],
    references: [mondayUpdates.id],
  }),
}))

export const mondayUsersRelations = relations(mondayUsers, ({ one }) => ({
  integrationAccount: one(integrationAccounts, {
    fields: [mondayUsers.integrationAccountId],
    references: [integrationAccounts.id],
  }),
}))
