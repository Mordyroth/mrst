export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">MRST</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Vehicle Rental Management Platform
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <a
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Sign In
          </a>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Dashboard
          </a>
        </div>
      </div>

      <div className="mt-16 grid gap-4 md:grid-cols-3 max-w-4xl">
        <div className="rounded-lg border bg-card p-6 text-card-foreground">
          <h3 className="font-semibold">Real-time Sync</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Automatic synchronization with Monday.com, HQ Rental, Gmail, and more.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6 text-card-foreground">
          <h3 className="font-semibold">GPS Tracking</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Live vehicle tracking with Spireon integration and geofencing.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6 text-card-foreground">
          <h3 className="font-semibold">AI Intelligence</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Smart suggestions and natural language queries powered by AI.
          </p>
        </div>
      </div>
    </main>
  )
}
