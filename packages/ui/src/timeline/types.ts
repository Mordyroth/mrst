/**
 * Timeline component types
 */

export type TimelineSource = 'monday' | 'hq' | 'gmail' | 'spireon' | 'whatsapp' | 'system'

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

export interface TimelineEventData {
  id: string
  eventType: TimelineEventType
  source: TimelineSource
  title: string | null
  summary: string | null
  content: string | null
  actorName: string | null
  actorEmail: string | null
  occurredAt: string
  isPinned: boolean
  isInternal: boolean
  metadata: Record<string, unknown> | null
  links?: TimelineEventLink[]
  // Collapse fields (optional)
  collapseGroupKey?: string | null
  collapsedCount?: number
  collapsedIds?: string[]
}

export interface TimelineEventLink {
  id: string
  entityType: string
  entityId: string
  linkType: string | null
}

export interface TimelineFiltersState {
  sources: TimelineSource[]
  eventTypes: TimelineEventType[]
  searchQuery: string
  dateFrom: string | null
  dateTo: string | null
}

export const SOURCE_LABELS: Record<TimelineSource, string> = {
  monday: 'Monday.com',
  hq: 'HQ Rental',
  gmail: 'Gmail',
  spireon: 'Spireon GPS',
  whatsapp: 'WhatsApp',
  system: 'System',
}

export const SOURCE_COLORS: Record<TimelineSource, string> = {
  monday: 'bg-purple-100 text-purple-700 border-purple-200',
  hq: 'bg-blue-100 text-blue-700 border-blue-200',
  gmail: 'bg-red-100 text-red-700 border-red-200',
  spireon: 'bg-green-100 text-green-700 border-green-200',
  whatsapp: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  system: 'bg-gray-100 text-gray-700 border-gray-200',
}

export const EVENT_TYPE_LABELS: Partial<Record<TimelineEventType, string>> = {
  // Monday
  monday_update: 'Update',
  monday_reply: 'Reply',
  monday_activity: 'Activity',
  monday_value_change: 'Value Change',
  // HQ
  hq_reservation_created: 'Reservation Created',
  hq_reservation_updated: 'Reservation Updated',
  hq_contract_started: 'Contract Started',
  hq_contract_ended: 'Contract Ended',
  hq_payment: 'Payment',
  hq_charge: 'Charge',
  // Gmail
  gmail_received: 'Email Received',
  gmail_sent: 'Email Sent',
  // Spireon
  spireon_location: 'Location Update',
  spireon_diagnostic: 'Diagnostic',
  spireon_geofence_enter: 'Entered Geofence',
  spireon_geofence_exit: 'Exited Geofence',
  spireon_ignition_on: 'Ignition On',
  spireon_ignition_off: 'Ignition Off',
  // WhatsApp
  whatsapp_received: 'Message Received',
  whatsapp_sent: 'Message Sent',
  // System
  system_note: 'Note',
  system_alert: 'Alert',
  system_merge: 'Record Merged',
}
