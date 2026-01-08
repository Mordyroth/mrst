/**
 * MRST Database Schema
 *
 * Schema organization:
 * - platform: Multi-tenant, users, sessions, auth
 * - integrations: Integration accounts, sync tracking
 * - monday: Monday.com mirror tables
 * - hq: HQ Rental mirror tables
 * - gmail: Gmail mirror tables
 * - spireon: Spireon GPS mirror tables
 * - whatsapp: WhatsApp mirror tables
 * - core: Unified entities (customers, vehicles)
 * - timeline: Unified activity timeline
 */

// Platform tables
export * from './platform'

// Integration infrastructure
export * from './integrations'

// Mirror tables
export * from './monday'
export * from './hq'
export * from './gmail'
export * from './spireon'
export * from './whatsapp'

// Core unified entities
export * from './core'

// Timeline
export * from './timeline'

// AI Intelligence Layer
export * from './ai'
