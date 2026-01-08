/**
 * Gmail Integration Types
 */

import type { gmail_v1 } from 'googleapis'

export interface GmailSyncContext {
  db: import('@mrst/db').Database
  tenantId: string
  integrationAccountId: string
  gmailAccountId: string
  userEmail: string
  onProgress?: (message: string, counts?: { processed: number; total?: number }) => void
}

export interface SyncResult {
  success: boolean
  created: number
  updated: number
  skipped: number
  error?: string
}

/**
 * Junk attachment patterns to filter out
 * These are common email signatures, tracking pixels, etc.
 */
export const JUNK_ATTACHMENT_PATTERNS = {
  // Filename patterns (case-insensitive)
  filenames: [
    /^image\d{3}\.(png|gif|jpg|jpeg)$/i, // image001.png, etc.
    /^(logo|icon|banner|signature|sig)[_-]?\d*\.(png|gif|jpg|jpeg)$/i,
    /tracking\.gif$/i,
    /pixel\.gif$/i,
    /spacer\.gif$/i,
    /transparent\.gif$/i,
    /blank\.gif$/i,
    /email-open\.gif$/i,
    /^(facebook|twitter|linkedin|instagram|youtube|tiktok|x)[_-]?(icon|logo)?\.(png|svg|jpg)$/i,
    /^(fb|tw|li|ig|yt)[_-]?(icon|logo)?\.(png|svg|jpg)$/i,
    /unsubscribe.*\.(png|gif|jpg)$/i,
    /confidential.*notice/i,
  ],

  // Content-ID patterns (inline images)
  contentIds: [
    /^<image\d{3}.*>$/i,
    /^<logo.*>$/i,
    /^<signature.*>$/i,
    /^<icon.*>$/i,
  ],

  // MIME types to be more careful with
  suspiciousMimeTypes: [
    'image/gif', // Often tracking pixels
  ],
}

/**
 * Minimum file size to keep (bytes)
 * Files under this size are likely icons/pixels
 */
export const MIN_ATTACHMENT_SIZE = 50 * 1024 // 50KB

/**
 * MIME types that should always be kept regardless of size
 */
export const ALWAYS_KEEP_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'text/csv',
  'text/plain',
  'application/json',
]

/**
 * Check if an attachment should be kept or filtered out
 */
export function shouldKeepAttachment(
  filename: string | undefined | null,
  mimeType: string | undefined | null,
  size: number | undefined | null,
  contentId: string | undefined | null,
  isInline: boolean
): boolean {
  // Always keep documents
  if (mimeType && ALWAYS_KEEP_MIME_TYPES.includes(mimeType)) {
    return true
  }

  // Check file size - keep files over threshold
  if (size && size >= MIN_ATTACHMENT_SIZE) {
    return true
  }

  // Filter out known junk patterns
  if (filename) {
    for (const pattern of JUNK_ATTACHMENT_PATTERNS.filenames) {
      if (pattern.test(filename)) {
        return false
      }
    }
  }

  // Filter out known junk content-IDs
  if (contentId) {
    for (const pattern of JUNK_ATTACHMENT_PATTERNS.contentIds) {
      if (pattern.test(contentId)) {
        return false
      }
    }
  }

  // Be suspicious of small inline GIFs (likely tracking pixels)
  if (isInline && mimeType === 'image/gif' && (!size || size < 10000)) {
    return false
  }

  // Keep by default if we're unsure
  return true
}

/**
 * Parse email addresses from Gmail message headers
 */
export function parseEmailAddresses(header: string | null | undefined): string[] {
  if (!header) return []

  // Match email addresses like "Name <email@domain.com>" or just "email@domain.com"
  const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g
  const matches = header.match(emailRegex)
  return matches ? [...new Set(matches)] : []
}

/**
 * Parse a single email address (from field)
 */
export function parseFromHeader(header: string | null | undefined): { email: string | null; name: string | null } {
  if (!header) return { email: null, name: null }

  // Try to match "Name <email@domain.com>"
  const match = header.match(/^(.+?)\s*<([\w.-]+@[\w.-]+\.\w+)>$/)
  if (match) {
    return {
      name: match[1]?.trim().replace(/^["']|["']$/g, '') || null,
      email: match[2] || null,
    }
  }

  // Just email address
  const emailMatch = header.match(/([\w.-]+@[\w.-]+\.\w+)/)
  return {
    name: null,
    email: emailMatch?.[1] || null,
  }
}

/**
 * Extract headers from Gmail message payload
 */
export function extractHeaders(payload: gmail_v1.Schema$MessagePart | undefined): Record<string, string> {
  const headers: Record<string, string> = {}
  if (payload?.headers) {
    for (const header of payload.headers) {
      if (header.name && header.value) {
        headers[header.name.toLowerCase()] = header.value
      }
    }
  }
  return headers
}

/**
 * Decode base64url encoded content
 */
export function decodeBase64Url(data: string): string {
  // Replace URL-safe characters
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

/**
 * Extract message body from Gmail message payload
 */
export function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): { plain: string | null; html: string | null } {
  let plain: string | null = null
  let html: string | null = null

  if (!payload) return { plain, html }

  // Helper to recursively find body parts
  function findBodies(part: gmail_v1.Schema$MessagePart) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      plain = decodeBase64Url(part.body.data)
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      html = decodeBase64Url(part.body.data)
    }

    if (part.parts) {
      for (const subPart of part.parts) {
        findBodies(subPart)
      }
    }
  }

  findBodies(payload)

  return { plain, html }
}

/**
 * Extract attachments info from Gmail message payload
 */
export interface AttachmentInfo {
  attachmentId: string
  filename: string
  mimeType: string | null
  size: number | null
  contentId: string | null
  isInline: boolean
}

export function extractAttachments(payload: gmail_v1.Schema$MessagePart | undefined): AttachmentInfo[] {
  const attachments: AttachmentInfo[] = []

  if (!payload) return attachments

  function findAttachments(part: gmail_v1.Schema$MessagePart) {
    // Check if this part has an attachment
    if (part.body?.attachmentId && part.filename) {
      const headers = extractHeaders(part)
      const contentDisposition = headers['content-disposition'] || ''
      const contentId = headers['content-id'] || null

      attachments.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType || null,
        size: part.body.size || null,
        contentId: contentId?.replace(/^<|>$/g, '') || null,
        isInline: contentDisposition.includes('inline'),
      })
    }

    // Recurse into parts
    if (part.parts) {
      for (const subPart of part.parts) {
        findAttachments(subPart)
      }
    }
  }

  findAttachments(payload)

  return attachments
}
