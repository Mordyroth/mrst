'use client'

import { SuggestionsWidget } from '@/components/ai/Suggestions'

export default function DashboardPage() {
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
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Welcome to MRST. Your integrations and data will appear here.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Stats cards */}
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground">Active Vehicles</div>
            <div className="mt-2 text-3xl font-bold">242</div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground">Active Rentals</div>
            <div className="mt-2 text-3xl font-bold">70</div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground">Customers</div>
            <div className="mt-2 text-3xl font-bold">2,285</div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground">Timeline Events</div>
            <div className="mt-2 text-3xl font-bold">3,762</div>
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
                { name: 'Monday.com', status: 'Synced', synced: true },
                { name: 'HQ Rental', status: 'Synced', synced: true },
                { name: 'Gmail', status: 'Synced', synced: true },
                { name: 'Spireon GPS', status: 'Synced', synced: true },
                { name: 'WhatsApp', status: 'Not configured', synced: false },
              ].map((integration) => (
                <div key={integration.name} className="flex items-center justify-between">
                  <span>{integration.name}</span>
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
      </div>
    </main>
  )
}
