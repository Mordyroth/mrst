'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  User,
  Search,
  Filter,
  Mail,
  Phone,
  MapPin,
  Car,
  Calendar,
  AlertTriangle,
  Users,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

// Get API URL
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'
}
const API_URL = getApiUrl()

interface Customer {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  licenseNumber: string | null
  dateOfBirth: Date | null
  hqExternalId: string | null
  activeRentals: number
  totalEvents: number
  createdAt: Date
  updatedAt: Date
}

interface CustomerStats {
  total: number
  withActiveRentals: number
  recentCustomers: number
}

function CustomerCard({ customer }: { customer: Customer }) {
  return (
    <Link href={`/customers/${customer.id}`}>
      <Card className="hover:border-primary transition-colors cursor-pointer h-full">
        <CardContent className="p-4">
          {/* Header with name and rental status */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-lg truncate">
                {customer.fullName}
              </div>
              {customer.licenseNumber && (
                <div className="text-xs text-muted-foreground font-mono">
                  License: {customer.licenseNumber}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 ml-2">
              {customer.activeRentals > 0 && (
                <Badge variant="default" className="bg-blue-600 hover:bg-blue-600">
                  <Car className="h-3 w-3 mr-1" />
                  {customer.activeRentals} Active
                </Badge>
              )}
            </div>
          </div>

          {/* Contact details */}
          <div className="space-y-1.5 text-sm">
            {customer.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{customer.email}</span>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>{customer.phone}</span>
              </div>
            )}
            {(customer.city || customer.state) && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {[customer.city, customer.state].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
          </div>

          {/* Stats footer */}
          {customer.totalEvents > 0 && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{customer.totalEvents} events</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

function CustomerCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <Skeleton className="h-6 w-32 mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [stats, setStats] = useState<CustomerStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showActiveRentalsOnly, setShowActiveRentalsOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'recent' | 'rentals'>('name')

  const user = { email: 'admin@travelautorental.com', name: 'Admin' }

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      try {
        const token = 'demo_token_permanent_access_2026'
        const headers = { Authorization: `Bearer ${token}` }

        const [customersRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/trpc/customers.list?input=${encodeURIComponent(JSON.stringify({
            json: { limit: 500, sortBy }
          }))}`, { headers }),
          fetch(`${API_URL}/trpc/customers.stats`, { headers }),
        ])

        if (customersRes.ok) {
          const data = await customersRes.json()
          setCustomers(data.result?.data?.json?.customers || [])
        }

        if (statsRes.ok) {
          const data = await statsRes.json()
          setStats(data.result?.data?.json || null)
        }
      } catch (err) {
        console.error('Failed to fetch customers:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [sortBy])

  // Filter customers
  const filteredCustomers = useMemo(() => {
    let filtered = customers

    // Filter by active rentals
    if (showActiveRentalsOnly) {
      filtered = filtered.filter(c => c.activeRentals > 0)
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(c => {
        const searchFields = [
          c.fullName,
          c.email,
          c.phone,
          c.licenseNumber,
          c.city,
          c.state,
        ].filter(Boolean).map(s => s!.toLowerCase())

        return searchFields.some(field => field.includes(query))
      })
    }

    return filtered
  }, [customers, searchQuery, showActiveRentalsOnly])

  return (
    <AppLayout user={user}>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Customers</h1>
            <p className="mt-1 text-muted-foreground">
              Customer database with rental history
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Customers</span>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-1 text-2xl font-bold">{stats.total.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Active Rentals</span>
                  <Car className="h-4 w-4 text-blue-600" />
                </div>
                <div className="mt-1 text-2xl font-bold text-blue-600">{stats.withActiveRentals}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">New (30 days)</span>
                  <Calendar className="h-4 w-4 text-green-600" />
                </div>
                <div className="mt-1 text-2xl font-bold text-green-600">{stats.recentCustomers}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, phone, license..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            {stats && stats.withActiveRentals > 0 && (
              <Button
                variant={showActiveRentalsOnly ? 'default' : 'outline'}
                onClick={() => setShowActiveRentalsOnly(!showActiveRentalsOnly)}
              >
                <Car className="h-4 w-4 mr-2" />
                Active Rentals ({stats.withActiveRentals})
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                  <DropdownMenuRadioItem value="name">Name (A-Z)</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="recent">Recently Updated</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="rentals">Most Rentals</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Results count */}
        {!isLoading && (
          <div className="text-sm text-muted-foreground mb-4">
            Showing {filteredCustomers.length} of {customers.length} customers
          </div>
        )}

        {/* Customer Grid */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(12)].map((_, i) => (
              <CustomerCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No customers found</h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? 'Try adjusting your search or filters'
                  : 'No customers match the current filters'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredCustomers.map((customer) => (
              <CustomerCard key={customer.id} customer={customer} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
