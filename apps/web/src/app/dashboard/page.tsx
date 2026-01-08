'use client'

import { useAuth, useRequireAuth } from '@/lib/auth'
import { SuggestionsWidget } from '@/components/ai/Suggestions'
import { trpc } from '@/lib/trpc'

export default function DashboardPage() {
  const { isLoading } = useRequireAuth()
  const { user, logout } = useAuth()

  // Fetch real stats from the API
  const { data: aiStats } = trpc.ai.getStats.useQuery(undefined, {
    enabled: !isLoading,
  })

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="flex items-center justify-center h-screen">
          <div className="text-lg text-muted-foreground">Loading...</div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <span className="text-lg font-bold">MRST</span>
              <nav className="flex gap-4">
                <a href="/dashboard" className="text-sm font-medium">
                  Dashboard
                </a>
                <a
                  href="/timeline"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Timeline
                </a>
                <a
                  href="/suggestions"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Suggestions
                </a>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{user?.email}</span>
              <button
                onClick={logout}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Welcome back, {user?.name}. Here&apos;s your business overview.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Stats cards */}
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground">Active Vehicles</div>
            <div className="mt-2 text-3xl font-bold">247</div>
            <div className="mt-1 text-xs text-green-600">Spireon GPS tracking</div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground">Active Rentals</div>
            <div className="mt-2 text-3xl font-bold">70</div>
            <div className="mt-1 text-xs text-muted-foreground">HQ Rental</div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground">Customers</div>
            <div className="mt-2 text-3xl font-bold">2,285</div>
            <div className="mt-1 text-xs text-muted-foreground">Synced from all sources</div>
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
              {[
                { name: 'Monday.com', status: 'Synced', synced: true, count: '6,690 items' },
                { name: 'HQ Rental', status: 'Synced', synced: true, count: '3,250 reservations' },
                { name: 'Gmail', status: 'Synced', synced: true, count: '14,893 messages' },
                { name: 'Spireon GPS', status: 'Synced', synced: true, count: '247 devices' },
                { name: 'WhatsApp', status: 'Not configured', synced: false, count: '' },
              ].map((integration) => (
                <div key={integration.name} className="flex items-center justify-between">
                  <div>
                    <span>{integration.name}</span>
                    {integration.count && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({integration.count})
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-sm ${
                      integration.synced ? 'text-green-600' : 'text-muted-foreground'
                    }`}
                  >
                    {integration.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent activity - link to timeline */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Activity</h2>
              <a
                href="/timeline"
                className="text-sm text-primary hover:underline"
              >
                View all
              </a>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                18,655 events from all integrations. Visit the{' '}
                <a href="/timeline" className="text-primary hover:underline">
                  Timeline
                </a>{' '}
                to view all activity.
              </p>
              <div className="pt-2 border-t">
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Gmail messages</span>
                    <span>14,893 events</span>
                  </div>
                  <div className="flex justify-between">
                    <span>HQ reservations</span>
                    <span>3,035 events</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Monday.com activity</span>
                    <span>727 events</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Stats */}
        {aiStats && (
          <div className="mt-8 rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">AI Intelligence Status</h2>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{aiStats.totalEmbeddings}</div>
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
      </div>
    </main>
  )
}
