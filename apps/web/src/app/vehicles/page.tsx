'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Car,
  MapPin,
  Search,
  Filter,
  Navigation,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Get API URL
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'
}
const API_URL = getApiUrl()

interface Vehicle {
  id: string
  externalId: string | null
  name: string
  vin: string | null
  make: string | null
  model: string | null
  year: number | null
  licensePlate: string | null
  unitNumber: string | null
  color: string | null
  hqStatus: string | null
  hqStatusLabel: string | null
  hqStatusColor: string | null
  odometer: number | null
  fuelLevel: number | null
  vehicleClass: string | null
  location: {
    lat: number
    lng: number
    address: string | null
    city: string | null
    speed: string | null
    updatedAt: string | null
  } | null
  hqLocation: {
    lat: number
    lng: number
    updatedAt: string | null
  } | null
  ignitionOn: boolean | null
  isOnline: boolean
  lastAtShopAt: string | null
}

interface VehicleStats {
  total: number
  available: number
  rented: number
  maintenance: number
  outOfService: number
  active: number
  recentLocation: number
  moving: number
}

// Shop location for "At Shop" calculation
const SHOP_LOCATION = { lat: 40.622877, lng: -73.993128 }
const SHOP_RADIUS_MILES = 0.3

// Status colors
function getStatusColor(status: string | null) {
  switch (status) {
    case 'available': return 'bg-green-500'
    case 'rental': return 'bg-blue-500'
    case 'maintenance': return 'bg-orange-500'
    case 'out_of_service': return 'bg-red-500'
    default: return 'bg-gray-400'
  }
}

