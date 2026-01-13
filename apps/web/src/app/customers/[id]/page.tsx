'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Car,
  DollarSign,
  FileText,
  ArrowLeft,
  ExternalLink,
  Briefcase,
  MessageSquare,
  CreditCard,
  Clock,
  Inbox,
  Paperclip,
} from 'lucide-react'

// Get API URL
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'
}
const API_URL = getApiUrl()

interface CustomerDetails {
  customer: {
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
    createdAt: Date
    updatedAt: Date
  }
  stats: {
    lifetimeRentals: number
    totalRevenue: number
    emailCount: number
    mondayItemCount: number
    totalEvents: number
  }
  activeRentals: Array<{
    id: string
    externalId: string
    vehicleId: string | null
    startDate: Date | null
    endDate: Date | null
    status: string
    totalAmount: number | null
    raw: any
  }>
  upcomingReservations: Array<{
    id: string
    externalId: string
    vehicleId: string | null
    startDate: Date | null
    endDate: Date | null
    status: string
    totalAmount: number | null
    raw: any
  }>
  recentEmails: Array<{
    id: string
    subject: string | null
    snippet: string | null
    fromEmail: string | null
    fromName: string | null
    date: Date | null
    hasAttachments: boolean
  }>
  mondayItems: Array<{
    id: string
    externalId: string
    name: string
    boardId: string
    boardName: string
    updatedAt: Date | null
  }>
}

