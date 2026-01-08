/**
 * Spireon / NSpire GPS API Client
 * Uses Basic Auth + X-Nspire-AppToken header for authentication
 * Based on working implementation from travelauto archive
 */

export interface SpireonConfig {
  identityUrl?: string
  restUrl?: string
  appToken: string
  username: string
  password: string
  nspireId: string // Also called account_id
}

export interface SpireonClient {
  getAssets(options?: { limit?: number; offset?: number; active?: boolean }): Promise<{ content: SpireonDevice[]; total: number }>
  getDevice(deviceId: string): Promise<SpireonDevice>
  getDeviceLocations(deviceId: string, startDate: Date, endDate: Date): Promise<SpireonLocation[]>
  getDeviceTrips(deviceId: string, startDate: Date, endDate: Date): Promise<SpireonTrip[]>
  getGeofences(): Promise<SpireonGeofence[]>
  getAlerts(startDate: Date, endDate: Date): Promise<SpireonAlert[]>
}

export interface SpireonDevice {
  deviceId: string
  deviceName: string
  serialNumber: string
  imei: string
  deviceType: string
  vehicleName: string
  vehicleVin: string
  vehicleLicensePlate: string
  vehicleYear: number
  vehicleMake: string
  vehicleModel: string
  status: string
  isOnline: boolean
  lastCommunication: string
  lastLocation: SpireonLocation | null
  raw: Record<string, unknown>
}

export interface SpireonLocation {
  lat: number
  lng: number
  altitude: number | null
  speed: number
  heading: number
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  eventType: string
  recordedAt: string
  odometer: number | null
  ignitionOn: boolean
  raw: Record<string, unknown>
}

export interface SpireonTrip {
  tripId: string
  startTime: string
  endTime: string
  startAddress: string
  endAddress: string
  distance: number
  duration: number
  maxSpeed: number
  avgSpeed: number
  idleTime: number
  raw: Record<string, unknown>
}

export interface SpireonGeofence {
  geofenceId: string
  name: string
  description: string
  type: 'circle' | 'polygon'
  centerLat: number | null
  centerLng: number | null
  radiusMeters: number | null
  polygon: Array<{ lat: number; lng: number }> | null
  isActive: boolean
  raw: Record<string, unknown>
}

export interface SpireonAlert {
  alertId: string
  alertType: string
  deviceId: string
  deviceName: string
  message: string
  occurredAt: string
  lat: number | null
  lng: number | null
  raw: Record<string, unknown>
}

// JWT token cache
let tokenCache: {
  token: string
  expiresAt: number
} | null = null

/**
 * Get Basic Auth header value
 */
function getBasicAuth(config: SpireonConfig): string {
  return Buffer.from(`${config.username}:${config.password}`).toString('base64')
}

/**
 * Get JWT token from identity endpoint (optional - can use Basic Auth directly)
 */
