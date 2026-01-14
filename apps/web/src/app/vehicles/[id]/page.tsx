'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Car,
  MapPin,
  ArrowLeft,
  Wifi,
  WifiOff,
  Navigation,
  Clock,
  AlertTriangle,
  ExternalLink,
  Gauge,
  Fuel,
  Calendar,
  DollarSign,
  FileText,
  Hash,
} from 'lucide-react'

// Get API URL
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'
}
const API_URL = getApiUrl()

interface VehicleDetail {
  id: string
  externalId: string
  vin: string | null
  licensePlate: string | null
  unitNumber: string | null
  year: number | null
  make: string | null
  model: string | null
  trim: string | null
  color: string | null
  vehicleType: string | null
  status: string | null
  availability: string | null
  currentMileage: number | null
  fuelLevel: number | null
  currentLocation: string | null
  dailyRate: string | null
  weeklyRate: string | null
  monthlyRate: string | null
  notes: string | null
  raw: Record<string, unknown> | null
  syncedAt: string | null
  gps: {
    lat: number | null
    lng: number | null
    address: string | null
    speed: number | null
    updatedAt: string | null
    ignitionOn: boolean | null
    isOnline: boolean | null
  } | null
}

// Shop location for "At Shop" calculation
const SHOP_LOCATION = { lat: 40.622877, lng: -73.993128 }
const SHOP_RADIUS_MILES = 0.3

function getDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

function isAtShop(lat: number, lng: number): boolean {
  return getDistanceMiles(lat, lng, SHOP_LOCATION.lat, SHOP_LOCATION.lng) <= SHOP_RADIUS_MILES
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Unknown'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function getStatusBadge(status: string | null) {
  switch (status?.toLowerCase()) {
    case 'available':
      return { className: 'bg-green-600 hover:bg-green-600', label: 'Available' }
    case 'rental':
      return { className: 'bg-blue-600 hover:bg-blue-600', label: 'Rented' }
    case 'maintenance':
      return { className: 'bg-orange-500 hover:bg-orange-500', label: 'Maintenance' }
    case 'out_of_service':
      return { className: 'bg-red-600 hover:bg-red-600', label: 'Out of Service' }
    default:
      return { className: 'bg-gray-500 hover:bg-gray-500', label: status || 'Unknown' }
  }
}

