'use client'

import { useState, useEffect } from 'react'
import { SuggestionsWidget } from '@/components/ai/Suggestions'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Car, Users, Calendar, Zap, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, AreaChart, Area } from 'recharts'

// Get API URL - use same origin in browser, env var for SSR
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'
}
const API_URL = getApiUrl()

interface DashboardStats {
  fleetVehicles: number
  activeVehicles: number
  totalSpieonDevices: number
  activeRentals: number
  openReservations: number
  completedReservations: number
  totalReservations: number
  totalCustomers: number
  integrations: {
    monday: { itemCount: number; lastSync: string | null }
    hq: { reservationCount: number; customerCount: number; lastSync: string | null }
    gmail: { messageCount: number; lastSync: string | null }
    spireon: { deviceCount: number; lastSync: string | null }
  }
  totalTimelineEvents: number
  recentEventsBySource: Record<string, number>
}

interface VehicleStats {
  total: number
  available: number
  rented: number
  maintenance: number
  outOfService: number
  withGps: number
}

// Vehicle status pie chart colors (matching spec)
const VEHICLE_STATUS_COLORS = {
  available: '#22c55e',    // green-500
  rented: '#3b82f6',       // blue-500
  maintenance: '#f97316',  // orange-500
  outOfService: '#ef4444', // red-500
}