function formatCurrency(amount: number | null | undefined): string {
  if (!amount) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function CustomerDetailPage() {
  const params = useParams()
  const customerId = params.id as string
  const [data, setData] = useState<CustomerDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const user = { email: 'admin@travelautorental.com', name: 'Admin' }

  useEffect(() => {
    async function fetchCustomer() {
      setIsLoading(true)
      setError(null)
      try {
        const token = 'demo_token_permanent_access_2026'
        const headers = { Authorization: `Bearer ${token}` }

        const res = await fetch(
          `${API_URL}/trpc/customers.get?input=${encodeURIComponent(
            JSON.stringify({ json: { id: customerId } })
          )}`,
          { headers }
        )

        if (!res.ok) {
          throw new Error('Failed to fetch customer')
        }

        const result = await res.json()
        setData(result.result?.data?.json || null)
      } catch (err) {
        console.error('Failed to fetch customer:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    if (customerId) {
      fetchCustomer()
    }
  }, [customerId])

  if (isLoading) {
    return (
      <AppLayout user={user}>
        <div className="p-4 sm:p-6 lg:p-8">
          <Skeleton className="h-8 w-64 mb-6" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    )
  }

  if (error || !data) {
    return (
      <AppLayout user={user}>
        <div className="p-4 sm:p-6 lg:p-8">
          <Link href="/customers">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Customers
            </Button>
          </Link>
          <Card>
            <CardContent className="p-12 text-center">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Customer not found</h3>
              <p className="text-muted-foreground">{error || 'This customer does not exist.'}</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    )
  }

  const { customer, stats, activeRentals, upcomingReservations, recentEmails, mondayItems } = data

  return (
    <AppLayout user={user}>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/customers">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Customers
            </Button>
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">{customer.fullName}</h1>
              {customer.licenseNumber && (
                <p className="text-sm text-muted-foreground font-mono mt-1">
                  License: {customer.licenseNumber}
                </p>
              )}
            </div>
            {activeRentals.length > 0 && (
              <Badge variant="default" className="bg-blue-600 hover:bg-blue-600">
                <Car className="h-3 w-3 mr-1" />
                {activeRentals.length} Active Rental{activeRentals.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        {/* Contact Info Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {customer.email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-muted-foreground">Email</div>
                    <a href={`mailto:${customer.email}`} className="text-sm font-medium hover:underline truncate block">
                      {customer.email}
                    </a>
                  </div>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm text-muted-foreground">Phone</div>
                    <a href={`tel:${customer.phone}`} className="text-sm font-medium hover:underline">
                      {customer.phone}
                    </a>
                  </div>
                </div>
              )}
              {(customer.address || customer.city || customer.state) && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm text-muted-foreground">Address</div>
                    <div className="text-sm font-medium">
                      {customer.address && <div>{customer.address}</div>}
                      {(customer.city || customer.state || customer.zipCode) && (
                        <div>
                          {[customer.city, customer.state, customer.zipCode]
                            .filter(Boolean)
                            .join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {customer.dateOfBirth && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm text-muted-foreground">Date of Birth</div>
                    <div className="text-sm font-medium">{formatDate(customer.dateOfBirth)}</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Lifetime Rentals</span>
                <Car className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{stats.lifetimeRentals}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Total Revenue</span>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Emails</span>
                <Inbox className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{stats.emailCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Total Events</span>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{stats.totalEvents}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Content */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="rentals">
              Rentals
              {activeRentals.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {activeRentals.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="communications">
              Communications
              {stats.emailCount > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {stats.emailCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="monday">
              Monday.com
              {mondayItems.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {mondayItems.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Active Rentals */}
            {activeRentals.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Car className="h-5 w-5" />
                    Active Rentals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {activeRentals.map((rental) => {
                      const rawData = rental.raw as any || {}
                      return (
                        <div key={rental.id} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="font-semibold">
                                {rawData.vehicle_label || `Reservation #${rental.externalId}`}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {formatDate(rental.startDate)} - {formatDate(rental.endDate)}
                              </div>
                            </div>
                            <Badge variant="default" className="bg-blue-600">Active</Badge>
                          </div>
                          {rental.totalAmount && (
                            <div className="text-sm font-medium">{formatCurrency(rental.totalAmount)}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Upcoming Reservations */}
            {upcomingReservations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Upcoming Reservations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {upcomingReservations.map((reservation) => {
                      const rawData = reservation.raw as any || {}
                      return (
                        <div key={reservation.id} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="font-semibold">
                                {rawData.vehicle_label || `Reservation #${reservation.externalId}`}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}
                              </div>
                            </div>
                            <Badge variant="outline">Upcoming</Badge>
                          </div>
                          {reservation.totalAmount && (
                            <div className="text-sm font-medium">{formatCurrency(reservation.totalAmount)}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Emails */}
            {recentEmails.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Inbox className="h-5 w-5" />
                    Recent Emails
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentEmails.map((email) => (
                      <div key={email.id} className="p-3 border rounded-lg hover:bg-accent cursor-pointer">
                        <div className="flex items-start justify-between mb-1">
                          <div className="font-medium text-sm truncate flex-1">
                            {email.subject || '(No subject)'}
                          </div>
                          <div className="text-xs text-muted-foreground ml-2">
                            {formatDate(email.date)}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground mb-1">
                          From: {email.fromName || email.fromEmail}
                        </div>
                        {email.snippet && (
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {email.snippet}
                          </div>
                        )}
                        {email.hasAttachments && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                            <Paperclip className="h-3 w-3" />
                            Has attachments
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Rentals Tab */}
          <TabsContent value="rentals" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Rental History</CardTitle>
              </CardHeader>
              <CardContent>
                {activeRentals.length === 0 && upcomingReservations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Car className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No rental history available</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {[...activeRentals, ...upcomingReservations].map((rental) => {
                      const rawData = rental.raw as any || {}
                      return (
                        <div key={rental.id} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="font-semibold">
                                {rawData.vehicle_label || `Reservation #${rental.externalId}`}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {formatDate(rental.startDate)} - {formatDate(rental.endDate)}
                              </div>
                            </div>
                            <Badge variant={rental.status === 'active' ? 'default' : 'outline'}>
                              {rental.status}
                            </Badge>
                          </div>
                          {rental.totalAmount && (
                            <div className="text-sm font-medium">{formatCurrency(rental.totalAmount)}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Communications Tab */}
          <TabsContent value="communications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Email Communications</CardTitle>
              </CardHeader>
              <CardContent>
                {recentEmails.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Inbox className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No emails found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentEmails.map((email) => (
                      <div key={email.id} className="p-4 border rounded-lg hover:bg-accent cursor-pointer">
                        <div className="flex items-start justify-between mb-2">
                          <div className="font-medium truncate flex-1">
                            {email.subject || '(No subject)'}
                          </div>
                          <div className="text-sm text-muted-foreground ml-2">
                            {formatDateTime(email.date)}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">
                          From: {email.fromName || email.fromEmail}
                        </div>
                        {email.snippet && (
                          <div className="text-sm text-muted-foreground line-clamp-3">
                            {email.snippet}
                          </div>
                        )}
                        {email.hasAttachments && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                            <Paperclip className="h-4 w-4" />
                            Has attachments
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Monday.com Tab */}
          <TabsContent value="monday" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Monday.com Items</CardTitle>
              </CardHeader>
              <CardContent>
                {mondayItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Briefcase className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No Monday.com items linked to this customer</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mondayItems.map((item) => (
                      <div key={item.id} className="p-4 border rounded-lg hover:bg-accent cursor-pointer">
                        <div className="flex items-start justify-between mb-2">
                          <div className="font-medium flex-1">{item.name}</div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Board: {item.boardName}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Updated: {formatDate(item.updatedAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Timeline integration coming soon</p>
                  <p className="text-sm mt-1">Will show all {stats.totalEvents} events</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
