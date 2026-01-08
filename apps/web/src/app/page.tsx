import { redirect } from 'next/navigation'

export default function HomePage() {
  // Auto-redirect to dashboard - no login required
  redirect('/mrst/dashboard')
}