// Sparkline component for stats cards
function Sparkline({ data, color = '#22c55e', height = 32 }: {
  data: number[];
  color?: string;
  height?: number;
}) {
  const chartData = data.map((value, index) => ({ value, index }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#gradient-${color.replace('#', '')})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// Generate sample trend data (in real app, this would come from API)
function generateTrendData(currentValue: number, trend: 'up' | 'down' | 'stable' = 'stable'): number[] {
  const data: number[] = []
  let base = currentValue * 0.9

  for (let i = 0; i < 7; i++) {
    const variance = Math.random() * (currentValue * 0.1)
    if (trend === 'up') {
      base = base + (currentValue * 0.02)
    } else if (trend === 'down') {
      base = base - (currentValue * 0.02)
    }
    data.push(Math.round(base + variance))
  }

  // Ensure last value is close to current
  data[6] = currentValue
  return data
}

function VehicleStatusPieChart({ stats }: { stats: VehicleStats }) {
  const data = [
    { name: 'Available', value: stats.available, color: VEHICLE_STATUS_COLORS.available },
    { name: 'Rented', value: stats.rented, color: VEHICLE_STATUS_COLORS.rented },
    { name: 'Maintenance', value: stats.maintenance, color: VEHICLE_STATUS_COLORS.maintenance },
    { name: 'Out of Service', value: stats.outOfService, color: VEHICLE_STATUS_COLORS.outOfService },
  ].filter(d => d.value > 0) // Only show non-zero slices

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        No vehicle data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
          label={({ name, value }) => `${name}: ${value}`}
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string) => [`${value} vehicles`, name]}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => <span className="text-sm">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

interface AIStats {
  totalEmbeddings: number
  byPriority: { high: number; medium: number; low: number }
  byStatus: { pending: number; completed: number }
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return num.toLocaleString()
  }
  return num.toString()
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default function DashboardPage() {
  const user = { name: 'Admin', email: 'admin@travelautorental.com' }
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [aiStats, setAiStats] = useState<AIStats | null>(null)
  const [vehicleStats, setVehicleStats] = useState<VehicleStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      setIsLoading(true)
      try {
        const token = 'demo_token_permanent_access_2026'
        const headers = { Authorization: `Bearer ${token}` }

        const [dashboardRes, aiRes, vehicleRes] = await Promise.all([
          fetch(`${API_URL}/trpc/dashboard.stats`, { headers }),
          fetch(`${API_URL}/trpc/ai.getStats`, { headers }),
          fetch(`${API_URL}/trpc/vehicles.stats`, { headers }),
        ])

        if (dashboardRes.ok) {
          const data = await dashboardRes.json()
          setStats(data.result?.data?.json || null)
        }

        if (aiRes.ok) {
          const data = await aiRes.json()
          setAiStats(data.result?.data?.json || null)
        }

        if (vehicleRes.ok) {
          const data = await vehicleRes.json()
          setVehicleStats(data.result?.data?.json || null)
        }
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

  return (
    <AppLayout user={user}>
      <div className="p-4 sm:p-6 lg:p-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Welcome back, {user?.name}. Here&apos;s your business overview.
        </p>

        {isLoading ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {/* Stats cards with sparklines */}
              <Link href="/mrst/vehicles">
                <Card className="hover:border-primary transition-colors cursor-pointer overflow-hidden">
                  <CardContent className="p-6 pb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Fleet Vehicles</span>
                      <Car className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="mt-2 text-3xl font-bold">{stats?.fleetVehicles || 0}</div>
                    <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {stats?.activeVehicles || 0} online with GPS
                    </div>
                  </CardContent>
                  <div className="h-10 -mx-1">
                    <Sparkline
                      data={generateTrendData(stats?.fleetVehicles || 86, 'stable')}
                      color="#22c55e"
                    />
                  </div>
                </Card>
              </Link>
              <Card className="overflow-hidden">
                <CardContent className="p-6 pb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Active Rentals</span>
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="mt-2 text-3xl font-bold text-blue-600">{stats?.activeRentals || 0}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {stats?.openReservations || 0} upcoming reservations
                  </div>
                </CardContent>
                <div className="h-10 -mx-1">
                  <Sparkline
                    data={generateTrendData(stats?.activeRentals || 70, 'up')}
                    color="#3b82f6"
                  />
                </div>
              </Card>
              <Link href="/mrst/customers">
                <Card className="hover:border-primary transition-colors cursor-pointer overflow-hidden">
                  <CardContent className="p-6 pb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Customers</span>
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="mt-2 text-3xl font-bold">{formatNumber(stats?.totalCustomers || 0)}</div>
                    <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Growing
                    </div>
                  </CardContent>
                  <div className="h-10 -mx-1">
                    <Sparkline
                      data={generateTrendData(stats?.totalCustomers || 2383, 'up')}
                      color="#8b5cf6"
                    />
                  </div>
                </Card>
              </Link>
              <Link href="/mrst/suggestions">
                <Card className="hover:border-primary transition-colors cursor-pointer overflow-hidden">
                  <CardContent className="p-6 pb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">AI Tasks</span>
                      <Zap className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="mt-2 text-3xl font-bold text-primary">
                      {(aiStats?.byPriority?.high || 0) + (aiStats?.byPriority?.medium || 0) + (aiStats?.byPriority?.low || 0)}
                    </div>
                    <div className="mt-1 text-xs text-red-600">
                      {aiStats?.byPriority?.high || 0} high priority
                    </div>
                  </CardContent>
                  <div className="h-10 -mx-1">
                    <Sparkline
                      data={generateTrendData((aiStats?.byPriority?.high || 0) + (aiStats?.byPriority?.medium || 0), 'down')}
                      color="#f97316"
                    />
                  </div>
                </Card>
              </Link>
            </div>

            {/* AI Suggestions - Full width */}
            <div className="mt-8">
              <SuggestionsWidget />
            </div>

            {/* Vehicle Status Chart + Quick Stats */}
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {/* Vehicle Status Pie Chart */}
              <div className="rounded-lg border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Vehicle Status</h2>
                  <Link href="/mrst/vehicles" className="text-sm text-primary hover:underline">
                    View all
                  </Link>
                </div>
                {vehicleStats ? (
                  <VehicleStatusPieChart stats={vehicleStats} />
                ) : (
                  <div className="flex items-center justify-center h-[200px]">
                    <Skeleton className="h-[160px] w-[160px] rounded-full" />
                  </div>
                )}
              </div>

              {/* Vehicle Quick Stats */}
              <div className="rounded-lg border bg-card p-6">
                <h2 className="text-lg font-semibold mb-4">Fleet Summary</h2>
                {vehicleStats ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30">
                      <div className="text-2xl font-bold text-green-600">{vehicleStats.available}</div>
                      <div className="text-sm text-muted-foreground">Available</div>
                    </div>
                    <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                      <div className="text-2xl font-bold text-blue-600">{vehicleStats.rented}</div>
                      <div className="text-sm text-muted-foreground">Rented</div>
                    </div>
                    <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950/30">
                      <div className="text-2xl font-bold text-orange-600">{vehicleStats.maintenance}</div>
                      <div className="text-sm text-muted-foreground">Maintenance</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold">{vehicleStats.withGps}</div>
                      <div className="text-sm text-muted-foreground">With GPS</div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-[76px] rounded-lg" />
                    ))}
                  </div>
                )}
                {vehicleStats && vehicleStats.outOfService > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {vehicleStats.outOfService} vehicle{vehicleStats.outOfService !== 1 ? 's' : ''} out of service
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {/* Integration status */}
              <div className="rounded-lg border bg-card p-6">
                <h2 className="text-lg font-semibold">Integration Status</h2>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span>Monday.com</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({formatNumber(stats?.integrations?.monday?.itemCount || 0)} items)
                      </span>
                    </div>
                    <span className="text-sm text-green-600">
                      {formatRelativeTime(stats?.integrations?.monday?.lastSync || null)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span>HQ Rental</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({formatNumber(stats?.integrations?.hq?.reservationCount || 0)} reservations)
                      </span>
                    </div>
                    <span className="text-sm text-green-600">
                      {formatRelativeTime(stats?.integrations?.hq?.lastSync || null)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span>Gmail</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({formatNumber(stats?.integrations?.gmail?.messageCount || 0)} messages)
                      </span>
                    </div>
                    <span className="text-sm text-green-600">
                      {formatRelativeTime(stats?.integrations?.gmail?.lastSync || null)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span>Spireon GPS</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({stats?.integrations?.spireon?.deviceCount || 0} devices)
                      </span>
                    </div>
                    <span className="text-sm text-green-600">
                      {formatRelativeTime(stats?.integrations?.spireon?.lastSync || null)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span>WhatsApp</span>
                    </div>
                    <span className="text-sm text-muted-foreground">Not configured</span>
                  </div>
                </div>
              </div>

              {/* Recent activity - link to timeline */}
              <div className="rounded-lg border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Recent Activity</h2>
                  <a href="/mrst/timeline" className="text-sm text-primary hover:underline">
                    View all
                  </a>
                </div>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {formatNumber(stats?.totalTimelineEvents || 0)} events from all integrations. Visit the{' '}
                    <a href="/mrst/timeline" className="text-primary hover:underline">
                      Timeline
                    </a>{' '}
                    to view all activity.
                  </p>
                  <div className="pt-2 border-t">
                    <div className="text-sm font-medium mb-2">Last 7 days</div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {stats?.recentEventsBySource && Object.entries(stats.recentEventsBySource)
                        .sort((a, b) => b[1] - a[1])
                        .map(([source, count]) => (
                          <div key={source} className="flex justify-between">
                            <span className="capitalize">{source}</span>
                            <span>{formatNumber(count)} events</span>
                          </div>
                        ))
                      }
                      {(!stats?.recentEventsBySource || Object.keys(stats.recentEventsBySource).length === 0) && (
                        <div>No recent events</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Fleet Overview */}
            <div className="mt-8 rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Fleet Overview</h2>
                <a href="/mrst/map" className="text-sm text-primary hover:underline">
                  View map
                </a>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">{stats?.fleetVehicles || 0}</div>
                  <div className="text-xs text-muted-foreground">Fleet Vehicles</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold text-green-600">{stats?.activeVehicles || 0}</div>
                  <div className="text-xs text-muted-foreground">Online Now</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold text-blue-600">{stats?.activeRentals || 0}</div>
                  <div className="text-xs text-muted-foreground">On Rental</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">{stats?.totalSpieonDevices || 0}</div>
                  <div className="text-xs text-muted-foreground">Total GPS Devices</div>
                </div>
              </div>
            </div>

            {/* AI Stats */}
            {aiStats && (
              <div className="mt-8 rounded-lg border bg-card p-6">
                <h2 className="text-lg font-semibold mb-4">AI Intelligence Status</h2>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold">{formatNumber(aiStats.totalEmbeddings)}</div>
                    <div className="text-xs text-muted-foreground">Embeddings</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-red-600">{aiStats.byPriority?.high || 0}</div>
                    <div className="text-xs text-muted-foreground">High Priority</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-yellow-600">{aiStats.byPriority?.medium || 0}</div>
                    <div className="text-xs text-muted-foreground">Medium Priority</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-green-600">{aiStats.byStatus?.completed || 0}</div>
                    <div className="text-xs text-muted-foreground">Completed</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}
