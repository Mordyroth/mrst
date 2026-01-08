/**
 * Timeline Component
 * Main container for the timeline event list
 */

import { cn } from '../primitives/index'
import { TimelineEvent } from './TimelineEvent'
import { TimelineFilters } from './TimelineFilters'
import type { TimelineEventData, TimelineFiltersState, TimelineSource } from './types'

export interface TimelineProps {
  events: TimelineEventData[]
  filters: TimelineFiltersState
  onFiltersChange: (filters: TimelineFiltersState) => void
  availableSources?: TimelineSource[]
  isLoading?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  onEventClick?: (event: TimelineEventData) => void
  onExpandClick?: (event: TimelineEventData) => void
  showFilters?: boolean
  emptyMessage?: string
  className?: string
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

export function Timeline({
  events,
  filters,
  onFiltersChange,
  availableSources,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  onEventClick,
  onExpandClick,
  showFilters = true,
  emptyMessage = 'No events found',
  className,
  collapsed = false,
  onCollapsedChange,
}: TimelineProps) {
  return (
    <div className={cn('flex flex-col lg:flex-row gap-6', className)}>
      {/* Filters sidebar */}
      {showFilters && (
        <aside className="lg:w-64 shrink-0">
          <div className="sticky top-4 rounded-lg border bg-card p-4">
            <h3 className="font-semibold mb-4">Filters</h3>
            <TimelineFilters
              filters={filters}
              onFiltersChange={onFiltersChange}
              availableSources={availableSources}
            />

            {/* Collapse toggle */}
            {onCollapsedChange && (
              <div className="mt-4 pt-4 border-t">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={collapsed}
                    onChange={(e) => onCollapsedChange(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span>Group similar events</span>
                </label>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Timeline content */}
      <div className="flex-1 min-w-0">
        {/* Events list */}
        {events.length === 0 && !isLoading ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-0">
            {events.map((event, index) => (
              <TimelineEvent
                key={event.id}
                event={event}
                isFirst={index === 0}
                isLast={index === events.length - 1 && !hasMore}
                onEventClick={onEventClick}
                onExpandClick={onExpandClick}
              />
            ))}
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {/* Load more button */}
        {hasMore && !isLoading && onLoadMore && (
          <div className="flex justify-center pt-4">
            <button
              onClick={onLoadMore}
              className="px-4 py-2 rounded-lg border bg-card text-sm font-medium hover:bg-accent transition-colors"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Compact timeline for embedding in other views
 */
export interface TimelineCompactProps {
  events: TimelineEventData[]
  maxEvents?: number
  onEventClick?: (event: TimelineEventData) => void
  onViewAll?: () => void
  className?: string
}

export function TimelineCompact({
  events,
  maxEvents = 5,
  onEventClick,
  onViewAll,
  className,
}: TimelineCompactProps) {
  const displayEvents = events.slice(0, maxEvents)

  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Recent Activity</h3>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm text-primary hover:underline"
          >
            View all
          </button>
        )}
      </div>

      <div className="p-4">
        {displayEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent activity
          </p>
        ) : (
          <div className="space-y-0">
            {displayEvents.map((event, index) => (
              <TimelineEvent
                key={event.id}
                event={event}
                isFirst={index === 0}
                isLast={index === displayEvents.length - 1}
                onEventClick={onEventClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