function getStatusLabel(status: string | null) {
  switch (status) {
    case 'available': return 'Avail'
    case 'rental': return 'Rented'
    case 'maintenance': return 'Maint'
    case 'out_of_service': return 'OOS'
    default: return status || '?'
  }
}

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
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d`
}

function isRecentGps(dateStr: string | null): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const hours = diffMs / (1000 * 60 * 60)
  return hours <= 24
}

function hasAnomaly(vehicle: Vehicle): boolean {
  if (vehicle.hqStatus !== 'available') return false
  if (!vehicle.location) return false
  if (!isRecentGps(vehicle.location.updatedAt)) return false
  return !isAtShop(vehicle.location.lat, vehicle.location.lng)
}

// Compact Vehicle Card - horizontal layout with inline image
function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const atShop = vehicle.location ? isAtShop(vehicle.location.lat, vehicle.location.lng) : false
  const isAnomaly = hasAnomaly(vehicle)
  const [imageError, setImageError] = useState(false)
  // Use unitNumber for image filename (e.g., V385.png, G304.png)
  const imageUrl = vehicle.unitNumber ? `/mrst/images/vehicles/${vehicle.unitNumber}.png` : null

  return (
    <Link href={`/mrst/vehicles/${vehicle.id}`} className="block">
      <div className={`group flex border rounded-lg overflow-hidden hover:border-primary hover:shadow-md transition-all cursor-pointer ${
        isAnomaly
          ? 'border-orange-400 bg-orange-50/50 dark:bg-orange-950/20'
          : atShop
            ? 'border-green-300 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20'
            : 'border-border bg-card'
      }`} style={{ height: '72px' }}>
        {/* Image - transparent background floats on card */}
        <div className="flex-shrink-0" style={{ width: '115px', height: '72px' }}>
          {imageUrl && !imageError ? (
            <img
              src={imageUrl}
              alt={`${vehicle.make} ${vehicle.model}`}
              className="w-full h-full object-contain"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted/30">
              <Car className="h-6 w-6 text-muted-foreground/30" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 p-2 flex flex-col justify-center">
          {/* Top row: Unit + Status */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm truncate">
              {vehicle.unitNumber || '?'}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${getStatusColor(vehicle.hqStatus)}`}>
              {getStatusLabel(vehicle.hqStatus)}
            </span>
            {isAnomaly && (
              <AlertTriangle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
            )}
            {vehicle.ignitionOn && (
              <Navigation className="h-3 w-3 text-orange-500 flex-shrink-0" />
            )}
          </div>

          {/* Middle row: Make/Model */}
          <div className="text-xs text-muted-foreground truncate">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </div>

          {/* Bottom row: Location info */}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            {vehicle.location ? (
              <>
                <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                <span className={`truncate ${atShop ? 'text-green-600 font-medium' : ''}`}>
                  {atShop ? 'At Shop' : vehicle.location.city || 'Away'}
                </span>
                {vehicle.location.updatedAt && (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <Clock className="h-2.5 w-2.5" />
                    <span>{formatTimeAgo(vehicle.location.updatedAt)}</span>
                  </>
                )}
              </>
            ) : (
              <span className="text-muted-foreground/50">No GPS</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

function VehicleCardSkeleton() {
  return (
    <div className="flex border rounded-lg overflow-hidden" style={{ height: '72px' }}>
      <Skeleton className="flex-shrink-0 bg-gray-100" style={{ width: '115px', height: '72px' }} />
      <div className="flex-1 p-2 flex flex-col justify-center gap-1">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2.5 w-16" />
      </div>
    </div>
  )
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [stats, setStats] = useState<VehicleStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAvailable, setShowAvailable] = useState(true)
  const [showRented, setShowRented] = useState(true)
  const [showMaintenance, setShowMaintenance] = useState(true)
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false)

  const user = { email: 'admin@travelautorental.com', name: 'Admin' }

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      try {
        const token = 'demo_token_permanent_access_2026'
        const headers = { Authorization: `Bearer ${token}` }

        const [vehiclesRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/trpc/vehicles.listWithLocation?input=${encodeURIComponent(JSON.stringify({
            json: { limit: 300, activeOnly: true }
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
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  // Sort and filter vehicles
  const { filteredVehicles, totalAnomalies } = useMemo(() => {
    let result: Vehicle[] = []
    let anomalyCount = 0

    for (const v of vehicles) {
      const isAnomaly = hasAnomaly(v)
      if (isAnomaly) anomalyCount++

      // Filter by anomaly mode
      if (showAnomaliesOnly && !isAnomaly) continue

      // HQ Status filters
      if (!showAvailable && v.hqStatus === 'available') continue
      if (!showRented && v.hqStatus === 'rental') continue
      if (!showMaintenance && (v.hqStatus === 'maintenance' || v.hqStatus === 'out_of_service')) continue

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const searchFields = [
          v.name, v.vin, v.licensePlate, v.make, v.model,
          v.unitNumber, v.color, v.vehicleClass, v.location?.address,
        ].filter(Boolean).map(s => s!.toLowerCase())

        if (!searchFields.some(field => field.includes(query))) continue
      }

      result.push(v)
    }

    // Sort: Anomalies first, then At Shop, then by status
    result.sort((a, b) => {
      const aAnomaly = hasAnomaly(a) ? 0 : 1
      const bAnomaly = hasAnomaly(b) ? 0 : 1
      if (aAnomaly !== bAnomaly) return aAnomaly - bAnomaly

      const aAtShop = a.location ? isAtShop(a.location.lat, a.location.lng) : false
      const bAtShop = b.location ? isAtShop(b.location.lat, b.location.lng) : false
      if (aAtShop !== bAtShop) return aAtShop ? -1 : 1

      const nameA = a.unitNumber || a.name || ''
      const nameB = b.unitNumber || b.name || ''
      return nameA.localeCompare(nameB)
    })

    return { filteredVehicles: result, totalAnomalies: anomalyCount }
  }, [vehicles, searchQuery, showAvailable, showRented, showMaintenance, showAnomaliesOnly])

  return (
    <AppLayout user={user}>
      <div className="p-2 sm:p-4 lg:p-6">
        {/* Compact Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <h1 className="text-xl font-bold">Vehicles</h1>
          {stats && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">{stats.total} total</span>
              <span className="text-green-600 font-medium">{stats.available} avail</span>
              <span className="text-blue-600 font-medium">{stats.rented} rented</span>
            </div>
          )}
        </div>

        {/* Search and Filters - compact */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          {totalAnomalies > 0 && (
            <Button
              variant={showAnomaliesOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowAnomaliesOnly(!showAnomaliesOnly)}
              className={`h-8 px-2 ${showAnomaliesOnly ? 'bg-orange-600 hover:bg-orange-700' : 'border-orange-400 text-orange-600'}`}
            >
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              {totalAnomalies}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2">
                <Filter className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem checked={showAvailable} onCheckedChange={setShowAvailable}>
                Available
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={showRented} onCheckedChange={setShowRented}>
                Rented
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={showMaintenance} onCheckedChange={setShowMaintenance}>
                Maintenance
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Results count */}
        <div className="text-xs text-muted-foreground mb-2">
          {filteredVehicles.length} vehicles
        </div>

        {/* Vehicle Grid - 1-column on mobile for more room, more on larger screens */}
        {isLoading ? (
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {[...Array(12)].map((_, i) => (
              <VehicleCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredVehicles.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Car className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No vehicles found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredVehicles.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
