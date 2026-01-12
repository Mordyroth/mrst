'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Car,
  Clock,
  Map,
  Lightbulb,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useState, useEffect } from 'react'

const navItems = [
  { href: '/mrst/dashboard', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/mrst/vehicles', path: '/vehicles', label: 'Vehicles', icon: Car },
  { href: '/mrst/timeline', path: '/timeline', label: 'Timeline', icon: Clock },
  { href: '/mrst/map', path: '/map', label: 'Fleet Map', icon: Map },
  { href: '/mrst/suggestions', path: '/suggestions', label: 'Suggestions', icon: Lightbulb },
  { href: '/mrst/customers', path: '/customers', label: 'Customers', icon: Users },
]

const bottomNavItems = [
  { href: '/mrst/dashboard', path: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/mrst/vehicles', path: '/vehicles', label: 'Vehicles', icon: Car },
  { href: '/mrst/timeline', path: '/timeline', label: 'Timeline', icon: Clock },
  { href: '/mrst/map', path: '/map', label: 'Map', icon: Map },
]

// Check if pathname matches a nav item (accounts for nginx stripping /mrst prefix)
function isActivePath(pathname: string, itemPath: string): boolean {
  // Direct match
  if (pathname === itemPath || pathname.startsWith(itemPath + '/')) return true
  // Match with /mrst prefix (when accessed directly without nginx proxy)
  const mrstPath = '/mrst' + itemPath
  if (pathname === mrstPath || pathname.startsWith(mrstPath + '/')) return true
  return false
}

interface SidebarProps {
  user?: { email: string; name?: string }
}

function NavLink({ href, label, icon: Icon, active, collapsed }: {
  href: string
  label: string
  icon: typeof LayoutDashboard
  active: boolean
  collapsed?: boolean
}) {
  const linkContent = (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
        collapsed && 'justify-center px-2'
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {linkContent}
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return linkContent
}

function SidebarContent({ user, pathname, collapsed = false, onToggle }: {
  user?: SidebarProps['user'];
  pathname: string;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className={cn("p-4 border-b", collapsed && "px-2")}>
          <Link href="/mrst/dashboard" className={cn("flex items-center gap-2", collapsed && "justify-center")}>
            <Car className="h-8 w-8 text-primary flex-shrink-0" />
            {!collapsed && <span className="text-xl font-bold">MRST</span>}
          </Link>
        </div>

        {/* Navigation */}
        <nav className={cn("flex-1 p-4 space-y-1 overflow-y-auto", collapsed && "px-2")}>
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isActivePath(pathname, item.path)}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Bottom section */}
        <div className={cn("p-4 border-t space-y-1", collapsed && "px-2")}>
          {/* Collapse toggle button */}
          {onToggle && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className={cn(
                "w-full mb-2",
                collapsed ? "justify-center px-2" : "justify-start gap-3"
              )}
            >
              {collapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <>
                  <ChevronLeft className="h-5 w-5" />
                  <span>Collapse</span>
                </>
              )}
            </Button>
          )}

          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href="/mrst/settings"
                  className={cn(
                    'flex items-center justify-center px-2 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActivePath(pathname, '/settings')
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <Settings className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                Settings
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/mrst/settings"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActivePath(pathname, '/settings')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Settings className="h-5 w-5" />
              <span>Settings</span>
            </Link>
          )}

          {user && !collapsed && (
            <div className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium">
                  {user.name?.[0] || user.email?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate text-foreground font-medium">
                  {user.name || 'User'}
                </div>
                <div className="truncate text-xs">{user.email}</div>
              </div>
            </div>
          )}

          {user && collapsed && (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center px-2 py-2">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-xs font-medium">
                      {user.name?.[0] || user.email?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                {user.name || user.email}
              </TooltipContent>
            </Tooltip>
          )}

          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    window.location.href = '/login'
                  }}
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                Log out
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
              onClick={() => {
                window.location.href = '/login'
              }}
            >
              <LogOut className="h-5 w-5" />
              <span>Log out</span>
            </Button>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored !== null) {
      setCollapsed(stored === 'true')
    }
  }, [])

  // Save collapsed state to localStorage
  const handleToggleCollapse = () => {
    const newState = !collapsed
    setCollapsed(newState)
    localStorage.setItem('sidebar-collapsed', String(newState))
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:border-r lg:bg-card transition-all duration-200",
        collapsed ? "lg:w-16" : "lg:w-64"
      )}>
        <SidebarContent
          user={user}
          pathname={pathname}
          collapsed={collapsed}
          onToggle={handleToggleCollapse}
        />
      </aside>

      {/* Mobile Header with Menu Button */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 border-b bg-card flex items-center px-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="mr-2">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <SidebarContent user={user} pathname={pathname} />
          </SheetContent>
        </Sheet>

        <Link href="/mrst/dashboard" className="flex items-center gap-2">
          <Car className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">MRST</span>
        </Link>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 h-16 border-t bg-card">
        <div className="grid grid-cols-5 h-full">
          {bottomNavItems.map((item) => {
            const active = isActivePath(pathname, item.path)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}

          {/* More menu */}
          <Sheet>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground">
                <Menu className="h-5 w-5" />
                <span>More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto">
              <div className="py-4 space-y-2">
                <Link
                  href="/mrst/suggestions"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted"
                >
                  <Lightbulb className="h-5 w-5" />
                  <span>Suggestions</span>
                </Link>
                <Link
                  href="/mrst/customers"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted"
                >
                  <Users className="h-5 w-5" />
                  <span>Customers</span>
                </Link>
                <Separator />
                <Link
                  href="/mrst/settings"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted"
                >
                  <Settings className="h-5 w-5" />
                  <span>Settings</span>
                </Link>
                <button
                  onClick={() => window.location.href = '/login'}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted w-full text-left text-destructive"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Log out</span>
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </>
  )
}
