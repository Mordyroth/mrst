/**
 * Monday.com GraphQL Client
 *
 * Rate limits:
 * - Personal API tokens: 10M complexity points per minute
 * - Each query returns complexity info
 * - Wait for reset if rate limited
 */

import { sleep } from '@mrst/shared'

export interface MondayClientConfig {
  apiKey: string
  apiUrl?: string
}

export interface MondayComplexity {
  before: number
  after: number
  query: number
  reset_in_x_seconds: number
}

export interface MondayResponse<T> {
  data?: T
  errors?: Array<{
    message: string
    extensions?: {
      code?: string
      exception?: {
        retry_in_seconds?: number
      }
    }
  }>
  complexity?: MondayComplexity
  account_id?: number
}

export class MondayRateLimitError extends Error {
  constructor(public retryInSeconds: number) {
    super(`Rate limited. Retry in ${retryInSeconds} seconds.`)
    this.name = 'MondayRateLimitError'
  }
}

export class MondayClient {
  private apiKey: string
  private apiUrl: string
  private complexityUsed = 0
  private lastResetTime = Date.now()

  constructor(config: MondayClientConfig) {
    this.apiKey = config.apiKey
    this.apiUrl = config.apiUrl || 'https://api.monday.com/v2'
  }

  /**
   * Execute a GraphQL query with automatic rate limiting
   */
  async query<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    const response = await this.executeQuery<T>(query, variables)

    if (response.errors && response.errors.length > 0) {
      const error = response.errors[0]

      // Check for rate limit error
      if (error.extensions?.code === 'ComplexityException' ||
          error.message.includes('rate') ||
          error.message.includes('complexity')) {
        const retryIn = error.extensions?.exception?.retry_in_seconds || 60
        throw new MondayRateLimitError(retryIn)
      }

      throw new Error(`Monday.com API error: ${error.message}`)
    }

    if (!response.data) {
      throw new Error('No data returned from Monday.com API')
    }

    // Track complexity
    if (response.complexity) {
      this.complexityUsed += response.complexity.query
      console.log(`[Monday] Complexity: ${response.complexity.query} (${response.complexity.after} remaining, resets in ${response.complexity.reset_in_x_seconds}s)`)
    }

    return response.data
  }

  /**
   * Execute query with automatic retry on rate limit
   */
  async queryWithRetry<T>(
    query: string,
    variables?: Record<string, unknown>,
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.query<T>(query, variables)
      } catch (error) {
        lastError = error as Error

        if (error instanceof MondayRateLimitError) {
          console.log(`[Monday] Rate limited. Waiting ${error.retryInSeconds}s before retry (attempt ${attempt}/${maxRetries})`)
          await sleep(error.retryInSeconds * 1000)
        } else if (attempt < maxRetries) {
          // Exponential backoff for other errors
          const waitTime = Math.min(1000 * Math.pow(2, attempt), 30000)
          console.log(`[Monday] Error: ${(error as Error).message}. Retrying in ${waitTime}ms (attempt ${attempt}/${maxRetries})`)
          await sleep(waitTime)
        } else {
          throw error
        }
      }
    }

    throw lastError || new Error('Max retries exceeded')
  }

  /**
   * Execute raw GraphQL query
   */
  private async executeQuery<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<MondayResponse<T>> {
    const body: { query: string; variables?: Record<string, unknown> } = { query }
    if (variables) {
      body.variables = variables
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey,
        'API-Version': '2024-10',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Paginated query helper
   */
  async *queryPaginated<T, R>(
    buildQuery: (page: number, limit: number) => string,
    extractItems: (data: T) => R[],
    hasMore: (data: T, items: R[]) => boolean,
    limit = 100
  ): AsyncGenerator<R[], void, unknown> {
    let page = 1
    let hasMoreItems = true

    while (hasMoreItems) {
      const query = buildQuery(page, limit)
      const data = await this.queryWithRetry<T>(query)
      const items = extractItems(data)

      if (items.length > 0) {
        yield items
      }

      hasMoreItems = hasMore(data, items)
      page++

      // Small delay between pages to be nice to the API
      if (hasMoreItems) {
        await sleep(100)
      }
    }
  }

  /**
   * Get current complexity stats
   */
  getComplexityStats() {
    return {
      complexityUsed: this.complexityUsed,
      lastResetTime: this.lastResetTime,
    }
  }

  /**
   * Reset complexity tracking
   */
  resetComplexityStats() {
    this.complexityUsed = 0
    this.lastResetTime = Date.now()
  }
}
