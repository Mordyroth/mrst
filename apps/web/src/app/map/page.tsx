'use client'

import { useState, useEffect } from 'react'

// Get API URL - use same origin in browser, env var for SSR
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'
}
const API_URL = getApiUrl()

interface VehicleLocation {
  id: string
  name: string
  vin: string
  make: string
  model: string
  year: number | null
  licensePlate: string
  unitNumber: string | null
  hqStatus: string | null
  location: {
    lat: number
    lng: number
    address: string | null
    speed: string | null
    updatedAt: string | null
  } | null
  ignitionOn: boolean
  isOnline: boolean
  status: string
}

interface VehicleStats {
  total: number
  active: number
  recentLocation: number
  moving: number
}

export default function MapPage() {
  const [vehicles, setVehicles] = useState<VehicleLocation[]>([])
  const [stats, setStats] = useState<VehicleStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      setError(null)

      try {
        const token = 'demo_token_permanent_access_2026'
        const headers = { Authorization: `Bearer ${token}` }

        // Fetch vehicles and stats in parallel
        const [vehiclesRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/trpc/vehicles.listWithLocation?input=${encodeURIComponent(JSON.stringify({
            json: { limit: 300, activeOnly: !showAll }
          }))}`, { headers }),
          fetch(`${API_URL}/trpc/vehicles.stats`, { headers }),
        ])

        if (vehiclesRes.ok) {
          const data = await vehiclesRes.json()
          setVehicles(data.result?.data?.json?.vehicles || [])
        }

        if (statsRes.ok) {
          const data = await statsRes.json()
          setStats(data.result?.data?.json || null)
        }
      } catch (err) {
        console.error('Failed to fetch vehicles:', err)
        setError('Failed to load vehicle data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [showAll])

  // Filter vehicles with valid locations
  const vehiclesWithLocation = vehicles.filter(v => v.location !== null)

  // Calculate map center (average of all locations, or NYC default)
  const center = vehiclesWithLocation.length > 0
    ? {
        lat: vehiclesWithLocation.reduce((sum, v) => sum + (v.location?.lat || 0), 0) / vehiclesWithLocation.length,
        lng: vehiclesWithLocation.reduce((sum, v) => sum + (v.location?.lng || 0), 0) / vehiclesWithLocation.length,
      }
    : { lat: 40.7128, lng: -74.0060 } // NYC default

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <span className="text-lg font-bold">MRST</span>
              <nav className="flex gap-4">
                <a href="/mrst/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
                  Dashboard
                </a>
                <a href="/mrst/timeline" className="text-sm text-muted-foreground hover:text-foreground">
                  Timeline
                </a>
                <a href="/mrst/map" className="text-sm font-medium">
                  Fleet Map
                </a>
                <a href="/mrst/suggestions" className="text-sm text-muted-foreground hover:text-foreground">
                  Suggestions
                </a>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">admin@travelautorental.com</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Fleet Map</h1>
            <p className="mt-1 text-muted-foreground">
              Real-time GPS locations for Travel Auto Rental Fleet
            </p>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm">Show inactive vehicles</span>
          </label>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm text-muted-foreground">Total Vehicles</div>
              <div className="mt-1 text-2xl font-bold">{stats.total}</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm text-muted-foreground">Active/Online</div>
              <div className="mt-1 text-2xl font-bold text-green-600">{stats.active}</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm text-muted-foreground">Recent Location (24h)</div>
              <div className="mt-1 text-2xl font-bold text-blue-600">{stats.recentLocation}</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm text-muted-foreground">Moving Now</div>
              <div className="mt-1 text-2xl font-bold text-orange-600">{stats.moving}</div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-96 rounded-lg border bg-card">
            <div className="text-muted-foreground">Loading vehicle locations...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-96 rounded-lg border bg-card">
            <div className="text-red-600">{error}</div>
          </div>
        ) : (
          <>
            {/* Map placeholder - using OpenStreetMap static image */}
            <div className="rounded-lg border bg-card overflow-hidden mb-6">
              <div className="h-96 bg-gray-100 relative">
                {vehiclesWithLocation.length > 0 ? (
                  <iframe
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    scrolling="no"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${center.lng - 0.5}%2C${center.lat - 0.3}%2C${center.lng + 0.5}%2C${center.lat + 0.3}&layer=mapnik&marker=${center.lat}%2C${center.lng}`}
                    style={{ border: 0 }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-muted-foreground">No vehicles with location data</div>
                  </div>
                )}
                <div className="absolute top-2 left-2 bg-white/90 rounded px-2 py-1 text-sm">
                  {vehiclesWithLocation.length} vehicles with GPS data
                </div>
              </div>
            </div>

            {/* Vehicle List */}
            <div className="rounded-lg border bg-card">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Vehicle Locations</h2>
                <p className="text-sm text-muted-foreground">
                  Showing {vehiclesWithLocation.length} of {vehicles.length} vehicles with GPS data
                </p>
              </div>
              <div className="divide-y max-h-96 overflow-auto">
                {vehiclesWithLocation.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No vehicles with valid location data
                  </div>
                ) : (
                  vehiclesWithLocation.map((vehicle) => (
                    <div key={vehicle.id} className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {vehicle.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {vehicle.location?.address || `${vehicle.location?.lat.toFixed(4)}, ${vehicle.location?.lng.toFixed(4)}`}
                        </div>
                        {vehicle.location?.updatedAt && (
                          <div className="text-xs text-muted-foreground">
                            Updated: {new Date(vehicle.location.updatedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {vehicle.hqStatus && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">
                            {vehicle.hqStatus}
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                          vehicle.isOnline
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {vehicle.isOnline ? 'Online' : 'Offline'}
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                          vehicle.ignitionOn
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {vehicle.ignitionOn ? 'Moving' : vehicle.status || 'Stopped'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
