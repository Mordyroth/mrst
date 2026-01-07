/**
 * WhatsApp mirror tables (360Dialog)
 * Mirrors: contacts, conversations, messages, media
 */

import { pgTable, uuid, text, timestamp, boolean, jsonb, bigint, index, unique } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { integrationAccounts } from './integrations'

/**
 * WhatsApp business accounts
 */
export const whatsappAccounts = pgTable('whatsapp_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  phoneNumber: text('phone_number').notNull(), // Business phone number
  phoneNumberId: text('phone_number_id'), // 360Dialog ID
  displayName: text('display_name'),
  // Status
  isActive: boolean('is_active').default(true),
  lastWebhookAt: timestamp('last_webhook_at', { withTimezone: true }),
  // Mirror fields
  raw: jsonb('raw'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('whatsapp_accounts_integration_phone').on(table.integrationAccountId, table.phoneNumber),
  index('whatsapp_accounts_phone_number_idx').on(table.phoneNumber),
])

/**
 * WhatsApp contacts
 */
export const whatsappContacts = pgTable('whatsapp_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  whatsappAccountId: uuid('whatsapp_account_id').notNull().references(() => whatsappAccounts.id),
  waId: text('wa_id').notNull(), // WhatsApp ID (usually phone number)
  phoneNumber: text('phone_number'),
  phoneNumberNormalized: text('phone_number_normalized'), // E.164
  // Profile info (from WhatsApp)
  profileName: text('profile_name'),
  // Custom fields we track
  displayName: text('display_name'), // Our display name for them
  notes: text('notes'),
  // Conversation stats
  messageCount: bigint('message_count', { mode: 'number' }).default(0),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  // Mirror fields
  raw: jsonb('raw'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('whatsapp_contacts_account_wa_id').on(table.whatsappAccountId, table.waId),
  index('whatsapp_contacts_wa_id_idx').on(table.waId),
  index('whatsapp_contacts_phone_number_normalized_idx').on(table.phoneNumberNormalized),
])

/**
 * WhatsApp messages
 */
export const whatsappMessages = pgTable('whatsapp_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  whatsappAccountId: uuid('whatsapp_account_id').notNull().references(() => whatsappAccounts.id),
  contactId: uuid('contact_id').references(() => whatsappContacts.id),
  externalId: text('external_id').notNull(), // WhatsApp message ID
  // Direction
  direction: text('direction').$type<'inbound' | 'outbound'>().notNull(),
  // Sender/receiver
  fromNumber: text('from_number'),
  toNumber: text('to_number'),
  // Message type
  messageType: text('message_type').notNull(), // 'text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'sticker', 'template'
  // Content
  textBody: text('text_body'),
  caption: text('caption'), // For media messages
  // For location messages
  locationLat: text('location_lat'),
  locationLng: text('location_lng'),
  locationName: text('location_name'),
  locationAddress: text('location_address'),
  // For contact messages
  contactVcard: text('contact_vcard'),
  // Template info (for outbound)
  templateName: text('template_name'),
  templateLanguage: text('template_language'),
  templateParameters: jsonb('template_parameters'),
  // Status
  status: text('status'), // 'sent', 'delivered', 'read', 'failed'
  statusUpdatedAt: timestamp('status_updated_at', { withTimezone: true }),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  // Context (reply-to)
  contextMessageId: text('context_message_id'),
  isForwarded: boolean('is_forwarded').default(false),
  // Timing
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  readAt: timestamp('read_at', { withTimezone: true }),
  // Mirror fields
  raw: jsonb('raw').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  sourceHash: text('source_hash').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('whatsapp_messages_account_external_id').on(table.whatsappAccountId, table.externalId),
  index('whatsapp_messages_whatsapp_account_id_idx').on(table.whatsappAccountId),
  index('whatsapp_messages_contact_id_idx').on(table.contactId),
  index('whatsapp_messages_sent_at_idx').on(table.sentAt),
  index('whatsapp_messages_direction_idx').on(table.direction),
])

/**
 * WhatsApp media (images, videos, audio, documents)
 */
export const whatsappMedia = pgTable('whatsapp_media', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationAccountId: uuid('integration_account_id').notNull().references(() => integrationAccounts.id),
  messageId: uuid('message_id').notNull().references(() => whatsappMessages.id),
  externalId: text('external_id').notNull(), // Media ID from WhatsApp
  // Media details
  mediaType: text('media_type').notNull(), // 'image', 'video', 'audio', 'document', 'sticker'
  mimeType: text('mime_type'),
  filename: text('filename'),
  fileSize: bigint('file_size', { mode: 'number' }),
  sha256: text('sha256'),
  // URLs
  url: text('url'), // Temporary WhatsApp URL
  urlExpiresAt: timestamp('url_expires_at', { withTimezone: true }),
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
  unique('whatsapp_media_message_external_id').on(table.messageId, table.externalId),
  index('whatsapp_media_message_id_idx').on(table.messageId),
])

// Relations
export const whatsappAccountsRelations = relations(whatsappAccounts, ({ one, many }) => ({
  integrationAccount: one(integrationAccounts, {
    fields: [whatsappAccounts.integrationAccountId],
    references: [integrationAccounts.id],
  }),
  contacts: many(whatsappContacts),
  messages: many(whatsappMessages),
}))

export const whatsappContactsRelations = relations(whatsappContacts, ({ one, many }) => ({
  whatsappAccount: one(whatsappAccounts, {
    fields: [whatsappContacts.whatsappAccountId],
    references: [whatsappAccounts.id],
  }),
  messages: many(whatsappMessages),
}))

export const whatsappMessagesRelations = relations(whatsappMessages, ({ one, many }) => ({
  whatsappAccount: one(whatsappAccounts, {
    fields: [whatsappMessages.whatsappAccountId],
    references: [whatsappAccounts.id],
  }),
  contact: one(whatsappContacts, {
    fields: [whatsappMessages.contactId],
    references: [whatsappContacts.id],
  }),
  media: many(whatsappMedia),
}))

export const whatsappMediaRelations = relations(whatsappMedia, ({ one }) => ({
  message: one(whatsappMessages, {
    fields: [whatsappMedia.messageId],
    references: [whatsappMessages.id],
  }),
}))
