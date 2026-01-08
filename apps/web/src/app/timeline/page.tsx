'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Timeline,
  type TimelineEventData,
  type TimelineFiltersState,
  type TimelineSource,
} from '@mrst/ui'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface TimelineResponse {
  events: TimelineEventData[]
  nextCursor: string | null
  hasMore: boolean
}

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEventData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [filters, setFilters] = useState<TimelineFiltersState>({
    sources: [],
    eventTypes: [],
    searchQuery: '',
    dateFrom: null,
    dateTo: null,
  })

  // Available sources based on what's synced
  const availableSources: TimelineSource[] = ['monday', 'hq']

  const fetchEvents = useCallback(async (cursor?: string | null, append = false) => {
    setIsLoading(true)
    setError(null)

    try {
      // Build query params
      const params = new URLSearchParams()
      if (cursor) params.set('cursor', cursor)
      params.set('limit', '20')
      if (filters.sources.length > 0) {
        params.set('sources', filters.sources.join(','))
      }
      if (filters.searchQuery) {
        params.set('search', filters.searchQuery)
      }
      if (filters.dateFrom) {
        params.set('dateFrom', filters.dateFrom)
      }
      if (filters.dateTo) {
        params.set('dateTo', filters.dateTo)
      }

      // Get auth token from localStorage (set after login)
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null

      const response = await fetch(`${API_URL}/trpc/timeline.list?input=${encodeURIComponent(JSON.stringify({
        limit: 20,
        cursor: cursor || undefined,
        sources: filters.sources.length > 0 ? filters.sources : undefined,
        searchQuery: filters.searchQuery || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        collapsed,
      }))}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      const result = data.result?.data as TimelineResponse | undefined

      if (result) {
        setEvents(append ? [...events, ...result.events] : result.events)
        setNextCursor(result.nextCursor)
        setHasMore(result.hasMore)
      }
    } catch (err) {
      console.error('Failed to fetch timeline events:', err)
      setError(err instanceof Error ? err.message : 'Failed to load events')
    } finally {
      setIsLoading(false)
    }
  }, [filters, events, collapsed])

  // Initial load
  useEffect(() => {
    fetchEvents()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refetch when filters or collapsed change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEvents()
    }, 300) // Debounce
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, collapsed])

  const handleLoadMore = () => {
    if (nextCursor && !isLoading) {
      fetchEvents(nextCursor, true)
    }
  }

  const handleEventClick = (event: TimelineEventData) => {
    console.log('Event clicked:', event)
    // TODO: Open event detail modal or navigate to entity
  }

  const handleExpandClick = async (event: TimelineEventData) => {
    if (!event.collapseGroupKey) return

    // When expand is clicked, disable collapsed mode to show all events
    setCollapsed(false)
    // TODO: Could also fetch just this group and show in a modal
    console.log('Expand group:', event.collapseGroupKey)
  }

  const handleCollapsedChange = (newCollapsed: boolean) => {
    setCollapsed(newCollapsed)
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <a href="/mrst/dashboard" className="text-lg font-bold">
                MRST
              </a>
              <nav className="flex gap-4">
                <a
                  href="/mrst/dashboard"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Dashboard
                </a>
                <a href="/mrst/timeline" className="text-sm font-medium">
                  Timeline
                </a>
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Activity Timeline</h1>
          <p className="text-muted-foreground mt-1">
            View all activity across your integrations
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
            <p className="font-medium">Error loading timeline</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={() => fetchEvents()}
              className="mt-2 text-sm underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        <Timeline
          events={events}
          filters={filters}
          onFiltersChange={setFilters}
          availableSources={availableSources}
          isLoading={isLoading}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          onEventClick={handleEventClick}
          onExpandClick={handleExpandClick}
          collapsed={collapsed}
          onCollapsedChange={handleCollapsedChange}
          emptyMessage={
            filters.sources.length > 0 || filters.searchQuery
              ? 'No events match your filters'
              : 'No events yet. Sync your integrations to see activity here.'
          }
        />
      </div>
    </main>
  )
}