function formatCurrency(value: string | null): string {
  if (!value) return '-'
  const num = parseFloat(value)
  if (isNaN(num)) return value
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

export default function VehicleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const vehicleId = params.id as string

  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)

  const user = { email: 'admin@travelautorental.com', name: 'Admin' }

  useEffect(() => {
    async function fetchVehicle() {
      setIsLoading(true)
      setError(null)
      try {
        const token = 'demo_token_permanent_access_2026'
        const res = await fetch(
          `${API_URL}/trpc/vehicles.get?input=${encodeURIComponent(JSON.stringify({ json: { id: vehicleId } }))}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )

        if (!res.ok) {
          if (res.status === 404) {
            setError('Vehicle not found')
          } else {
            setError('Failed to load vehicle')
          }
          return
        }

        const data = await res.json()
        setVehicle(data.result?.data?.json || null)
      } catch (err) {
        console.error('Failed to fetch vehicle:', err)
        setError('Failed to load vehicle')
      } finally {
        setIsLoading(false)
      }
    }

    if (vehicleId) {
      fetchVehicle()
    }
  }, [vehicleId])

  const openInMaps = () => {
    if (vehicle?.gps?.lat && vehicle?.gps?.lng) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${vehicle.gps.lat},${vehicle.gps.lng}`,
        '_blank'
      )
    }
  }

  const statusBadge = vehicle ? getStatusBadge(vehicle.status) : null
  const atShop = vehicle?.gps?.lat && vehicle?.gps?.lng
    ? isAtShop(vehicle.gps.lat, vehicle.gps.lng)
    : null
  const vinLast6 = vehicle?.vin ? vehicle.vin.slice(-6) : null
  // Get unit number from unitNumber field or raw.vehicle_key
  const unitNumber = vehicle?.unitNumber || (vehicle?.raw as Record<string, unknown>)?.vehicle_key as string | null

  return (
    <AppLayout user={user}>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Back button */}
        <div className="mb-6">
          <Link href="/vehicles">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Vehicles
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h2 className="text-lg font-medium mb-2">{error}</h2>
              <p className="text-muted-foreground mb-4">
                The vehicle you&apos;re looking for could not be found.
              </p>
              <Link href="/vehicles">
                <Button>Back to Vehicles</Button>
              </Link>
            </CardContent>
          </Card>
        ) : vehicle ? (
          <>
            {/* Vehicle Image Hero */}
            {unitNumber && !imageError && (
              <div className="mb-6 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 p-4 sm:p-6">
                <img
                  src={`/mrst/images/vehicles/${unitNumber}.png`}
                  alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                  className="w-full max-w-md mx-auto h-auto object-contain"
                  style={{ maxHeight: '240px' }}
                  onError={() => setImageError(true)}
                />
              </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
              <div className="flex items-start gap-4">
                {(!unitNumber || imageError) && (
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Car className="h-8 w-8 text-primary" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold">
                    {unitNumber || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                  </h1>
                  <p className="text-muted-foreground">
                    {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim}
                  </p>
                  {vehicle.color && (
                    <p className="text-sm text-muted-foreground">{vehicle.color}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {statusBadge && (
                  <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
                )}
                {vehicle.gps?.isOnline && (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <Wifi className="h-3 w-3 mr-1" />
                    Online
                  </Badge>
                )}
                {vehicle.gps?.ignitionOn && (
                  <Badge variant="outline" className="text-orange-600 border-orange-600">
                    <Navigation className="h-3 w-3 mr-1" />
                    Moving
                  </Badge>
                )}
                {atShop !== null && (
                  <Badge variant="outline" className={atShop ? 'text-green-600 border-green-600' : 'text-orange-600 border-orange-600'}>
                    {atShop ? 'At Shop' : 'Away'}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Vehicle Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Vehicle Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {vehicle.vin && (
                      <div>
                        <div className="text-sm text-muted-foreground">VIN</div>
                        <div className="font-mono text-sm">{vehicle.vin}</div>
                      </div>
                    )}
                    {vehicle.licensePlate && (
                      <div>
                        <div className="text-sm text-muted-foreground">License Plate</div>
                        <div className="font-mono font-medium">{vehicle.licensePlate}</div>
                      </div>
                    )}
                    {unitNumber && (
                      <div>
                        <div className="text-sm text-muted-foreground">Unit Number</div>
                        <div className="font-medium">{unitNumber}</div>
                      </div>
                    )}
                    {vehicle.vehicleType && (
                      <div>
                        <div className="text-sm text-muted-foreground">Vehicle Type</div>
                        <div>{vehicle.vehicleType}</div>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t grid grid-cols-2 gap-4">
                    {vehicle.currentMileage && (
                      <div className="flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm text-muted-foreground">Odometer</div>
                          <div>{vehicle.currentMileage.toLocaleString()} mi</div>
                        </div>
                      </div>
                    )}
                    {vehicle.fuelLevel !== null && (
                      <div className="flex items-center gap-2">
                        <Fuel className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm text-muted-foreground">Fuel Level</div>
                          <div>{vehicle.fuelLevel}%</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {(vehicle.dailyRate || vehicle.weeklyRate || vehicle.monthlyRate) && (
                    <div className="pt-4 border-t">
                      <div className="text-sm font-medium mb-2">Rental Rates</div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Daily</div>
                          <div className="font-medium">{formatCurrency(vehicle.dailyRate)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Weekly</div>
                          <div className="font-medium">{formatCurrency(vehicle.weeklyRate)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Monthly</div>
                          <div className="font-medium">{formatCurrency(vehicle.monthlyRate)}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {vehicle.notes && (
                    <div className="pt-4 border-t">
                      <div className="text-sm font-medium mb-2">Notes</div>
                      <p className="text-sm text-muted-foreground">{vehicle.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* GPS Location */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>GPS Location</span>
                    {vehicle.gps?.lat && vehicle.gps?.lng && (
                      <Button variant="outline" size="sm" onClick={openInMaps}>
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Open in Maps
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {vehicle.gps?.lat && vehicle.gps?.lng ? (
                    <div className="space-y-4">
                      {/* Map embed */}
                      <div className="aspect-video rounded-lg overflow-hidden border bg-muted">
                        <iframe
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          style={{ border: 0 }}
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${vehicle.gps.lng - 0.01},${vehicle.gps.lat - 0.01},${vehicle.gps.lng + 0.01},${vehicle.gps.lat + 0.01}&layer=mapnik&marker=${vehicle.gps.lat},${vehicle.gps.lng}`}
                          allowFullScreen
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <div className="text-sm">
                              {vehicle.gps.address || `${vehicle.gps.lat.toFixed(6)}, ${vehicle.gps.lng.toFixed(6)}`}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Clock className="h-3 w-3" />
                              Last updated {formatTimeAgo(vehicle.gps.updatedAt)}
                            </div>
                          </div>
                        </div>

                        {vehicle.gps.speed !== null && vehicle.gps.speed > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <Navigation className="h-4 w-4 text-muted-foreground" />
                            <span>Speed: {vehicle.gps.speed} mph</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-sm">
                          {vehicle.gps.isOnline ? (
                            <>
                              <Wifi className="h-4 w-4 text-green-600" />
                              <span className="text-green-600">GPS Online</span>
                            </>
                          ) : (
                            <>
                              <WifiOff className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">GPS Offline</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <WifiOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No GPS data available for this vehicle</p>
                      <p className="text-sm mt-1">GPS device may not be installed or connected</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sync info */}
            {vehicle.syncedAt && (
              <div className="mt-6 text-xs text-muted-foreground text-center">
                Data synced from HQ {formatTimeAgo(vehicle.syncedAt)}
                {vehicle.externalId && <span className="ml-2">| HQ ID: {vehicle.externalId}</span>}
              </div>
            )}
          </>
        ) : null}
      </div>
    </AppLayout>
  )
}
