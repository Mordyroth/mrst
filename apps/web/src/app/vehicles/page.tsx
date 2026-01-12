'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Car,
  MapPin,
  Search,
  Filter,
  Wifi,
  WifiOff,
  Navigation,
  Clock,
  AlertTriangle,
  ExternalLink,
  MessageSquarePlus,
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

// Shop location for "At Shop" calculation (Travel Auto Rental - 1621 63rd Street, Brooklyn)
const SHOP_LOCATION = { lat: 40.622877, lng: -73.993128 }
const SHOP_RADIUS_MILES = 0.3

// HQ Status badge styling
function getHqStatusBadge(status: string | null) {
  switch (status) {
    case 'available':
      return { variant: 'default' as const, className: 'bg-green-600 hover:bg-green-600', label: 'Available' }
    case 'rental':
      return { variant: 'default' as const, className: 'bg-blue-600 hover:bg-blue-600', label: 'Rented' }
    case 'maintenance':
      return { variant: 'default' as const, className: 'bg-orange-500 hover:bg-orange-500', label: 'Maintenance' }
    case 'out_of_service':
      return { variant: 'destructive' as const, className: '', label: 'Out of Service' }
    default:
      return { variant: 'secondary' as const, className: '', label: status || 'Unknown' }
  }
}

function getDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959 // Earth's radius in miles
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

// Check if GPS data is within last 24 hours
function isRecentGps(dateStr: string | null): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const hours = diffMs / (1000 * 60 * 60)
  return hours <= 24
}

// Anomaly detection: Vehicle available but not at shop with recent GPS
function hasAnomaly(vehicle: Vehicle): boolean {
  if (vehicle.hqStatus !== 'available') return false
  if (!vehicle.location) return false
  if (!isRecentGps(vehicle.location.updatedAt)) return false
  return !isAtShop(vehicle.location.lat, vehicle.location.lng)
}

