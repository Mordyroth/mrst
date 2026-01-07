/**
 * Gmail mirror tables
 * Mirrors: accounts, labels, threads, messages, attachments
 */

import { pgTable, uuid, text, timestamp, boolean, jsonb, integer, bigint, index, unique } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { integrationAccounts } from './integrations'

/**
 * Gmail accounts (each monitored email address)
 */
export const gmailAccounts = pgTable('gmail_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  emailAddress: text('email_address').notNull(),
  displayName: text('display_name'),
  // Sync state
  historyId: text('history_id'), // For incremental sync
  lastFullSyncAt: timestamp('last_full_sync_at', { withTimezone: true }),
  needsFullResync: boolean('needs_full_resync').default(false),
  // Stats
  messagesTotal: integer('messages_total').default(0),
  threadsTotal: integer('threads_total').default(0),
  // Mirror fields
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('gmail_accounts_integration_email').on(table.integrationAccountId, table.emailAddress),
  index('gmail_accounts_email_address_idx').on(table.emailAddress),
])

/**
 * Gmail labels
 */
export const gmailLabels = pgTable('gmail_labels', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  gmailAccountId: uuid('gmail_account_id').notNull().references(() => gmailAccounts.id),
  externalId: text('external_id').notNull(), // Gmail label ID
  name: text('name').notNull(),
  type: text('type'), // 'system' or 'user'
  messagesTotal: integer('messages_total').default(0),
  messagesUnread: integer('messages_unread').default(0),
  threadsTotal: integer('threads_total').default(0),
  threadsUnread: integer('threads_unread').default(0),
  color: jsonb('color'), // Background and text color
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  sourceHash: text('source_hash').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  unique('gmail_labels_account_external_id').on(table.gmailAccountId, table.externalId),
  index('gmail_labels_gmail_account_id_idx').on(table.gmailAccountId),
])

/**
 * Gmail threads
 */
export const gmailThreads = pgTable('gmail_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  gmailAccountId: uuid('gmail_account_id').notNull().references(() => gmailAccounts.id),
  externalId: text('external_id').notNull(), // Thread ID
  historyId: text('history_id'),
  snippet: text('snippet'),
  // Computed fields for quick access
  subject: text('subject'),
  participantEmails: jsonb('participant_emails').$type<string[]>().default([]),
  messageCount: integer('message_count').default(0),
  // Thread timing
  firstMessageAt: timestamp('first_message_at', { withTimezone: true }),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  // Labels as array of external IDs
  labelIds: jsonb('label_ids').$type<string[]>().default([]),
  // Mirror fields
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  sourceHash: text('source_hash').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  unique('gmail_threads_account_external_id').on(table.gmailAccountId, table.externalId),
  index('gmail_threads_gmail_account_id_idx').on(table.gmailAccountId),
  index('gmail_threads_last_message_at_idx').on(table.lastMessageAt),
  index('gmail_threads_subject_idx').on(table.subject),
])

/**
 * Gmail messages
 */
