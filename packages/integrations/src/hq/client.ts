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
}
