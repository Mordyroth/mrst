/**
 * Gmail API Client
 * Uses Google Service Account with domain-wide delegation
 */

import { google, gmail_v1, admin_directory_v1 } from 'googleapis'
import * as fs from 'fs'

/**
 * Service account paths per domain
 * Each domain requires its own service account with domain-wide delegation
 */
export const DOMAIN_SERVICE_ACCOUNTS: Record<string, string> = {
  'travelautorental.com': '/home/ec2-user/projects/mrst/config/google-service-account.json',
  'certifiedautocollision.com': '/home/ec2-user/projects/mrst/config/certified-service-account.json',
}

/**
 * Gmail API scope - full access for read/write/send
 * Used for both travelautorental.com and certifiedautocollision.com
 */
export const GMAIL_SCOPE = 'https://mail.google.com/'

/**
 * Default service account path (for backwards compatibility)
 */
export const SERVICE_ACCOUNT_PATH = DOMAIN_SERVICE_ACCOUNTS['travelautorental.com']!

/**
 * Domains to sync mailboxes from
 */
export const DOMAINS_TO_SYNC = Object.keys(DOMAIN_SERVICE_ACCOUNTS)

/**
 * Get the service account path for a given email address
 */
export function getServiceAccountForEmail(email: string): string {
  const domain = email.split('@')[1]
  if (!domain) {
    throw new Error(`Invalid email address: ${email}`)
  }
  const serviceAccountPath = DOMAIN_SERVICE_ACCOUNTS[domain]
  if (!serviceAccountPath) {
    throw new Error(`No service account configured for domain: ${domain}`)
  }
  return serviceAccountPath
}

export interface GmailClientConfig {
  serviceAccountPath?: string
  userEmail: string // Email to impersonate
}

export interface GmailClient {
  gmail: gmail_v1.Gmail
  userEmail: string
}

export interface ServiceAccountCredentials {
  client_email: string
  private_key: string
}

/**
 * Load service account credentials from file
 */
export function loadServiceAccountCredentials(path: string = SERVICE_ACCOUNT_PATH): ServiceAccountCredentials {
  const serviceAccountJson = fs.readFileSync(path, 'utf-8')
  return JSON.parse(serviceAccountJson) as ServiceAccountCredentials
}

/**
 * Create a Gmail client using service account credentials
 * Automatically selects the correct service account based on email domain
 */
export async function createGmailClient(config: GmailClientConfig): Promise<GmailClient> {
  const serviceAccountPath = config.serviceAccountPath || getServiceAccountForEmail(config.userEmail)
  const credentials = loadServiceAccountCredentials(serviceAccountPath)

  // Create JWT client with domain-wide delegation using google.auth.JWT
  // Full Gmail scope for read/write/send access
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [GMAIL_SCOPE],
    subject: config.userEmail, // Impersonate this user
  })

  // Create Gmail API client
  const gmail = google.gmail({ version: 'v1', auth })

  return {
    gmail,
    userEmail: config.userEmail,
  }
}

/**
 * Create an Admin SDK client for user discovery
 * Note: This requires the service account to have admin SDK access and
 * domain-wide delegation enabled in Google Workspace
 */
export async function createAdminClient(
  serviceAccountPath: string = SERVICE_ACCOUNT_PATH,
  adminEmail: string // Must be a super admin email to impersonate
): Promise<admin_directory_v1.Admin> {
  const credentials = loadServiceAccountCredentials(serviceAccountPath)

  // Create JWT client with admin scopes using google.auth.JWT
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [
      'https://www.googleapis.com/auth/admin.directory.user.readonly',
    ],
    subject: adminEmail, // Must impersonate a super admin
  })

  return google.admin({ version: 'directory_v1', auth })
}

/**
 * Discover all user mailboxes in a domain using Admin SDK
 */
export async function discoverDomainUsers(
  adminClient: admin_directory_v1.Admin,
  domain: string
): Promise<string[]> {
  const emails: string[] = []
  let pageToken: string | undefined

  do {
    const response = await adminClient.users.list({
      domain,
      maxResults: 500,
      pageToken,
      orderBy: 'email',
      // Only get active users with gmail enabled
      query: 'isSuspended=false',
    })

    const users = response.data.users || []
    for (const user of users) {
      if (user.primaryEmail && !user.suspended) {
        emails.push(user.primaryEmail)
      }
    }

    pageToken = response.data.nextPageToken || undefined
  } while (pageToken)

  return emails
}

/**
 * Discover all mailboxes across all configured domains
 * Uses per-domain admin emails and service accounts for impersonation
 */
export async function discoverAllMailboxes(
  domainAdmins: Record<string, string>,
  domains: string[] = DOMAINS_TO_SYNC
): Promise<{ domain: string; emails: string[] }[]> {
  const results: { domain: string; emails: string[] }[] = []

  for (const domain of domains) {
    const adminEmail = domainAdmins[domain]
    if (!adminEmail) {
      console.error(`No admin email configured for domain: ${domain}`)
      results.push({ domain, emails: [] })
      continue
    }

    const serviceAccountPath = DOMAIN_SERVICE_ACCOUNTS[domain]
    if (!serviceAccountPath) {
      console.error(`No service account configured for domain: ${domain}`)
      results.push({ domain, emails: [] })
      continue
    }

    try {
      const adminClient = await createAdminClient(serviceAccountPath, adminEmail)
      const emails = await discoverDomainUsers(adminClient, domain)
      results.push({ domain, emails })
      console.log(`Discovered ${emails.length} users in ${domain}`)
    } catch (error) {
      console.error(`Error discovering users in ${domain}:`, error)
      results.push({ domain, emails: [] })
    }
  }

  return results
}

/**
 * Rate limiter for Gmail API (250 quota units/second/user)
 * Most operations cost 5-100 units, so we limit to ~10 requests/second
 */
export class GmailRateLimiter {
  private requestTimes: number[] = []
  private readonly windowMs = 1000
  private readonly maxRequestsPerWindow = 10

  async throttle(): Promise<void> {
    const now = Date.now()

    // Remove old timestamps
    this.requestTimes = this.requestTimes.filter(t => now - t < this.windowMs)

    // If at limit, wait until window clears
    if (this.requestTimes.length >= this.maxRequestsPerWindow) {
      const oldestRequest = this.requestTimes[0]
      if (oldestRequest) {
        const waitTime = this.windowMs - (now - oldestRequest)
        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      }
    }

    this.requestTimes.push(Date.now())
  }
}

/**
 * Wrapper for making throttled Gmail API calls
 */
export async function gmailRequest<T>(
  rateLimiter: GmailRateLimiter,
  request: () => Promise<T>
): Promise<T> {
  await rateLimiter.throttle()
  return request()
}
