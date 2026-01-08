/**
 * Spireon GPS integration
 *
 * Provides:
 * - API client with Basic Auth + X-Nspire-AppToken
 * - Device/asset sync
 * - Location history
 * - Geofence management
 */

export * from './client'
export * from './sync'

export const SPIREON_CLIENT_VERSION = '0.2.0'
