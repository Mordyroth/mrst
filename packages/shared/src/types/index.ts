/**
 * Common types used across MRST packages
 */

import { z } from 'zod'

/** Standard UUID type */
export type UUID = string

/** ISO 8601 timestamp string */
export type Timestamp = string

/** Integration source names */
export const IntegrationSource = {
  MONDAY: 'monday',
  HQ: 'hq',
  GMAIL: 'gmail',
  SPIREON: 'spireon',
  WHATSAPP: 'whatsapp',
} as const

export type IntegrationSource = (typeof IntegrationSource)[keyof typeof IntegrationSource]

/** Sync status for records */
export const SyncStatus = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  SUCCESS: 'success',
  ERROR: 'error',
} as const

export type SyncStatus = (typeof SyncStatus)[keyof typeof SyncStatus]

/** Standard API response wrapper */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

/** Pagination parameters */
export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
})

export type Pagination = z.infer<typeof PaginationSchema>

/** Paginated response */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** User role definitions */
export const UserRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  DRIVER: 'driver',
  READONLY: 'readonly',
} as const

export type UserRole = (typeof UserRole)[keyof typeof UserRole]

/** Timeline event types */
export const TimelineEventType = {
  // Monday.com
  MONDAY_UPDATE: 'monday_update',
  MONDAY_REPLY: 'monday_reply',
  MONDAY_ACTIVITY: 'monday_activity',
  MONDAY_VALUE_CHANGE: 'monday_value_change',
  // HQ
  HQ_RESERVATION: 'hq_reservation',
  HQ_CONTRACT: 'hq_contract',
  HQ_PAYMENT: 'hq_payment',
  HQ_CHARGE: 'hq_charge',
  // Gmail
  GMAIL_MESSAGE: 'gmail_message',
  // Spireon
  SPIREON_LOCATION: 'spireon_location',
  SPIREON_DIAGNOSTIC: 'spireon_diagnostic',
  SPIREON_GEOFENCE: 'spireon_geofence',
  // WhatsApp
  WHATSAPP_MESSAGE: 'whatsapp_message',
  // System
  SYSTEM_NOTE: 'system_note',
  SYSTEM_ALERT: 'system_alert',
} as const

export type TimelineEventType = (typeof TimelineEventType)[keyof typeof TimelineEventType]
