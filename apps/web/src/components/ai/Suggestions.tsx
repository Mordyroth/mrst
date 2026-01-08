'use client'

/**
 * AI Suggestions Component
 *
 * Displays AI-generated suggestions for "What should I do next?"
 * Shows priority-ordered tasks with actions to acknowledge, complete, or dismiss
 */

import { useState } from 'react'
import { trpc } from '@/lib/trpc'

type SuggestionStatus = 'pending' | 'acknowledged' | 'completed' | 'dismissed'
type TaskType = 'follow_up' | 'action_required' | 'anomaly' | 'opportunity'
type Priority = 'high' | 'medium' | 'low'

interface SuggestionCardProps {
  suggestion: {
    id: string
    taskType: string
    priority: string
    title: string
    description: string
    reasoning: string | null
    relatedCustomerId: string | null
    relatedVehicleId: string | null
    createdAt: Date
    status: string
  }
  onAcknowledge: (id: string) => void
  onComplete: (id: string) => void
  onDismiss: (id: string, reason?: string) => void
}

function SuggestionCard({ suggestion, onAcknowledge, onComplete, onDismiss }: SuggestionCardProps) {
  const [showDismissReason, setShowDismissReason] = useState(false)
  const [dismissReason, setDismissReason] = useState('')

  const priorityColors: Record<string, string> = {
    high: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-blue-100 text-blue-800 border-blue-200',
  }

  const typeIcons: Record<string, string> = {
    follow_up: 'Reply needed',
    action_required: 'Action needed',
    anomaly: 'Anomaly detected',
    opportunity: 'Opportunity',
  }

  const handleDismiss = () => {
    if (showDismissReason) {
      onDismiss(suggestion.id, dismissReason || undefined)
      setShowDismissReason(false)
      setDismissReason('')
    } else {
      setShowDismissReason(true)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Type and priority badges */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              {typeIcons[suggestion.taskType] || suggestion.taskType}
            </span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full border ${
                priorityColors[suggestion.priority] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {suggestion.priority}
            </span>
          </div>

          {/* Title */}
          <h3 className="font-medium text-foreground truncate">{suggestion.title}</h3>

          {/* Description */}
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {suggestion.description}
          </p>

          {/* Reasoning (AI explanation) */}
          {suggestion.reasoning && (
            <p className="mt-2 text-xs text-muted-foreground italic">
              AI: {suggestion.reasoning}
            </p>
          )}

          {/* Related entities */}
          <div className="mt-2 flex gap-2 text-xs">
            {suggestion.relatedCustomerId && (
              <a
                href={`/customers/${suggestion.relatedCustomerId}`}
                className="text-primary hover:underline"
              >
                View customer
              </a>
            )}
            {suggestion.relatedVehicleId && (
              <a
                href={`/vehicles/${suggestion.relatedVehicleId}`}
                className="text-primary hover:underline"
              >
                View vehicle
              </a>
            )}
          </div>

          {/* Timestamp */}
          <p className="mt-2 text-xs text-muted-foreground">
            {new Date(suggestion.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          {suggestion.status === 'pending' && (
            <>
              <button
                onClick={() => onAcknowledge(suggestion.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Acknowledge
              </button>
              <button
                onClick={() => onComplete(suggestion.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700"
              >
                Complete
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-muted"
              >
                Dismiss
              </button>
            </>
          )}
          {suggestion.status === 'acknowledged' && (
            <>
              <button
                onClick={() => onComplete(suggestion.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700"
              >
                Complete
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-muted"
              >
                Dismiss
              </button>
            </>
          )}
        </div>
      </div>

      {/* Dismiss reason input */}
      {showDismissReason && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={dismissReason}
            onChange={(e) => setDismissReason(e.target.value)}
            placeholder="Reason for dismissing (optional)"
            className="flex-1 px-3 py-1.5 text-sm rounded-md border bg-background"
          />
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700"
          >
            Confirm
          </button>
          <button
            onClick={() => setShowDismissReason(false)}
            className="px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

interface SuggestionsListProps {
  status?: SuggestionStatus
  limit?: number
  showHeader?: boolean
  compact?: boolean
}

export function SuggestionsList({
  status = 'pending',
  limit = 10,
  showHeader = true,
  compact = false,
}: SuggestionsListProps) {
  const [filter, setFilter] = useState<{
    status: SuggestionStatus
    taskType?: TaskType
    priority?: Priority
  }>({ status })

  const utils = trpc.useUtils()

  const { data, isLoading, error } = trpc.ai.getSuggestions.useQuery({
    status: filter.status,
    taskType: filter.taskType,
    priority: filter.priority,
    limit,
  })

  const acknowledgeMutation = trpc.ai.acknowledgeSuggestion.useMutation({
    onSuccess: () => utils.ai.getSuggestions.invalidate(),
  })

  const completeMutation = trpc.ai.completeSuggestion.useMutation({
    onSuccess: () => utils.ai.getSuggestions.invalidate(),
  })

  const dismissMutation = trpc.ai.dismissSuggestion.useMutation({
    onSuccess: () => utils.ai.getSuggestions.invalidate(),
  })

  const handleAcknowledge = (taskId: string) => {
    acknowledgeMutation.mutate({ taskId })
  }

  const handleComplete = (taskId: string) => {
    completeMutation.mutate({ taskId })
  }

  const handleDismiss = (taskId: string, reason?: string) => {
    dismissMutation.mutate({ taskId, reason })
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <p className="text-sm text-red-600">Error loading suggestions: {error.message}</p>
      </div>
    )
  }

  const suggestions = data?.suggestions || []
  const counts = data?.counts || {}

  return (
    <div className={compact ? '' : 'space-y-4'}>
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">What should I do next?</h2>
            <p className="text-sm text-muted-foreground">
              AI-powered suggestions based on your data
            </p>
          </div>

          {/* Status tabs */}
          <div className="flex gap-1 rounded-lg border bg-muted p-1">
            {(['pending', 'acknowledged', 'completed', 'dismissed'] as SuggestionStatus[]).map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setFilter({ ...filter, status: s })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    filter.status === s
                      ? 'bg-background shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                  {counts[s] ? ` (${counts[s]})` : ''}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      {showHeader && !compact && (
        <div className="flex gap-2">
          <select
            value={filter.priority || ''}
            onChange={(e) =>
              setFilter({
                ...filter,
                priority: e.target.value ? (e.target.value as Priority) : undefined,
              })
            }
            className="px-3 py-1.5 text-sm rounded-md border bg-background"
          >
            <option value="">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={filter.taskType || ''}
            onChange={(e) =>
              setFilter({
                ...filter,
                taskType: e.target.value ? (e.target.value as TaskType) : undefined,
              })
            }
            className="px-3 py-1.5 text-sm rounded-md border bg-background"
          >
            <option value="">All types</option>
            <option value="follow_up">Follow ups</option>
            <option value="action_required">Actions required</option>
            <option value="anomaly">Anomalies</option>
            <option value="opportunity">Opportunities</option>
          </select>
        </div>
      )}

      {/* Suggestions list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border bg-card p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/4 mb-2" />
              <div className="h-5 bg-muted rounded w-3/4 mb-2" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="text-muted-foreground">
            {filter.status === 'pending'
              ? 'No pending suggestions. You\'re all caught up!'
              : `No ${filter.status} suggestions.`}
          </p>
        </div>
      ) : (
        <div className={compact ? 'space-y-2' : 'space-y-4'}>
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onAcknowledge={handleAcknowledge}
              onComplete={handleComplete}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Compact widget for dashboard showing top priority suggestions
 */
export function SuggestionsWidget() {
  const { data, isLoading } = trpc.ai.getSuggestions.useQuery({
    status: 'pending',
    limit: 5,
  })

  const { data: stats } = trpc.ai.getStats.useQuery()

  const suggestions = data?.suggestions || []
  const counts = data?.counts || {}

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">AI Suggestions</h2>
        <a href="/suggestions" className="text-sm text-primary hover:underline">
          View all
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{stats?.byPriority?.high || 0}</div>
          <div className="text-xs text-muted-foreground">High Priority</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats?.byPriority?.medium || 0}</div>
          <div className="text-xs text-muted-foreground">Medium</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{stats?.byPriority?.low || 0}</div>
          <div className="text-xs text-muted-foreground">Low</div>
        </div>
      </div>

      {/* Top suggestions */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-muted rounded animate-pulse" />
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No pending suggestions. Great job!
        </p>
      ) : (
        <div className="space-y-2">
          {suggestions.slice(0, 5).map((suggestion) => (
            <a
              key={suggestion.id}
              href={`/suggestions?id=${suggestion.id}`}
              className="block p-2 rounded-md hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    suggestion.priority === 'high'
                      ? 'bg-red-500'
                      : suggestion.priority === 'medium'
                      ? 'bg-yellow-500'
                      : 'bg-blue-500'
                  }`}
                />
                <span className="text-sm font-medium truncate">{suggestion.title}</span>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Pending count */}
      {counts.pending ? (
        <p className="mt-4 text-xs text-muted-foreground text-center">
          {counts.pending} pending suggestion{counts.pending !== 1 ? 's' : ''}
        </p>
      ) : null}
    </div>
  )
}

export default SuggestionsList
