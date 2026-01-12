'use client'

/**
 * AI Suggestions Page
 *
 * Full page view of AI suggestions with filtering and actions
 */

import { SuggestionsList } from '@/components/ai/Suggestions'
import { AppLayout } from '@/components/layout/AppLayout'

export default function SuggestionsPage() {
  const user = { name: 'Admin', email: 'admin@travelautorental.com' }

  return (
    <AppLayout user={user}>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
        <SuggestionsList limit={50} />
      </div>
    </AppLayout>
  )
}
