export default function DashboardPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Welcome to MRST. Your integrations and data will appear here.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Stats cards */}
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground">Active Vehicles</div>
            <div className="mt-2 text-3xl font-bold">--</div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground">Active Rentals</div>
            <div className="mt-2 text-3xl font-bold">--</div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground">Customers</div>
            <div className="mt-2 text-3xl font-bold">--</div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground">Pending Tasks</div>
            <div className="mt-2 text-3xl font-bold">--</div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Integration status */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold">Integration Status</h2>
            <div className="mt-4 space-y-3">
              {[
                { name: 'Monday.com', status: 'Not configured' },
                { name: 'HQ Rental', status: 'Not configured' },
                { name: 'Gmail', status: 'Not configured' },
                { name: 'Spireon GPS', status: 'Not configured' },
                { name: 'WhatsApp', status: 'Not configured' },
              ].map((integration) => (
                <div key={integration.name} className="flex items-center justify-between">
                  <span>{integration.name}</span>
                  <span className="text-sm text-muted-foreground">{integration.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent activity */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">
                No activity yet. Configure your integrations to start syncing data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
