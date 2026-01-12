'use client'

import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Users,
  Search,
  Mail,
  Phone,
  Calendar,
  Building2,
} from 'lucide-react'

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
  externalId: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  company: string | null
  customerType: string | null
  status: string | null
  totalReservations: number | null
  notes: string | null
  createdAt: string | null
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function CustomerCard({ customer }: { customer: Customer }) {
  const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Unknown'

  return (
    <Card className="hover:border-primary transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-semibold text-lg">{fullName}</div>
            {customer.company && (
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {customer.company}
              </div>
            )}
          </div>
          {customer.customerType && (
            <Badge variant="outline">{customer.customerType}</Badge>
          )}
        </div>

        <div className="space-y-2 text-sm">
          {customer.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${customer.email}`} className="text-primary hover:underline truncate">
                {customer.email}
              </a>
            </div>
          )}
          {customer.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a href={`tel:${customer.phone}`} className="hover:underline">
                {customer.phone}
              </a>
            </div>
          )}
          {customer.totalReservations !== null && customer.totalReservations > 0 && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{customer.totalReservations} reservation{customer.totalReservations !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function CustomerCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <Skeleton className="h-6 w-32 mb-1" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [totalCount, setTotalCount] = useState(0)

  const user = { email: 'admin@travelautorental.com', name: 'Admin' }

  useEffect(() => {
    async function fetchCustomers() {
      setIsLoading(true)
      try {
        const token = 'demo_token_permanent_access_2026'
        // For now, we'll use direct SQL query through the API
        // TODO: Add proper tRPC endpoint for customers
        const res = await fetch(`${API_URL}/trpc/dashboard.stats`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.ok) {
          const data = await res.json()
          setTotalCount(data.result?.data?.json?.totalCustomers || 0)
        }

        // TODO: Fetch actual customer list from hq_customers table
        // For now, showing placeholder
        setCustomers([])
      } catch (err) {
        console.error('Failed to fetch customers:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCustomers()
  }, [])

  const filteredCustomers = customers.filter(c => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    const searchFields = [
      c.firstName,
      c.lastName,
      c.email,
      c.phone,
      c.company,
    ].filter(Boolean).map(s => s!.toLowerCase())
    return searchFields.some(field => field.includes(query))
  })

  return (
    <AppLayout user={user}>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Customers</h1>
            <p className="mt-1 text-muted-foreground">
              {totalCount.toLocaleString()} customers from HQ Rental
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Customer list */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <CustomerCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchQuery ? 'No customers found' : 'Customer listing coming soon'}
              </h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? 'Try adjusting your search'
                  : `${totalCount.toLocaleString()} customers synced from HQ. Full listing feature in development.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCustomers.map((customer) => (
              <CustomerCard key={customer.id} customer={customer} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
