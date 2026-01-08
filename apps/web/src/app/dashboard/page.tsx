'use client'

import { useState, useEffect } from 'react'
import { SuggestionsWidget } from '@/components/ai/Suggestions'

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
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      setIsLoading(true)
      try {
        const token = 'demo_token_permanent_access_2026'
        const headers = { Authorization: `Bearer ${token}` }

        const [dashboardRes, aiRes] = await Promise.all([
          fetch(`${API_URL}/trpc/dashboard.stats`, { headers }),
          fetch(`${API_URL}/trpc/ai.getStats`, { headers }),
        ])

        if (dashboardRes.ok) {
          const data = await dashboardRes.json()
          setStats(data.result?.data?.json || null)
        }

        if (aiRes.ok) {
          const data = await aiRes.json()
          setAiStats(data.result?.data?.json || null)
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
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <span className="text-lg font-bold">MRST</span>
              <nav className="flex gap-4">
                <a href="/mrst/dashboard" className="text-sm font-medium">
                  Dashboard
                </a>
                <a href="/mrst/timeline" className="text-sm text-muted-foreground hover:text-foreground">
                  Timeline
                </a>
                <a href="/mrst/map" className="text-sm text-muted-foreground hover:text-foreground">
                  Fleet Map
                </a>
                <a href="/mrst/suggestions" className="text-sm text-muted-foreground hover:text-foreground">
                  Suggestions
                </a>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{user?.email}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Welcome back, {user?.name}. Here&apos;s your business overview.
        </p>

        {isLoading ? (
          <div className="mt-8 flex items-center justify-center h-48">
            <div className="text-muted-foreground">Loading dashboard...</div>
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {/* Stats cards */}
              <a href="/mrst/map" className="rounded-lg border bg-card p-6 hover:border-primary transition-colors">
                <div className="text-sm text-muted-foreground">Fleet Vehicles</div>
                <div className="mt-2 text-3xl font-bold">{stats?.fleetVehicles || 0}</div>
                <div className="mt-1 text-xs text-green-600">
                  {stats?.activeVehicles || 0} online with GPS
                </div>
              </a>
              <div className="rounded-lg border bg-card p-6">
                <div className="text-sm text-muted-foreground">Active Rentals</div>
                <div className="mt-2 text-3xl font-bold text-blue-600">{stats?.activeRentals || 0}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {stats?.openReservations || 0} upcoming reservations
                </div>
              </div>
              <div className="rounded-lg border bg-card p-6">
                <div className="text-sm text-muted-foreground">Customers</div>
                <div className="mt-2 text-3xl font-bold">{formatNumber(stats?.totalCustomers || 0)}</div>
                <div className="mt-1 text-xs text-muted-foreground">From HQ Rental</div>
              </div>
              <div className="rounded-lg border bg-card p-6">
                <div className="text-sm text-muted-foreground">AI Tasks</div>
                <div className="mt-2 text-3xl font-bold text-primary">
                  {(aiStats?.byPriority?.high || 0) + (aiStats?.byPriority?.medium || 0) + (aiStats?.byPriority?.low || 0)}
                </div>
                <div className="mt-1 text-xs text-red-600">
                  {aiStats?.byPriority?.high || 0} high priority
                </div>
              </div>
            </div>

            {/* AI Suggestions - Full width */}
            <div className="mt-8">
              <SuggestionsWidget />
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
    </main>
  )
}