// Anomaly Card Component - prominent warning for vehicles that need attention
function AnomalyCard({ vehicle, onAddNote }: { vehicle: Vehicle; onAddNote: (v: Vehicle) => void }) {
  const openInMaps = () => {
    if (vehicle.location) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${vehicle.location.lat},${vehicle.location.lng}`,
        '_blank'
      )
    }
  }

  return (
    <Card className="border-orange-400 bg-orange-50 dark:bg-orange-950/20">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/50">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-lg">
                  {vehicle.unitNumber || vehicle.name?.split(' - ')[0] || 'Unknown'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </div>
              </div>
              <Badge className="bg-green-600 hover:bg-green-600 shrink-0">Available</Badge>
            </div>

            <div className="mt-3 p-3 rounded-lg bg-orange-100/50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800">
              <div className="text-sm font-medium text-orange-800 dark:text-orange-200">
                Vehicle available but not at shop
              </div>
              {vehicle.location && (
                <div className="mt-2 text-sm text-orange-700 dark:text-orange-300">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                    <span className="break-words">
                      {vehicle.location.address || `${vehicle.location.lat.toFixed(4)}, ${vehicle.location.lng.toFixed(4)}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs opacity-80">
                    <Clock className="h-3 w-3" />
                    {formatTimeAgo(vehicle.location.updatedAt)}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-orange-300 hover:bg-orange-100"
                onClick={() => onAddNote(vehicle)}
              >
                <MessageSquarePlus className="h-4 w-4 mr-1" />
                Add note
              </Button>
              {vehicle.location && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={openInMaps}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View in Maps
                </Button>
              )}
              <Link href={`/mrst/vehicles/${vehicle.id}`}>
                <Button size="sm" variant="ghost">
                  View details
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const atShop = vehicle.location ? isAtShop(vehicle.location.lat, vehicle.location.lng) : false
  const vinLast6 = vehicle.vin ? vehicle.vin.slice(-6) : null
  const statusBadge = getHqStatusBadge(vehicle.hqStatus)

  return (
    <Link href={`/mrst/vehicles/${vehicle.id}`}>
      <Card className="hover:border-primary transition-colors cursor-pointer h-full">
        <CardContent className="p-4">
          {/* Header with unit number and HQ status */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="font-semibold text-lg">
                {vehicle.unitNumber || vehicle.name?.split(' - ')[0] || 'Unknown'}
              </div>
              <div className="text-sm text-muted-foreground">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </div>
              {vehicle.color && (
                <div className="text-xs text-muted-foreground">{vehicle.color}</div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant={statusBadge.variant} className={statusBadge.className}>
                {statusBadge.label}
              </Badge>
              {vehicle.ignitionOn && (
                <Badge variant="outline" className="text-orange-600 border-orange-600">
                  <Navigation className="h-3 w-3 mr-1" />
                  Moving
                </Badge>
              )}
            </div>
          </div>

          {/* Vehicle details */}
          <div className="space-y-1.5 text-sm">
            {vehicle.licensePlate && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-16">Plate:</span>
                <span className="font-mono">{vehicle.licensePlate}</span>
              </div>
            )}
            {vinLast6 && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-16">VIN:</span>
                <span className="font-mono">...{vinLast6}</span>
              </div>
            )}
            {vehicle.vehicleClass && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-16">Class:</span>
                <span>{vehicle.vehicleClass}</span>
              </div>
            )}
          </div>

          {/* Location */}
          {vehicle.location ? (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">
                    {vehicle.location.address || `${vehicle.location.lat.toFixed(4)}, ${vehicle.location.lng.toFixed(4)}`}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    {formatTimeAgo(vehicle.location.updatedAt)}
                    {atShop && (
                      <Badge variant="outline" className="text-xs py-0 px-1 text-green-600 border-green-600">At Shop</Badge>
                    )}
                    {vehicle.isOnline && (
                      <Badge variant="outline" className="text-xs py-0 px-1">
                        <Wifi className="h-2.5 w-2.5 mr-0.5" />
                        GPS
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                No GPS data
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

function VehicleCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <Skeleton className="h-6 w-16 mb-1" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="mt-3 pt-3 border-t">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-20 mt-1" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [stats, setStats] = useState<VehicleStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  // HQ status filters
  const [showAvailable, setShowAvailable] = useState(true)
  const [showRented, setShowRented] = useState(true)
  const [showMaintenance, setShowMaintenance] = useState(true)
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false)
  // Note modal state
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [noteVehicle, setNoteVehicle] = useState<Vehicle | null>(null)
  const [noteText, setNoteText] = useState('')

  const user = { email: 'admin@travelautorental.com', name: 'Admin' }

  const handleAddNote = (vehicle: Vehicle) => {
    setNoteVehicle(vehicle)
    setNoteText('')
    setNoteModalOpen(true)
  }

  const handleSaveNote = async () => {
    // TODO: Implement note saving via API
    console.log('Saving note for vehicle:', noteVehicle?.id, noteText)
    setNoteModalOpen(false)
    setNoteVehicle(null)
    setNoteText('')
  }

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      try {
        const token = 'demo_token_permanent_access_2026'
        const headers = { Authorization: `Bearer ${token}` }

        const [vehiclesRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/trpc/vehicles.listWithLocation?input=${encodeURIComponent(JSON.stringify({
            json: { limit: 300, activeOnly: false }
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

  // Filter vehicles by HQ status and detect anomalies
  const { anomalyVehicles, filteredVehicles, totalAnomalies } = useMemo(() => {
    const anomalies: Vehicle[] = []
    const normal: Vehicle[] = []

    for (const v of vehicles) {
      // Check if vehicle has an anomaly
      const isAnomaly = hasAnomaly(v)
      if (isAnomaly) {
        anomalies.push(v)
      }

      // If showing anomalies only, skip non-anomaly vehicles
      if (showAnomaliesOnly && !isAnomaly) continue

      // HQ Status filters
      if (!showAvailable && v.hqStatus === 'available') continue
      if (!showRented && v.hqStatus === 'rental') continue
      if (!showMaintenance && (v.hqStatus === 'maintenance' || v.hqStatus === 'out_of_service')) continue

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const searchFields = [
          v.name,
          v.vin,
          v.licensePlate,
          v.make,
          v.model,
          v.unitNumber,
          v.color,
          v.vehicleClass,
          v.location?.address,
        ].filter(Boolean).map(s => s!.toLowerCase())

        if (!searchFields.some(field => field.includes(query))) {
          continue
        }
      }

      // Add to normal list (anomalies will be shown separately at top)
      if (!isAnomaly) {
        normal.push(v)
      }
    }

    return {
      anomalyVehicles: anomalies,
      filteredVehicles: normal,
      totalAnomalies: anomalies.length,
    }
  }, [vehicles, searchQuery, showAvailable, showRented, showMaintenance, showAnomaliesOnly])

  return (
    <AppLayout user={user}>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Vehicles</h1>
            <p className="mt-1 text-muted-foreground">
              Fleet vehicles with GPS tracking
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Fleet</span>
                  <Car className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-1 text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Available</span>
                  <Car className="h-4 w-4 text-green-600" />
                </div>
                <div className="mt-1 text-2xl font-bold text-green-600">{stats.available}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Rented</span>
                  <Car className="h-4 w-4 text-blue-600" />
                </div>
                <div className="mt-1 text-2xl font-bold text-blue-600">{stats.rented}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Maintenance</span>
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                </div>
                <div className="mt-1 text-2xl font-bold text-orange-600">{stats.maintenance + (stats.outOfService || 0)}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, VIN, plate, make/model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            {totalAnomalies > 0 && (
              <Button
                variant={showAnomaliesOnly ? 'default' : 'outline'}
                onClick={() => setShowAnomaliesOnly(!showAnomaliesOnly)}
                className={showAnomaliesOnly ? 'bg-orange-600 hover:bg-orange-700' : 'border-orange-400 text-orange-600 hover:bg-orange-50'}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                {totalAnomalies} Issues
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuCheckboxItem
                  checked={showAvailable}
                  onCheckedChange={setShowAvailable}
                >
                  Available
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={showRented}
                  onCheckedChange={setShowRented}
                >
                  Rented
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={showMaintenance}
                  onCheckedChange={setShowMaintenance}
                >
                  Maintenance / Out of Service
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Anomaly Section - Show at top when there are issues */}
        {!isLoading && anomalyVehicles.length > 0 && !showAnomaliesOnly && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <h2 className="text-lg font-semibold text-orange-800 dark:text-orange-200">
                {anomalyVehicles.length} vehicle{anomalyVehicles.length !== 1 ? 's' : ''} need attention
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
              {anomalyVehicles.map((vehicle) => (
                <AnomalyCard key={vehicle.id} vehicle={vehicle} onAddNote={handleAddNote} />
              ))}
            </div>
          </div>
        )}

        {/* Show anomalies in grid when filter is active */}
        {!isLoading && showAnomaliesOnly && anomalyVehicles.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <h2 className="text-lg font-semibold">
                Showing {anomalyVehicles.length} vehicle{anomalyVehicles.length !== 1 ? 's' : ''} with issues
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
              {anomalyVehicles.map((vehicle) => (
                <AnomalyCard key={vehicle.id} vehicle={vehicle} onAddNote={handleAddNote} />
              ))}
            </div>
          </div>
        )}

        {/* Results count */}
        {!isLoading && !showAnomaliesOnly && (
          <div className="text-sm text-muted-foreground mb-4">
            Showing {filteredVehicles.length + anomalyVehicles.length} of {vehicles.length} vehicles
          </div>
        )}

        {/* Vehicle Grid - Normal vehicles */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <VehicleCardSkeleton key={i} />
            ))}
          </div>
        ) : showAnomaliesOnly ? (
          anomalyVehicles.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Car className="h-12 w-12 mx-auto text-green-600 mb-4" />
                <h3 className="text-lg font-medium mb-2">No issues found</h3>
                <p className="text-muted-foreground">
                  All vehicles are accounted for
                </p>
              </CardContent>
            </Card>
          )
        ) : filteredVehicles.length === 0 && anomalyVehicles.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No vehicles found</h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? 'Try adjusting your search or filters'
                  : 'No vehicles match the current filters'}
              </p>
            </CardContent>
          </Card>
        ) : filteredVehicles.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredVehicles.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        )}

        {/* Note Modal */}
        <Dialog open={noteModalOpen} onOpenChange={setNoteModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Note for {noteVehicle?.unitNumber || noteVehicle?.name}</DialogTitle>
              <DialogDescription>
                Add information about why this vehicle is away from the shop while marked as available.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <textarea
                className="w-full min-h-[120px] p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., Customer returning tomorrow, Vehicle at mechanic for quick service..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNoteModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveNote} disabled={!noteText.trim()}>
                Save Note
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
