'use client'

/**
 * AI Suggestions Page
 *
 * Full page view of AI suggestions with filtering and actions
 */

import { SuggestionsList } from '@/components/ai/Suggestions'

export default function SuggestionsPage() {
  // Mock user for demo - no login required
  const user = { name: 'Admin', email: 'admin@travelautorental.com' }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <span className="text-lg font-bold">MRST</span>
              <nav className="flex gap-4">
                <a
                  href="/mrst/dashboard"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Dashboard
                </a>
                <a
                  href="/mrst/timeline"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Timeline
                </a>
                <a href="/mrst/suggestions" className="text-sm font-medium">
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

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SuggestionsList limit={50} />
      </div>
    </main>
  )
}
