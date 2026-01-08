/**
 * Timeline Event Component
 * Renders a single event in the timeline
 */

import { cn } from '../primitives/index'
import {
  type TimelineEventData,
  SOURCE_LABELS,
  SOURCE_COLORS,
  EVENT_TYPE_LABELS,
} from './types'

export interface TimelineEventProps {
  event: TimelineEventData
  isFirst?: boolean
  isLast?: boolean
  onEventClick?: (event: TimelineEventData) => void
  onExpandClick?: (event: TimelineEventData) => void
}

/**
 * Format a date for display
 */
function formatEventDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

/**
 * Format full date for tooltip
 */
function formatFullDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Get icon for event source
 */
function getSourceIcon(source: string): string {
  switch (source) {
    case 'monday':
      return 'M'
    case 'hq':
      return 'H'
    case 'gmail':
      return '@'
    case 'spireon':
      return 'G'
    case 'whatsapp':
      return 'W'
    case 'system':
      return 'S'
    default:
      return '?'
  }
}

export function TimelineEvent({ event, isFirst, isLast, onEventClick, onExpandClick }: TimelineEventProps) {
  const sourceColor = SOURCE_COLORS[event.source] || SOURCE_COLORS.system
  const sourceLabel = SOURCE_LABELS[event.source] || event.source
  const eventTypeLabel = EVENT_TYPE_LABELS[event.eventType] || event.eventType
  const isCollapsed = (event.collapsedCount ?? 1) > 1

  return (
    <div
      className={cn(
        'relative flex gap-4 pb-6',
        !isLast && 'border-l-2 border-border ml-4',
        isLast && 'ml-4'
      )}
      onClick={() => onEventClick?.(event)}
    >
      {/* Timeline dot and line */}
      <div className="absolute -left-[9px] flex flex-col items-center">
        <div
          className={cn(
            'w-4 h-4 rounded-full border-2 flex items-center justify-center text-[8px] font-bold',
            sourceColor,
            event.isPinned && 'ring-2 ring-yellow-400'
          )}
          title={sourceLabel}
        >
          {getSourceIcon(event.source)}
        </div>
      </div>

      {/* Event content */}
      <div
        className={cn(
          'flex-1 ml-4 rounded-lg border bg-card p-4 cursor-pointer transition-colors',
          'hover:bg-accent/50',
          event.isPinned && 'border-yellow-400'
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Source and type badges */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
                  sourceColor
                )}
              >
                {sourceLabel}
              </span>
              <span className="text-xs text-muted-foreground">{eventTypeLabel}</span>
              {event.isPinned && (
                <span className="text-xs text-yellow-600 font-medium">Pinned</span>
              )}
              {event.isInternal && (
                <span className="text-xs text-orange-600 font-medium">Internal</span>
              )}
            </div>

            {/* Title */}
            {event.title && (
              <h4 className="font-medium text-sm truncate">{event.title}</h4>
            )}
          </div>

          {/* Timestamp */}
          <time
            className="text-xs text-muted-foreground whitespace-nowrap"
            dateTime={event.occurredAt}
            title={formatFullDate(event.occurredAt)}
          >
            {formatEventDate(event.occurredAt)}
          </time>
        </div>

        {/* Summary */}
        {event.summary && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
            {event.summary}
          </p>
        )}

        {/* Actor */}
        {event.actorName && (
          <div className="mt-2 text-xs text-muted-foreground">
            by {event.actorName}
            {event.actorEmail && ` (${event.actorEmail})`}
          </div>
        )}

        {/* Links */}
        {event.links && event.links.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {event.links.map((link) => (
              <span
                key={link.id}
                className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-xs"
              >
                {link.entityType}
              </span>
            ))}
          </div>
        )}

        {/* Collapsed indicator */}
        {isCollapsed && (
          <div className="mt-2 pt-2 border-t">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onExpandClick?.(event)
              }}
              className="text-xs text-primary hover:underline"
            >
              +{event.collapsedCount! - 1} more similar events
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
