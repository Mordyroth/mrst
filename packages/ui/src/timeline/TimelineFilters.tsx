/**
 * Timeline Filters Component
 * Controls for filtering timeline events
 */

import * as React from 'react'
import { cn } from '../primitives/index'
import {
  type TimelineSource,
  type TimelineFiltersState,
  SOURCE_LABELS,
  SOURCE_COLORS,
} from './types'

export interface TimelineFiltersProps {
  filters: TimelineFiltersState
  onFiltersChange: (filters: TimelineFiltersState) => void
  availableSources?: TimelineSource[]
}

const ALL_SOURCES: TimelineSource[] = ['monday', 'hq', 'gmail', 'spireon', 'whatsapp', 'system']

export function TimelineFilters({
  filters,
  onFiltersChange,
  availableSources = ALL_SOURCES,
}: TimelineFiltersProps) {
  const toggleSource = (source: TimelineSource) => {
    const newSources = filters.sources.includes(source)
      ? filters.sources.filter((s) => s !== source)
      : [...filters.sources, source]
    onFiltersChange({ ...filters, sources: newSources })
  }

  const clearFilters = () => {
    onFiltersChange({
      sources: [],
      eventTypes: [],
      searchQuery: '',
      dateFrom: null,
      dateTo: null,
    })
  }

  const hasActiveFilters =
    filters.sources.length > 0 ||
    filters.eventTypes.length > 0 ||
    filters.searchQuery !== '' ||
    filters.dateFrom !== null ||
    filters.dateTo !== null

  return (
    <div className="space-y-4">
      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search events..."
          value={filters.searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFiltersChange({ ...filters, searchQuery: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Source filters */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Sources</span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {availableSources.map((source) => {
            const isActive = filters.sources.length === 0 || filters.sources.includes(source)
            const isSelected = filters.sources.includes(source)
            return (
              <button
                key={source}
                onClick={() => toggleSource(source)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  isSelected
                    ? SOURCE_COLORS[source]
                    : isActive
                    ? 'bg-muted text-foreground border-border hover:bg-accent'
                    : 'bg-muted/50 text-muted-foreground border-border/50'
                )}
              >
                {SOURCE_LABELS[source]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">From</label>
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onFiltersChange({ ...filters, dateFrom: e.target.value || null })
            }
            className="w-full px-2 py-1.5 rounded border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">To</label>
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onFiltersChange({ ...filters, dateTo: e.target.value || null })
            }
            className="w-full px-2 py-1.5 rounded border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
    </div>
  )
}