async function getJwtToken(config: SpireonConfig): Promise<string | null> {
  const now = Date.now()

  // Return cached token if still valid (with 60 second buffer)
  if (tokenCache && tokenCache.expiresAt > now + 60000) {
    return tokenCache.token
  }

  const identityUrl = config.identityUrl || 'https://identity.spireon.com/identity/token'

  try {
    const response = await fetch(identityUrl, {
      method: 'POST',
      headers: {
        'X-Nspire-AppToken': config.appToken,
        'Authorization': `Basic ${getBasicAuth(config)}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      // JWT auth failed, will fall back to Basic Auth
      return null
    }

    const data = await response.json() as { token?: string; expires_in?: number }

    if (data.token) {
      tokenCache = {
        token: data.token,
        expiresAt: now + ((data.expires_in || 3600) * 1000),
      }
      return tokenCache.token
    }
  } catch {
    // JWT auth failed, will fall back to Basic Auth
  }

  return null
}

/**
 * Make authenticated API request
 * Uses JWT Bearer token if available, otherwise falls back to Basic Auth
 */
async function apiRequest<T>(
  config: SpireonConfig,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const restUrl = config.restUrl || 'https://services.spireon.com/v0/rest'
  const url = `${restUrl}${endpoint}`

  // Try JWT first
  const jwtToken = await getJwtToken(config)

  const headers: Record<string, string> = {
    'X-Nspire-AppToken': config.appToken,
    'Accept': 'application/json',
  }

  if (jwtToken) {
    headers['Authorization'] = `Bearer ${jwtToken}`
  } else {
    // Fall back to Basic Auth (works per the archive code)
    headers['Authorization'] = `Basic ${getBasicAuth(config)}`
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers as Record<string, string>,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Spireon API error: ${response.status} ${errorText}`)
  }

  return response.json() as Promise<T>
}

/**
 * Create a Spireon API client
 */
export function createSpireonClient(config: SpireonConfig): SpireonClient {
  return {
    async getAssets(options: { limit?: number; offset?: number; active?: boolean } = {}): Promise<{ content: SpireonDevice[]; total: number }> {
      const params = new URLSearchParams()
      params.set('limit', String(options.limit ?? 100))
      params.set('offset', String(options.offset ?? 0))
      // Note: active filter is unreliable per archive code, filter in app instead

      const data = await apiRequest<any>(config, `/assets?${params}`)
      const devices = data.content || data.data || []
      const total = data.total || devices.length

      const content = devices.map((d: any) => ({
        deviceId: String(d.deviceId || d.id || d.DeviceId),
        deviceName: d.deviceName || d.name || d.DeviceName || '',
        serialNumber: d.serialNumber || d.SerialNumber || '',
        imei: d.imei || d.IMEI || '',
        deviceType: d.deviceType || d.DeviceType || '',
        vehicleName: d.vehicleName || d.vehicle?.name || d.VehicleName || '',
        vehicleVin: d.vehicleVin || d.vehicle?.vin || d.VIN || '',
        vehicleLicensePlate: d.vehicleLicensePlate || d.vehicle?.licensePlate || d.LicensePlate || '',
        vehicleYear: parseInt(d.vehicleYear || d.vehicle?.year || d.Year) || 0,
        vehicleMake: d.vehicleMake || d.vehicle?.make || d.Make || '',
        vehicleModel: d.vehicleModel || d.vehicle?.model || d.Model || '',
        status: d.status || d.Status || 'unknown',
        isOnline: d.isOnline || d.online || false,
        lastCommunication: d.lastCommunication || d.lastEventTime || d.LastCommunication || null,
        lastLocation: d.lastLocation ? {
          lat: d.lastLocation.latitude || d.lastLocation.lat,
          lng: d.lastLocation.longitude || d.lastLocation.lng,
          altitude: d.lastLocation.altitude || null,
          speed: d.lastLocation.speed || 0,
          heading: d.lastLocation.heading || 0,
          address: d.lastLocation.address || null,
          city: d.lastLocation.city || null,
          state: d.lastLocation.state || null,
          zipCode: d.lastLocation.zipCode || null,
          eventType: d.lastLocation.eventType || 'location',
          recordedAt: d.lastLocation.timestamp || d.lastLocation.recordedAt,
          odometer: d.lastLocation.odometer || null,
          ignitionOn: d.lastLocation.ignitionOn || false,
          raw: d.lastLocation,
        } : null,
        raw: d,
      }))

      return { content, total }
    },

    async getDevice(deviceId: string): Promise<SpireonDevice> {
      const data = await apiRequest<any>(config, `/devices/${deviceId}`)
      const d = data.device || data.data || data

      return {
        deviceId: String(d.deviceId || d.id || d.DeviceId),
        deviceName: d.deviceName || d.name || d.DeviceName || '',
        serialNumber: d.serialNumber || d.SerialNumber || '',
        imei: d.imei || d.IMEI || '',
        deviceType: d.deviceType || d.DeviceType || '',
        vehicleName: d.vehicleName || d.vehicle?.name || d.VehicleName || '',
        vehicleVin: d.vehicleVin || d.vehicle?.vin || d.VIN || '',
        vehicleLicensePlate: d.vehicleLicensePlate || d.vehicle?.licensePlate || d.LicensePlate || '',
        vehicleYear: parseInt(d.vehicleYear || d.vehicle?.year || d.Year) || 0,
        vehicleMake: d.vehicleMake || d.vehicle?.make || d.Make || '',
        vehicleModel: d.vehicleModel || d.vehicle?.model || d.Model || '',
        status: d.status || d.Status || 'unknown',
        isOnline: d.isOnline || d.online || false,
        lastCommunication: d.lastCommunication || d.lastEventTime || d.LastCommunication || null,
        lastLocation: d.lastLocation ? {
          lat: d.lastLocation.latitude || d.lastLocation.lat,
          lng: d.lastLocation.longitude || d.lastLocation.lng,
          altitude: d.lastLocation.altitude || null,
          speed: d.lastLocation.speed || 0,
          heading: d.lastLocation.heading || 0,
          address: d.lastLocation.address || null,
          city: d.lastLocation.city || null,
          state: d.lastLocation.state || null,
          zipCode: d.lastLocation.zipCode || null,
          eventType: d.lastLocation.eventType || 'location',
          recordedAt: d.lastLocation.timestamp || d.lastLocation.recordedAt,
          odometer: d.lastLocation.odometer || null,
          ignitionOn: d.lastLocation.ignitionOn || false,
          raw: d.lastLocation,
        } : null,
        raw: d,
      }
    },

    async getDeviceLocations(deviceId: string, startDate: Date, endDate: Date): Promise<SpireonLocation[]> {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })

      const data = await apiRequest<any>(config, `/devices/${deviceId}/locations?${params}`)
      const locations = Array.isArray(data) ? data : (data.locations || data.data || [])

      return locations.map((l: any) => ({
        lat: l.latitude || l.lat,
        lng: l.longitude || l.lng,
        altitude: l.altitude || null,
        speed: l.speed || 0,
        heading: l.heading || 0,
        address: l.address || null,
        city: l.city || null,
        state: l.state || null,
        zipCode: l.zipCode || null,
        eventType: l.eventType || l.type || 'location',
        recordedAt: l.timestamp || l.recordedAt || l.eventTime,
        odometer: l.odometer || null,
        ignitionOn: l.ignitionOn || l.ignition || false,
        raw: l,
      }))
    },

    async getDeviceTrips(deviceId: string, startDate: Date, endDate: Date): Promise<SpireonTrip[]> {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })

      const data = await apiRequest<any>(config, `/devices/${deviceId}/trips?${params}`)
      const trips = Array.isArray(data) ? data : (data.trips || data.data || [])

      return trips.map((t: any) => ({
        tripId: String(t.tripId || t.id),
        startTime: t.startTime || t.startDate,
        endTime: t.endTime || t.endDate,
        startAddress: t.startAddress || t.origin || '',
        endAddress: t.endAddress || t.destination || '',
        distance: t.distance || t.mileage || 0,
        duration: t.duration || 0,
        maxSpeed: t.maxSpeed || 0,
        avgSpeed: t.avgSpeed || t.averageSpeed || 0,
        idleTime: t.idleTime || 0,
        raw: t,
      }))
    },

    async getGeofences(): Promise<SpireonGeofence[]> {
      const data = await apiRequest<any>(config, '/geofences')
      const geofences = Array.isArray(data) ? data : (data.geofences || data.data || [])

      return geofences.map((g: any) => ({
        geofenceId: String(g.geofenceId || g.id),
        name: g.name || '',
        description: g.description || '',
        type: g.type === 'polygon' ? 'polygon' : 'circle',
        centerLat: g.centerLat || g.center?.lat || g.latitude || null,
        centerLng: g.centerLng || g.center?.lng || g.longitude || null,
        radiusMeters: g.radiusMeters || g.radius || null,
        polygon: g.polygon || g.points || null,
        isActive: g.isActive !== false,
        raw: g,
      }))
    },

    async getAlerts(startDate: Date, endDate: Date): Promise<SpireonAlert[]> {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })

      const data = await apiRequest<any>(config, `/alerts?${params}`)
      const alerts = Array.isArray(data) ? data : (data.alerts || data.data || [])

      return alerts.map((a: any) => ({
        alertId: String(a.alertId || a.id),
        alertType: a.alertType || a.type || 'unknown',
        deviceId: String(a.deviceId || a.device?.id || ''),
        deviceName: a.deviceName || a.device?.name || '',
        message: a.message || a.description || '',
        occurredAt: a.occurredAt || a.timestamp || a.eventTime,
        lat: a.lat || a.latitude || a.location?.lat || null,
        lng: a.lng || a.longitude || a.location?.lng || null,
        raw: a,
      }))
    },
  }
}

/**
 * Load Spireon config from environment
 */
export function loadSpireonConfig(): SpireonConfig {
  const appToken = process.env.SPIREON_APP_TOKEN
  const username = process.env.SPIREON_USERNAME
  const password = process.env.SPIREON_PASSWORD
  const nspireId = process.env.SPIREON_NSPIRE_ID

  if (!appToken || !username || !password || !nspireId) {
    throw new Error('Missing Spireon configuration. Set SPIREON_APP_TOKEN, SPIREON_USERNAME, SPIREON_PASSWORD, SPIREON_NSPIRE_ID')
  }

  return {
    identityUrl: process.env.SPIREON_IDENTITY_URL || 'https://identity.spireon.com/identity/token',
    restUrl: process.env.SPIREON_REST_URL || 'https://services.spireon.com/v0/rest',
    appToken,
    username,
    password,
    nspireId,
  }
}
