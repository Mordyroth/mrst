/**
 * Shared utility functions
 */

import crypto from 'crypto'

// Re-export S3 utilities
export * from './s3'

// Re-export shop location utilities
export * from './shop-location'

/**
 * Generate a SHA-256 hash of data for change detection
 */
export function hashData(data: unknown): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data)
  return crypto.createHash('sha256').update(str).digest('hex')
}

/**
 * Normalize phone number to E.164 format
 * Returns null if cannot be normalized
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')

  // US number handling
  if (digits.length === 10) {
    return `+1${digits}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }

  // International format
  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`
  }

  return null
}

/**
 * Normalize email to lowercase, trimmed
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null
  return email.toLowerCase().trim()
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number
    initialDelayMs?: number
    maxDelayMs?: number
  } = {}
): Promise<T> {
  const { maxAttempts = 3, initialDelayMs = 1000, maxDelayMs = 30000 } = options

  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (attempt === maxAttempts) {
        break
      }

      const delay = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs)
      await sleep(delay)
    }
  }

  throw lastError
}

/**
 * Chunk an array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Create a debounced version of a function
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => fn(...args), delayMs)
  }
}

/**
 * Safe JSON parse that returns null on error
 */
export function safeJsonParse<T>(str: string): T | null {
  try {
    return JSON.parse(str) as T
  } catch {
    return null
  }
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format datetime for display
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
