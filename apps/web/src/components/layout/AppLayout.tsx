'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { cn } from '@/lib/utils'

interface AppLayoutProps {
  children: React.ReactNode
  user?: { email: string; name?: string }
}

export function AppLayout({ children, user }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Sync with sidebar collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored !== null) {
      setSidebarCollapsed(stored === 'true')
    }

    // Listen for storage changes (from other tabs or same window)
    const handleStorageChange = () => {
      const newValue = localStorage.getItem('sidebar-collapsed')
      setSidebarCollapsed(newValue === 'true')
    }

    // Custom event for same-window updates
    window.addEventListener('storage', handleStorageChange)

    // Poll for changes (fallback for same-window)
    const interval = setInterval(() => {
      const newValue = localStorage.getItem('sidebar-collapsed')
      setSidebarCollapsed(newValue === 'true')
    }, 100)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Sidebar user={user} />

      {/* Main content area */}
      <main className={cn(
        "transition-all duration-200",
        sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
      )}>
        {/* Add top padding on mobile for the header, bottom padding for nav + safe area */}
        <div
          className="pt-14 lg:pt-0 lg:pb-0 min-h-screen"
          style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="lg:hidden" style={{ paddingBottom: 0 }} />
          {children}
        </div>
      </main>
    </div>
  )
}
