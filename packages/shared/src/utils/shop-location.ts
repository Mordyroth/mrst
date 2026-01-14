/**
 * Shop Location Utilities
 * Reusable functions for determining if a vehicle is at the shop location
 */

// Travel Auto Rental shop location - 1621 63rd Street, Brooklyn
export const SHOP_LOCATION = {
  lat: 40.622877,
  lng: -73.993128,
  address: '1621 63rd Street, Brooklyn, NY',
  radiusMiles: 0.3,
  radiusMeters: 482, // ~0.3 miles
} as const

/**
 * Calculate distance in miles between two coordinates using Haversine formula
 */
export function getDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959 // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Check if a coordinate is within the shop geofence
 */
export function isAtShop(lat: number, lng: number): boolean {
  return getDistanceMiles(lat, lng, SHOP_LOCATION.lat, SHOP_LOCATION.lng) <= SHOP_LOCATION.radiusMiles
}

/**
 * Format a timestamp as relative time (e.g., "5m ago", "2h ago")
 */
export function formatTimeAgo(dateStr: string | Date | null): string {
  if (!dateStr) return 'Unknown'
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  const diffWeeks = Math.floor(diffDays / 7)
  return `${diffWeeks}w ago`
}

/**
 * Check if GPS data is recent (within last 24 hours)
 */
export function isRecentGps(dateStr: string | Date | null): boolean {
  if (!dateStr) return false
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const hours = diffMs / (1000 * 60 * 60)
  return hours <= 24
}

/**
 * Determine location status for a vehicle
 */
export type LocationStatus = 'at_shop' | 'out_with_renter' | 'away_from_shop' | 'in_field' | 'no_gps'

export interface LocationStatusInfo {
  status: LocationStatus
  label: string
  color: 'green' | 'blue' | 'orange' | 'gray'
}

export function getLocationStatus(
  location: { lat: number; lng: number } | null,
  hqStatus: string | null
): LocationStatusInfo {
  if (!location) {
    return { status: 'no_gps', label: 'No GPS', color: 'gray' }
  }

  const atShop = isAtShop(location.lat, location.lng)
  const isRented = hqStatus === 'rental'
  const isAvailable = hqStatus === 'available'

  if (atShop) {
    return { status: 'at_shop', label: 'At Shop', color: 'green' }
  }
  if (isRented) {
    return { status: 'out_with_renter', label: 'Out with Renter', color: 'blue' }
  }
  if (isAvailable) {
    return { status: 'away_from_shop', label: 'Away from Shop', color: 'orange' }
  }
  return { status: 'in_field', label: 'In Field', color: 'gray' }
}