export const gmailMessages = pgTable('gmail_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  gmailAccountId: uuid('gmail_account_id').notNull().references(() => gmailAccounts.id),
  threadId: uuid('thread_id').notNull().references(() => gmailThreads.id),
  externalId: text('external_id').notNull(), // Message ID
  externalThreadId: text('external_thread_id').notNull(),
  historyId: text('history_id'),
  // Headers
  subject: text('subject'),
  fromEmail: text('from_email'),
  fromName: text('from_name'),
  toEmails: jsonb('to_emails').$type<string[]>().default([]),
  ccEmails: jsonb('cc_emails').$type<string[]>().default([]),
  bccEmails: jsonb('bcc_emails').$type<string[]>().default([]),
  replyTo: text('reply_to'),
  messageIdHeader: text('message_id_header'), // Message-ID header
  inReplyTo: text('in_reply_to'),
  references: text('references'),
  // Content
  snippet: text('snippet'),
  bodyPlain: text('body_plain'),
  bodyHtml: text('body_html'),
  // Timing
  internalDate: timestamp('internal_date', { withTimezone: true }), // When Gmail received it
  sentAt: timestamp('sent_at', { withTimezone: true }), // Date header
  // Status
  labelIds: jsonb('label_ids').$type<string[]>().default([]),
  isUnread: boolean('is_unread').default(true),
  isStarred: boolean('is_starred').default(false),
  isImportant: boolean('is_important').default(false),
  isDraft: boolean('is_draft').default(false),
  isSent: boolean('is_sent').default(false),
  isInbox: boolean('is_inbox').default(false),
  isTrash: boolean('is_trash').default(false),
  isSpam: boolean('is_spam').default(false),
  // Size
  sizeEstimate: integer('size_estimate'),
  // Mirror fields
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  sourceHash: text('source_hash').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  unique('gmail_messages_account_external_id').on(table.gmailAccountId, table.externalId),
  index('gmail_messages_gmail_account_id_idx').on(table.gmailAccountId),
  index('gmail_messages_thread_id_idx').on(table.threadId),
  index('gmail_messages_from_email_idx').on(table.fromEmail),
  index('gmail_messages_internal_date_idx').on(table.internalDate),
  index('gmail_messages_is_unread_idx').on(table.isUnread),
])

/**
 * Gmail attachments
 */
export const gmailAttachments = pgTable('gmail_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  gmailAccountId: uuid('gmail_account_id').notNull().references(() => gmailAccounts.id),
  messageId: uuid('message_id').notNull().references(() => gmailMessages.id),
  externalId: text('external_id').notNull(), // Attachment ID
  externalMessageId: text('external_message_id').notNull(),
  // Attachment details
  filename: text('filename').notNull(),
  mimeType: text('mime_type'),
  size: bigint('size', { mode: 'number' }),
  contentId: text('content_id'), // For inline images
  isInline: boolean('is_inline').default(false),
  // S3 storage
  s3Downloaded: boolean('s3_downloaded').default(false),
  s3Bucket: text('s3_bucket'),
  s3Key: text('s3_key'),
  downloadedAt: timestamp('downloaded_at', { withTimezone: true }),
  // Mirror fields
  raw: jsonb('raw'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('gmail_attachments_message_external_id').on(table.messageId, table.externalId),
  index('gmail_attachments_message_id_idx').on(table.messageId),
])

// Relations
export const gmailAccountsRelations = relations(gmailAccounts, ({ one, many }) => ({
  integrationAccount: one(integrationAccounts, {
    fields: [gmailAccounts.integrationAccountId],
    references: [integrationAccounts.id],
  }),
  labels: many(gmailLabels),
  threads: many(gmailThreads),
  messages: many(gmailMessages),
}))

export const gmailLabelsRelations = relations(gmailLabels, ({ one }) => ({
  gmailAccount: one(gmailAccounts, {
    fields: [gmailLabels.gmailAccountId],
    references: [gmailAccounts.id],
  }),
}))

export const gmailThreadsRelations = relations(gmailThreads, ({ one, many }) => ({
  gmailAccount: one(gmailAccounts, {
    fields: [gmailThreads.gmailAccountId],
    references: [gmailAccounts.id],
  }),
  messages: many(gmailMessages),
}))

export const gmailMessagesRelations = relations(gmailMessages, ({ one, many }) => ({
  gmailAccount: one(gmailAccounts, {
    fields: [gmailMessages.gmailAccountId],
    references: [gmailAccounts.id],
  }),
  thread: one(gmailThreads, {
    fields: [gmailMessages.threadId],
    references: [gmailThreads.id],
  }),
  attachments: many(gmailAttachments),
}))

export const gmailAttachmentsRelations = relations(gmailAttachments, ({ one }) => ({
  message: one(gmailMessages, {
    fields: [gmailAttachments.messageId],
    references: [gmailMessages.id],
  }),
}))
