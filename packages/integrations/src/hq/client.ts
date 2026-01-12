/**
 * HQ Rental Software REST Client
 * CAAG CRM API with Basic Authentication
 */

import { sleep, retry } from '@mrst/shared'
import type {
  HQApiConfig,
  HQApiResponse,
  HQPaginatedResponse,
  HQReservationListItem,
  HQReservationDetails,
  HQFleetVehicle,
} from './types'

export interface HQClientOptions {
  baseUrl?: string
  tenantToken: string
  userToken: string
  /** Request timeout in ms (default: 30000) */
  timeout?: number
  /** Delay between requests in ms (default: 100) */
  requestDelay?: number
}

/**
 * HQ Rental Software API Client
 */
export class HQClient {
  private baseUrl: string
  private authToken: string
  private timeout: number
  private requestDelay: number
  private lastRequestTime: number = 0

  constructor(options: HQClientOptions) {
    this.baseUrl = options.baseUrl || 'https://api-america-3.caagcrm.com/api-america-3'
    this.timeout = options.timeout || 30000
    this.requestDelay = options.requestDelay || 100

    // Generate Basic Auth token
    const credentials = `${options.tenantToken}:${options.userToken}`
    this.authToken = Buffer.from(credentials).toString('base64')
  }

  /**
   * Make an authenticated API request
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    options: {
      params?: Record<string, string | number>
      body?: unknown
    } = {}
  ): Promise<T> {
    // Rate limiting: ensure minimum delay between requests
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    if (timeSinceLastRequest < this.requestDelay) {
      await sleep(this.requestDelay - timeSinceLastRequest)
    }

    // Build URL with query params
    const url = new URL(`${this.baseUrl}${path}`)
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        url.searchParams.append(key, String(value))
      }
    }

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          'Authorization': `Basic ${this.authToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      })

      this.lastRequestTime = Date.now()

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HQ API error ${response.status}: ${errorText}`)
      }

      const data = await response.json() as HQApiResponse<T>

      if (!data.success) {
        throw new Error(`HQ API error: ${data.errors?.join(', ') || 'Unknown error'}`)
      }

      return data.data
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Make a request with retry logic
   */
  async requestWithRetry<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    options: {
      params?: Record<string, string | number>
      body?: unknown
    } = {}
  ): Promise<T> {
    return retry(
      () => this.request<T>(method, path, options),
      { maxAttempts: 3, initialDelayMs: 1000, maxDelayMs: 10000 }
    )
  }

  /**
   * Get paginated reservations list
   */
  async getReservations(options: {
    page?: number
    perPage?: number
    status?: string
    /** Filter by pickup date (YYYY-MM-DD) */
    pickUpDateFrom?: string
    pickUpDateTo?: string
    /** Filter by return date (YYYY-MM-DD) */
    returnDateFrom?: string
    returnDateTo?: string
    /** Updated after this date (ISO 8601) */
    updatedAfter?: string
  } = {}): Promise<{
    data: HQReservationListItem[]
    currentPage: number
    lastPage: number
    perPage: number
    total: number
  }> {
    const params: Record<string, string | number> = {}

    if (options.page) params.page = options.page
    if (options.perPage) params.per_page = options.perPage
    if (options.status) params.status = options.status
    if (options.pickUpDateFrom) params.pick_up_date_from = options.pickUpDateFrom
    if (options.pickUpDateTo) params.pick_up_date_to = options.pickUpDateTo
    if (options.returnDateFrom) params.return_date_from = options.returnDateFrom
    if (options.returnDateTo) params.return_date_to = options.returnDateTo
    if (options.updatedAfter) params.updated_after = options.updatedAfter

    // The raw response includes pagination metadata
    const url = new URL(`${this.baseUrl}/car-rental/reservations`)
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, String(value))
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${this.authToken}`,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      })

      this.lastRequestTime = Date.now()

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HQ API error ${response.status}: ${errorText}`)
      }

      const data = await response.json() as HQPaginatedResponse<HQReservationListItem>

      if (!data.success) {
        throw new Error(`HQ API error: ${data.errors?.join(', ') || 'Unknown error'}`)
      }

      return {
        data: data.data,
        currentPage: data.current_page,
        lastPage: data.last_page,
        perPage: data.per_page,
        total: data.total,
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Get full reservation details by ID
   */
  async getReservation(id: number | string): Promise<HQReservationDetails> {
    return this.requestWithRetry<HQReservationDetails>(
      'GET',
      `/car-rental/reservations/${id}`
    )
  }

  /**
   * Iterate through all reservations with pagination
   */
  async *iterateReservations(options: {
    perPage?: number
    status?: string
    pickUpDateFrom?: string
    pickUpDateTo?: string
    returnDateFrom?: string
    returnDateTo?: string
    updatedAfter?: string
  } = {}): AsyncGenerator<HQReservationListItem, void, unknown> {
    let page = 1
    let hasMore = true

    while (hasMore) {
      const result = await retry(
        () => this.getReservations({ ...options, page, perPage: options.perPage || 100 }),
        { maxAttempts: 3, initialDelayMs: 1000 }
      )

      for (const reservation of result.data) {
        yield reservation
      }

      page++
      hasMore = page <= result.lastPage

      // Small delay between pages
      if (hasMore) {
        await sleep(200)
      }
    }
  }

  /**
   * Get all reservation IDs (for incremental sync)
   */
  async getAllReservationIds(options: {
    status?: string
    updatedAfter?: string
  } = {}): Promise<number[]> {
    const ids: number[] = []

    for await (const reservation of this.iterateReservations(options)) {
      ids.push(reservation.id)
    }

    return ids
  }

  /**
   * Get all fleet vehicles from /fleets/vehicles endpoint
   * This is the source of truth for active fleet (typically ~88 vehicles)
   */
  async getFleetVehicles(options: {
    limit?: number
    page?: number
  } = {}): Promise<{
    data: HQFleetVehicle[]
    total: number
  }> {
    const { limit = 200, page = 1 } = options

    const url = new URL(`${this.baseUrl}/fleets/vehicles`)
    url.searchParams.append('limit', String(limit))
    url.searchParams.append('page', String(page))

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${this.authToken}`,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      })

      this.lastRequestTime = Date.now()

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HQ API error ${response.status}: ${errorText}`)
      }

      const data = await response.json() as HQApiResponse<HQFleetVehicle[]>

      if (!data.success) {
        throw new Error(`HQ API error: ${data.errors?.join(', ') || 'Unknown error'}`)
      }

      return {
        data: data.data,
        total: data.data.length,
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<{ success: boolean; total: number }> {
    try {
      const result = await this.getReservations({ perPage: 1 })
      return { success: true, total: result.total }
    } catch (error) {
      console.error('HQ API connection test failed:', error)
      return { success: false, total: 0 }
    }
  }

  // ============================================================
  // CONTACTS/CUSTOMERS ENDPOINTS
  // ============================================================

  /**
   * Get all contacts (customers)
   */
  async getContacts(options: { limit?: number; page?: number } = {}): Promise<{ data: any[]; total: number }> {
    const { limit = 200, page = 1 } = options
    return this.requestWithRetry<{ data: any[]; total: number }>('GET', '/contacts', {
      params: { limit, page }
    })
  }

  /**
   * Get single contact by ID
   */
  async getContact(id: number | string): Promise<any> {
    return this.requestWithRetry<any>('GET', `/contacts/${id}`)
  }

  // ============================================================
  // PAYMENTS ENDPOINTS
  // ============================================================

  /**
   * Get payments for a reservation
   */
  async getReservationPayments(reservationId: number | string): Promise<any[]> {
    return this.requestWithRetry<any[]>('GET', `/car-rental/reservations/${reservationId}/payments`)
  }

  /**
   * Get all payment transactions
   */
  async getPaymentTransactions(options: { limit?: number; page?: number } = {}): Promise<{ data: any[]; total: number }> {
    const { limit = 200, page = 1 } = options
    return this.requestWithRetry<{ data: any[]; total: number }>('GET', '/payment-transactions', {
      params: { limit, page }
    })
  }

  // ============================================================
  // REFUNDS ENDPOINTS
  // ============================================================

  /**
   * Get refunds for a reservation
   */
  async getReservationRefunds(reservationId: number | string): Promise<any[]> {
    return this.requestWithRetry<any[]>('GET', `/car-rental/reservations/${reservationId}/refunds`)
  }

  // ============================================================
  // DAMAGES ENDPOINTS
  // ============================================================

  /**
   * Get all vehicle damages
   */
  async getDamages(options: { limit?: number; page?: number } = {}): Promise<{ data: any[]; total: number }> {
    const { limit = 200, page = 1 } = options
    return this.requestWithRetry<{ data: any[]; total: number }>('GET', '/fleets/damages', {
      params: { limit, page }
    })
  }

  /**
   * Get single damage by ID
   */
  async getDamage(id: number | string): Promise<any> {
    return this.requestWithRetry<any>('GET', `/fleets/damages/${id}`)
  }

  // ============================================================
  // COMMENTS ENDPOINTS
  // ============================================================

  /**
   * Get comments for a reservation
   */
  async getReservationComments(reservationId: number | string): Promise<any[]> {
    return this.requestWithRetry<any[]>('GET', `/car-rental/reservations/${reservationId}/comments`)
  }

  /**
   * Get all comments
   */
  async getComments(options: { item_type?: string; item_id?: number; limit?: number; page?: number } = {}): Promise<any[]> {
    return this.requestWithRetry<any[]>('GET', '/comments', { params: options as Record<string, string | number> })
  }

  // ============================================================
  // EXTENSIONS ENDPOINTS
  // ============================================================

  /**
   * Get extensions for a reservation
   */
  async getReservationExtensions(reservationId: number | string): Promise<any[]> {
    return this.requestWithRetry<any[]>('GET', `/car-rental/reservations/${reservationId}/extensions`)
  }

  // ============================================================
  // EXTERNAL CHARGES ENDPOINTS
  // ============================================================

  /**
   * Get external charges for a reservation
   */
  async getReservationExternalCharges(reservationId: number | string): Promise<any[]> {
    return this.requestWithRetry<any[]>('GET', `/car-rental/reservations/${reservationId}/external-charges`)
  }

  // ============================================================
  // ADJUSTMENTS ENDPOINTS
  // ============================================================

  /**
   * Get adjustments for a reservation
   */
  async getReservationAdjustments(reservationId: number | string): Promise<any[]> {
    return this.requestWithRetry<any[]>('GET', `/car-rental/reservations/${reservationId}/adjustments`)
  }

  // ============================================================
  // RATES ENDPOINTS
  // ============================================================

  /**
   * Get all rates
   */
  async getRates(options: { limit?: number; page?: number } = {}): Promise<{ data: any[]; total: number }> {
    const { limit = 200, page = 1 } = options
    return this.requestWithRetry<{ data: any[]; total: number }>('GET', '/car-rental/rates', {
      params: { limit, page }
    })
  }

  /**
   * Get all rate types
   */
  async getRateTypes(): Promise<any[]> {
    return this.requestWithRetry<any[]>('GET', '/car-rental/rate-types')
  }

  // ============================================================
  // ADDITIONAL CHARGES ENDPOINTS
  // ============================================================

  /**
   * Get all additional charges (insurance, GPS, etc.)
   */
  async getAdditionalCharges(): Promise<any[]> {
    return this.requestWithRetry<any[]>('GET', '/fleets/additional-charges')
  }

  // ============================================================
  // LOCATIONS ENDPOINTS
  // ============================================================

  /**
   * Get all locations
   */
  async getLocations(): Promise<any[]> {
    return this.requestWithRetry<any[]>('GET', '/fleets/locations')
  }

  // ============================================================
  // BRANCHES ENDPOINTS
  // ============================================================

  /**
   * Get all branches/brands
   */
  async getBranches(): Promise<any[]> {
    return this.requestWithRetry<any[]>('GET', '/fleets/branches')
  }

  // ============================================================
  // VEHICLE TYPES/CLASSES/MODELS ENDPOINTS
  // ============================================================

  /**
   * Get vehicle types (classes)
   */
  async getVehicleTypes(): Promise<any[]> {
    return this.requestWithRetry<any[]>('GET', '/fleets/vehicles/types')
  }

  /**
   * Get vehicle models
   */
  async getVehicleModels(): Promise<any[]> {
    return this.requestWithRetry<any[]>('GET', '/fleets/vehicles/models')
  }

  // ============================================================
  // BLOCKED PERIODS ENDPOINTS
  // ============================================================

  /**
   * Get blocked periods for a vehicle
   */
  async getVehicleBlockedPeriods(vehicleId: number | string): Promise<any[]> {
    return this.requestWithRetry<any[]>('GET', `/fleets/vehicles/${vehicleId}/blocked-periods`)
  }

  // ============================================================
  // REPAIR ORDERS ENDPOINTS
  // ============================================================

  /**
   * Get all repair orders
   */
  async getRepairOrders(options: { limit?: number; page?: number } = {}): Promise<{ data: any[]; total: number }> {
    const { limit = 200, page = 1 } = options
    return this.requestWithRetry<{ data: any[]; total: number }>('GET', '/fleets/repair-orders', {
      params: { limit, page }
    })
  }

  /**
   * Get single repair order
   */
  async getRepairOrder(id: number | string): Promise<any> {
    return this.requestWithRetry<any>('GET', `/fleets/repair-orders/${id}`)
  }

  // ============================================================
  // SECURITY DEPOSITS ENDPOINTS
  // ============================================================

  /**
   * Get all security deposits
   */
  async getSecurityDeposits(): Promise<any[]> {
    return this.requestWithRetry<any[]>('GET', '/car-rental/security-deposits')
  }

  // ============================================================
  // EMAIL TEMPLATES ENDPOINTS
  // ============================================================

  /**
   * Get all email templates
   */
  async getEmailTemplates(): Promise<any[]> {
    return this.requestWithRetry<any[]>('GET', '/car-rental/email-templates')
  }

  // ============================================================
  // FINES ENDPOINTS
  // ============================================================

  /**
   * Get all fines
   */
  async getFines(options: { limit?: number; page?: number } = {}): Promise<{ data: any[]; total: number }> {
    const { limit = 200, page = 1 } = options
    return this.requestWithRetry<{ data: any[]; total: number }>('GET', '/car-rental/fines', {
      params: { limit, page }
    })
  }

  // ============================================================
  // PAYMENT METHODS ENDPOINTS
  // ============================================================

  /**
   * Get all payment methods
   */
  async getPaymentMethods(): Promise<any[]> {
    return this.requestWithRetry<any[]>('GET', '/payment-methods')
  }

  // ============================================================
  // CUSTOM FIELDS ENDPOINTS
  // ============================================================

  /**
   * Get all custom fields
   */
  async getCustomFields(): Promise<any[]> {
    return this.requestWithRetry<any[]>('GET', '/fields')
  }

  // ============================================================
  // VEHICLE REPLACEMENTS ENDPOINTS
  // ============================================================

  /**
   * Get vehicle replacements for a reservation
   */
  async getReservationVehicleReplacements(reservationId: number | string): Promise<any[]> {
    return this.requestWithRetry<any[]>('GET', `/car-rental/reservations/${reservationId}/vehicle-replacements`)
  }

  // ============================================================
  // VEHICLE MAINTENANCE HISTORY ENDPOINTS
  // ============================================================

  /**
   * Get maintenance history for a vehicle
   */
  async getVehicleMaintenanceHistory(vehicleId: number | string): Promise<any[]> {
    return this.requestWithRetry<any[]>('GET', `/fleets/vehicles/${vehicleId}/maintenance`)
  }
}
