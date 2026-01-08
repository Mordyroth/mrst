/**
 * Gmail Sync Service
 * Syncs labels, threads, messages, and attachments
 */

import { eq, and, isNull, sql, desc } from 'drizzle-orm'
import { createHash } from 'crypto'
import type { gmail_v1 } from 'googleapis'
import {
  gmailAccounts,
  gmailLabels,
  gmailThreads,
  gmailMessages,
  gmailAttachments,
  type Database,
} from '@mrst/db'
import {
  createGmailClient,
  GmailRateLimiter,
  gmailRequest,
  type GmailClient,
} from './client'
import {
  type GmailSyncContext,
  type SyncResult,
  type AttachmentInfo,
  extractHeaders,
  extractBody,
  extractAttachments,
  parseFromHeader,
  parseEmailAddresses,
  shouldKeepAttachment,
} from './types'

/**
 * Hash an object for change detection
 */
function hashObject(obj: unknown): string {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex')
}

/**
 * Sync or create a Gmail account record
 */
export async function syncGmailAccount(
  db: Database,
  tenantId: string,
  integrationAccountId: string,
  client: GmailClient
): Promise<string> {
  // Get Gmail profile
  const profile = await client.gmail.users.getProfile({ userId: 'me' })
  const profileData = profile.data

  if (!profileData.emailAddress) {
    throw new Error('Failed to get email address from Gmail profile')
  }

  const raw = profileData as Record<string, unknown>

  // Check if account exists
  const existing = await db
    .select({ id: gmailAccounts.id })
    .from(gmailAccounts)
    .where(
      and(
        eq(gmailAccounts.integrationAccountId, integrationAccountId),
        eq(gmailAccounts.emailAddress, profileData.emailAddress)
      )
    )
    .limit(1)

  if (existing[0]) {
    // Update existing
    await db
      .update(gmailAccounts)
      .set({
        displayName: profileData.emailAddress,
        messagesTotal: profileData.messagesTotal ?? 0,
        threadsTotal: profileData.threadsTotal ?? 0,
        raw,
        lastSeenAt: new Date(),
        syncedAt: new Date(),
      })
      .where(eq(gmailAccounts.id, existing[0].id))

    return existing[0].id
  }

  // Create new account
  const [newAccount] = await db
    .insert(gmailAccounts)
    .values({
      integrationAccountId,
      emailAddress: profileData.emailAddress,
      displayName: profileData.emailAddress,
      messagesTotal: profileData.messagesTotal ?? 0,
      threadsTotal: profileData.threadsTotal ?? 0,
      raw,
    })
    .returning({ id: gmailAccounts.id })

  return newAccount!.id
}

/**
 * Sync Gmail labels
 */
export async function syncLabels(
  ctx: GmailSyncContext,
  client: GmailClient,
  rateLimiter: GmailRateLimiter
): Promise<SyncResult> {
  let created = 0
  let updated = 0
  let skipped = 0

  try {
    ctx.onProgress?.('Fetching Gmail labels...')

    const response = await gmailRequest(rateLimiter, () =>
      client.gmail.users.labels.list({ userId: 'me' })
    )

    const labels = response.data.labels || []
    ctx.onProgress?.(`Found ${labels.length} labels`)

    for (const label of labels) {
      if (!label.id || !label.name) {
        skipped++
        continue
      }

      try {
        // Get full label details
        const labelDetail = await gmailRequest(rateLimiter, () =>
          client.gmail.users.labels.get({ userId: 'me', id: label.id! })
        )

        const labelData = labelDetail.data
        const raw = labelData as Record<string, unknown>
        const sourceHash = hashObject(raw)

        // Check if exists
        const existing = await ctx.db
          .select({ id: gmailLabels.id, sourceHash: gmailLabels.sourceHash })
          .from(gmailLabels)
          .where(
            and(
              eq(gmailLabels.gmailAccountId, ctx.gmailAccountId),
              eq(gmailLabels.externalId, label.id)
            )
          )
          .limit(1)

        if (existing[0]) {
          if (existing[0].sourceHash !== sourceHash) {
            await ctx.db
              .update(gmailLabels)
              .set({
                name: labelData.name || label.name,
                type: labelData.type || null,
                messagesTotal: labelData.messagesTotal ?? 0,
                messagesUnread: labelData.messagesUnread ?? 0,
                threadsTotal: labelData.threadsTotal ?? 0,
                threadsUnread: labelData.threadsUnread ?? 0,
                color: labelData.color || null,
                raw,
                lastSeenAt: new Date(),
                sourceHash,
                syncedAt: new Date(),
                deletedAt: null,
              })
              .where(eq(gmailLabels.id, existing[0].id))
            updated++
          } else {
            // Just update lastSeenAt
            await ctx.db
              .update(gmailLabels)
              .set({ lastSeenAt: new Date(), deletedAt: null })
              .where(eq(gmailLabels.id, existing[0].id))
            skipped++
          }
        } else {
          await ctx.db.insert(gmailLabels).values({
            integrationAccountId: ctx.integrationAccountId,
            gmailAccountId: ctx.gmailAccountId,
            externalId: label.id,
            name: labelData.name || label.name,
            type: labelData.type || null,
            messagesTotal: labelData.messagesTotal ?? 0,
            messagesUnread: labelData.messagesUnread ?? 0,
            threadsTotal: labelData.threadsTotal ?? 0,
            threadsUnread: labelData.threadsUnread ?? 0,
            color: labelData.color || null,
            raw,
            sourceHash,
          })
          created++
        }
      } catch (err) {
        console.error(`Error syncing label ${label.id}:`, err)
        skipped++
      }
    }

    ctx.onProgress?.(`Labels synced: ${created} created, ${updated} updated, ${skipped} skipped`)
    return { success: true, created, updated, skipped }
  } catch (error) {
    return { success: false, created, updated, skipped, error: (error as Error).message }
  }
}

/**
 * Sync Gmail threads
 */
export async function syncThreads(
  ctx: GmailSyncContext,
  client: GmailClient,
  rateLimiter: GmailRateLimiter,
  maxThreads: number = 500
): Promise<SyncResult> {
  let created = 0
  let updated = 0
  let skipped = 0
  let pageToken: string | undefined

  try {
    ctx.onProgress?.('Fetching Gmail threads...')

    let totalFetched = 0

    while (totalFetched < maxThreads) {
      const response = await gmailRequest(rateLimiter, () =>
        client.gmail.users.threads.list({
          userId: 'me',
          maxResults: Math.min(100, maxThreads - totalFetched),
          pageToken,
        })
      )

      const threads = response.data.threads || []
      ctx.onProgress?.(`Processing ${threads.length} threads (${totalFetched} total)...`, {
        processed: totalFetched,
        total: response.data.resultSizeEstimate || undefined,
      })

      for (const threadSummary of threads) {
        if (!threadSummary.id) {
          skipped++
          continue
        }

        try {
          // Get full thread with messages
          const threadDetail = await gmailRequest(rateLimiter, () =>
            client.gmail.users.threads.get({
              userId: 'me',
              id: threadSummary.id!,
              format: 'metadata',
              metadataHeaders: ['Subject', 'From', 'To', 'Cc', 'Date'],
            })
          )

          const threadData = threadDetail.data
          const raw = threadData as Record<string, unknown>
          const sourceHash = hashObject(raw)

          // Extract thread info
          const messages = threadData.messages || []
          const firstMessage = messages[0]
          const lastMessage = messages[messages.length - 1]

          const firstHeaders = extractHeaders(firstMessage?.payload)
          const subject = firstHeaders['subject'] || null
          const participantEmails = new Set<string>()

          for (const msg of messages) {
            const headers = extractHeaders(msg.payload)
            parseEmailAddresses(headers['from']).forEach(e => participantEmails.add(e))
            parseEmailAddresses(headers['to']).forEach(e => participantEmails.add(e))
            parseEmailAddresses(headers['cc']).forEach(e => participantEmails.add(e))
          }

          const firstMessageDate = firstMessage?.internalDate
            ? new Date(parseInt(firstMessage.internalDate))
            : null
          const lastMessageDate = lastMessage?.internalDate
            ? new Date(parseInt(lastMessage.internalDate))
            : null

          // Check if exists
          const existing = await ctx.db
            .select({ id: gmailThreads.id, sourceHash: gmailThreads.sourceHash })
            .from(gmailThreads)
            .where(
              and(
                eq(gmailThreads.gmailAccountId, ctx.gmailAccountId),
                eq(gmailThreads.externalId, threadSummary.id)
              )
            )
            .limit(1)

          const threadValues = {
            historyId: threadData.historyId || null,
            snippet: threadData.snippet || null,
            subject,
            participantEmails: [...participantEmails],
            messageCount: messages.length,
            firstMessageAt: firstMessageDate,
            lastMessageAt: lastMessageDate,
            labelIds: messages[0]?.labelIds || [],
            raw,
            sourceHash,
            lastSeenAt: new Date(),
            syncedAt: new Date(),
            deletedAt: null,
          }

          if (existing[0]) {
            if (existing[0].sourceHash !== sourceHash) {
              await ctx.db
                .update(gmailThreads)
                .set(threadValues)
                .where(eq(gmailThreads.id, existing[0].id))
              updated++
            } else {
              await ctx.db
                .update(gmailThreads)
                .set({ lastSeenAt: new Date(), deletedAt: null })
                .where(eq(gmailThreads.id, existing[0].id))
              skipped++
            }
          } else {
            await ctx.db.insert(gmailThreads).values({
              integrationAccountId: ctx.integrationAccountId,
              gmailAccountId: ctx.gmailAccountId,
              externalId: threadSummary.id,
              ...threadValues,
            })
            created++
          }
        } catch (err) {
          console.error(`Error syncing thread ${threadSummary.id}:`, err)
          skipped++
        }
      }

      totalFetched += threads.length
      pageToken = response.data.nextPageToken || undefined

      if (!pageToken || threads.length === 0) break
    }

    ctx.onProgress?.(`Threads synced: ${created} created, ${updated} updated, ${skipped} skipped`)
    return { success: true, created, updated, skipped }
  } catch (error) {
    return { success: false, created, updated, skipped, error: (error as Error).message }
  }
}

/**
 * Sync messages for all threads
 */
export async function syncMessages(
  ctx: GmailSyncContext,
  client: GmailClient,
  rateLimiter: GmailRateLimiter
): Promise<SyncResult> {
  let created = 0
  let updated = 0
  let skipped = 0

  try {
    ctx.onProgress?.('Fetching threads that need message sync...')

    // Get threads that need their messages synced
    const threads = await ctx.db
      .select({
        id: gmailThreads.id,
        externalId: gmailThreads.externalId,
      })
      .from(gmailThreads)
      .where(
        and(
          eq(gmailThreads.gmailAccountId, ctx.gmailAccountId),
          isNull(gmailThreads.deletedAt)
        )
      )
      .orderBy(desc(gmailThreads.lastMessageAt))
      .limit(100)

    ctx.onProgress?.(`Processing messages for ${threads.length} threads...`)

    for (const thread of threads) {
      try {
        // Get thread with full message content
        const threadDetail = await gmailRequest(rateLimiter, () =>
          client.gmail.users.threads.get({
            userId: 'me',
            id: thread.externalId,
            format: 'full',
          })
        )

        const messages = threadDetail.data.messages || []

        for (const message of messages) {
          if (!message.id) continue

          const result = await syncMessage(
            ctx,
            thread.id,
            thread.externalId,
            message
          )

          if (result === 'created') created++
          else if (result === 'updated') updated++
          else skipped++
        }
      } catch (err) {
        console.error(`Error syncing messages for thread ${thread.externalId}:`, err)
        skipped++
      }
    }

    ctx.onProgress?.(`Messages synced: ${created} created, ${updated} updated, ${skipped} skipped`)
    return { success: true, created, updated, skipped }
  } catch (error) {
    return { success: false, created, updated, skipped, error: (error as Error).message }
  }
}

/**
 * Sync a single message
 */
async function syncMessage(
  ctx: GmailSyncContext,
  threadId: string,
  externalThreadId: string,
  message: gmail_v1.Schema$Message
): Promise<'created' | 'updated' | 'skipped'> {
  if (!message.id) return 'skipped'

  const raw = message as Record<string, unknown>
  const sourceHash = hashObject(raw)

  // Extract headers
  const headers = extractHeaders(message.payload)
  const fromParsed = parseFromHeader(headers['from'])
  const toEmails = parseEmailAddresses(headers['to'])
  const ccEmails = parseEmailAddresses(headers['cc'])
  const bccEmails = parseEmailAddresses(headers['bcc'])

  // Extract body
  const body = extractBody(message.payload)

  // Determine status from label IDs
  const labelIds = message.labelIds || []
  const isUnread = labelIds.includes('UNREAD')
  const isStarred = labelIds.includes('STARRED')
  const isImportant = labelIds.includes('IMPORTANT')
  const isDraft = labelIds.includes('DRAFT')
  const isSent = labelIds.includes('SENT')
  const isInbox = labelIds.includes('INBOX')
  const isTrash = labelIds.includes('TRASH')
  const isSpam = labelIds.includes('SPAM')

  // Check if exists
  const existing = await ctx.db
    .select({ id: gmailMessages.id, sourceHash: gmailMessages.sourceHash })
    .from(gmailMessages)
    .where(
      and(
        eq(gmailMessages.gmailAccountId, ctx.gmailAccountId),
        eq(gmailMessages.externalId, message.id)
      )
    )
    .limit(1)

  const messageValues = {
    historyId: message.historyId || null,
    subject: headers['subject'] || null,
    fromEmail: fromParsed.email,
    fromName: fromParsed.name,
    toEmails,
    ccEmails,
    bccEmails,
    replyTo: headers['reply-to'] || null,
    messageIdHeader: headers['message-id'] || null,
    inReplyTo: headers['in-reply-to'] || null,
    references: headers['references'] || null,
    snippet: message.snippet || null,
    bodyPlain: body.plain,
    bodyHtml: body.html,
    internalDate: message.internalDate ? new Date(parseInt(message.internalDate)) : null,
    sentAt: headers['date'] ? new Date(headers['date']) : null,
    labelIds,
    isUnread,
    isStarred,
    isImportant,
    isDraft,
    isSent,
    isInbox,
    isTrash,
    isSpam,
    sizeEstimate: message.sizeEstimate || null,
    raw,
    sourceHash,
    lastSeenAt: new Date(),
    syncedAt: new Date(),
    deletedAt: null,
  }

  let messageId: string

  if (existing[0]) {
    if (existing[0].sourceHash !== sourceHash) {
      await ctx.db
        .update(gmailMessages)
        .set(messageValues)
        .where(eq(gmailMessages.id, existing[0].id))
      messageId = existing[0].id

      // Sync attachments for updated message
      await syncAttachmentsForMessage(ctx, messageId, message)

      return 'updated'
    } else {
      await ctx.db
        .update(gmailMessages)
        .set({ lastSeenAt: new Date(), deletedAt: null })
        .where(eq(gmailMessages.id, existing[0].id))
      return 'skipped'
    }
  }

  const [newMessage] = await ctx.db
    .insert(gmailMessages)
    .values({
      integrationAccountId: ctx.integrationAccountId,
      gmailAccountId: ctx.gmailAccountId,
      threadId,
      externalId: message.id,
      externalThreadId,
      ...messageValues,
    })
    .returning({ id: gmailMessages.id })

  messageId = newMessage!.id

  // Sync attachments for new message
  await syncAttachmentsForMessage(ctx, messageId, message)

  return 'created'
}

/**
 * Sync attachments for a message
 */
async function syncAttachmentsForMessage(
  ctx: GmailSyncContext,
  messageId: string,
  message: gmail_v1.Schema$Message
): Promise<void> {
  const attachments = extractAttachments(message.payload)

  for (const att of attachments) {
    // Check if we should keep this attachment
    if (!shouldKeepAttachment(att.filename, att.mimeType, att.size, att.contentId, att.isInline)) {
      continue // Skip junk attachments
    }

    // Check if exists
    const existing = await ctx.db
      .select({ id: gmailAttachments.id })
      .from(gmailAttachments)
      .where(
        and(
          eq(gmailAttachments.messageId, messageId),
          eq(gmailAttachments.externalId, att.attachmentId)
        )
      )
      .limit(1)

    if (existing[0]) {
      // Update
      await ctx.db
        .update(gmailAttachments)
        .set({
          filename: att.filename,
          mimeType: att.mimeType,
          size: att.size,
          contentId: att.contentId,
          isInline: att.isInline,
          lastSeenAt: new Date(),
          syncedAt: new Date(),
        })
        .where(eq(gmailAttachments.id, existing[0].id))
    } else {
      // Create
      await ctx.db.insert(gmailAttachments).values({
        integrationAccountId: ctx.integrationAccountId,
        gmailAccountId: ctx.gmailAccountId,
        messageId,
        externalId: att.attachmentId,
        externalMessageId: message.id!,
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
        contentId: att.contentId,
        isInline: att.isInline,
      })
    }
  }
}

/**
 * Full sync for a Gmail account
 */
export async function syncAll(
  ctx: GmailSyncContext,
  client: GmailClient,
  options: {
    maxThreads?: number
  } = {}
): Promise<{
  labels: SyncResult
  threads: SyncResult
  messages: SyncResult
}> {
  const rateLimiter = new GmailRateLimiter()

  ctx.onProgress?.('Starting full Gmail sync...')

  // Sync labels
  const labels = await syncLabels(ctx, client, rateLimiter)

  // Sync threads
  const threads = await syncThreads(ctx, client, rateLimiter, options.maxThreads || 500)

  // Sync messages
  const messages = await syncMessages(ctx, client, rateLimiter)

  ctx.onProgress?.('Gmail sync complete')

  return { labels, threads, messages }
}

/**
 * Download pending Gmail attachments to S3
 */
export async function downloadPendingAttachments(
  ctx: GmailSyncContext,
  client: GmailClient,
  options: { batchSize?: number; maxFiles?: number } = {}
): Promise<SyncResult> {
  const { batchSize = 10, maxFiles = 500 } = options
  const rateLimiter = new GmailRateLimiter()
  let created = 0
  let skipped = 0
  let updated = 0
  let errorCount = 0

  try {
    ctx.onProgress?.('Fetching pending Gmail attachments to download...')

    // Get attachments that haven't been downloaded to S3
    const pendingAttachments = await ctx.db
      .select({
        id: gmailAttachments.id,
        externalId: gmailAttachments.externalId,
        externalMessageId: gmailAttachments.externalMessageId,
        filename: gmailAttachments.filename,
        mimeType: gmailAttachments.mimeType,
        size: gmailAttachments.size,
      })
      .from(gmailAttachments)
      .where(
        and(
          eq(gmailAttachments.gmailAccountId, ctx.gmailAccountId),
          eq(gmailAttachments.s3Downloaded, false)
        )
      )
      .limit(maxFiles)

    if (pendingAttachments.length === 0) {
      ctx.onProgress?.('No pending Gmail attachments to download')
      return { success: true, created, updated, skipped }
    }

    ctx.onProgress?.(`Found ${pendingAttachments.length} attachments to download`)

    // Process in batches
    for (let i = 0; i < pendingAttachments.length; i += batchSize) {
      const batch = pendingAttachments.slice(i, i + batchSize)

      for (const attachment of batch) {
        try {
          // Download attachment from Gmail
          const response = await gmailRequest(rateLimiter, () =>
            client.gmail.users.messages.attachments.get({
              userId: 'me',
              messageId: attachment.externalMessageId,
              id: attachment.externalId,
            })
          )

          const attachmentData = response.data
          if (!attachmentData.data) {
            console.error(`No data for attachment ${attachment.id}`)
            errorCount++
            continue
          }

          // Decode base64url data
          const buffer = Buffer.from(attachmentData.data, 'base64url')

          // Generate S3 key
          const s3Key = `gmail/${ctx.gmailAccountId}/attachments/${attachment.externalMessageId}/${attachment.externalId}_${sanitizeFilename(attachment.filename)}`
          const s3Bucket = process.env.S3_BUCKET || 'mrst-files'

          // Upload to S3
          const { uploadToS3 } = await import('@mrst/shared')
          await uploadToS3({
            bucket: s3Bucket,
            key: s3Key,
            body: buffer,
            contentType: attachment.mimeType || 'application/octet-stream',
          })

          // Update database
          await ctx.db
            .update(gmailAttachments)
            .set({
              s3Downloaded: true,
              s3Bucket,
              s3Key,
              downloadedAt: new Date(),
            })
            .where(eq(gmailAttachments.id, attachment.id))

          created++

          if (created % 50 === 0) {
            ctx.onProgress?.(`Downloaded ${created}/${pendingAttachments.length} attachments...`, {
              processed: created,
              total: pendingAttachments.length,
            })
          }
        } catch (err: any) {
          console.error(`Error downloading attachment ${attachment.id}:`, err.message)
          errorCount++
        }
      }
    }

    ctx.onProgress?.(`Download complete: ${created} downloaded, ${errorCount} errors`, {
      processed: created + errorCount,
      total: pendingAttachments.length,
    })

    return { success: true, created, updated, skipped }
  } catch (error) {
    console.error('Error in downloadPendingAttachments:', error)
    throw error
  }
}

/**
 * Sanitize filename for S3 key
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/__+/g, '_')
    .substring(0, 100)
}

/**
 * Incremental sync using Gmail History API
 * Only syncs changes since the last known historyId
 */
export async function syncIncremental(
  ctx: GmailSyncContext,
  client: GmailClient,
  options: { maxResults?: number } = {}
): Promise<{
  success: boolean
  messagesAdded: number
  messagesDeleted: number
  labelsChanged: number
  historyId: string | null
  needsFullResync: boolean
}> {
  const { maxResults = 500 } = options
  const rateLimiter = new GmailRateLimiter()
  let messagesAdded = 0
  let messagesDeleted = 0
  let labelsChanged = 0
  let newHistoryId: string | null = null

  try {
    // Get current historyId from account
    const account = await ctx.db
      .select({
        historyId: gmailAccounts.historyId,
        needsFullResync: gmailAccounts.needsFullResync,
      })
      .from(gmailAccounts)
      .where(eq(gmailAccounts.id, ctx.gmailAccountId))
      .limit(1)

    const currentHistoryId = account[0]?.historyId

    if (!currentHistoryId) {
      ctx.onProgress?.('No historyId found, need full sync first')
      return {
        success: false,
        messagesAdded: 0,
        messagesDeleted: 0,
        labelsChanged: 0,
        historyId: null,
        needsFullResync: true,
      }
    }

    ctx.onProgress?.(`Fetching history since ${currentHistoryId}...`)

    // Fetch history
    let pageToken: string | undefined
    const processedMessageIds = new Set<string>()

    do {
      try {
        const response = await gmailRequest(rateLimiter, () =>
          client.gmail.users.history.list({
            userId: 'me',
            startHistoryId: currentHistoryId,
            maxResults,
            pageToken,
            historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'],
          })
        )

        const history = response.data.history || []
        newHistoryId = response.data.historyId || null

        for (const record of history) {
          // Process added messages
          if (record.messagesAdded) {
            for (const added of record.messagesAdded) {
              const msgId = added.message?.id
              if (msgId && !processedMessageIds.has(msgId)) {
                processedMessageIds.add(msgId)
                try {
                  // Fetch full message details
                  const msgResponse = await gmailRequest(rateLimiter, () =>
                    client.gmail.users.messages.get({
                      userId: 'me',
                      id: msgId,
                      format: 'full',
                    })
                  )

                  const message = msgResponse.data
                  if (message.threadId) {
                    // Ensure thread exists
                    await ensureThread(ctx, client, rateLimiter, message.threadId)
                    // Sync the message
                    await syncSingleMessage(ctx, message)
                    messagesAdded++
                  }
                } catch (err: any) {
                  if (err.code === 404) {
                    // Message was deleted before we could fetch it
                    continue
                  }
                  console.error(`Error fetching message ${msgId}:`, err.message)
                }
              }
            }
          }

          // Process deleted messages
          if (record.messagesDeleted) {
            for (const deleted of record.messagesDeleted) {
              const msgId = deleted.message?.id
              if (msgId) {
                await ctx.db
                  .update(gmailMessages)
                  .set({ deletedAt: new Date() })
                  .where(
                    and(
                      eq(gmailMessages.gmailAccountId, ctx.gmailAccountId),
                      eq(gmailMessages.externalId, msgId)
                    )
                  )
                messagesDeleted++
              }
            }
          }

          // Process label changes
          if (record.labelsAdded || record.labelsRemoved) {
            const msgs = [...(record.labelsAdded || []), ...(record.labelsRemoved || [])]
            for (const change of msgs) {
              const msgId = change.message?.id
              const labelIds = change.message?.labelIds || []
              if (msgId) {
                await ctx.db
                  .update(gmailMessages)
                  .set({
                    labelIds,
                    isUnread: labelIds.includes('UNREAD'),
                    isStarred: labelIds.includes('STARRED'),
                    isImportant: labelIds.includes('IMPORTANT'),
                    isInbox: labelIds.includes('INBOX'),
                    isTrash: labelIds.includes('TRASH'),
                    isSpam: labelIds.includes('SPAM'),
                    lastSeenAt: new Date(),
                    syncedAt: new Date(),
                  })
                  .where(
                    and(
                      eq(gmailMessages.gmailAccountId, ctx.gmailAccountId),
                      eq(gmailMessages.externalId, msgId)
                    )
                  )
                labelsChanged++
              }
            }
          }
        }

        pageToken = response.data.nextPageToken || undefined
      } catch (err: any) {
        // Handle historyId too old error
        if (err.code === 404 || err.message?.includes('historyId')) {
          ctx.onProgress?.('History too old, marking for full resync')
          await ctx.db
            .update(gmailAccounts)
            .set({ needsFullResync: true })
            .where(eq(gmailAccounts.id, ctx.gmailAccountId))

          return {
            success: false,
            messagesAdded,
            messagesDeleted,
            labelsChanged,
            historyId: currentHistoryId,
            needsFullResync: true,
          }
        }
        throw err
      }
    } while (pageToken)

    // Update historyId in database
    if (newHistoryId) {
      await ctx.db
        .update(gmailAccounts)
        .set({
          historyId: newHistoryId,
          needsFullResync: false,
          syncedAt: new Date(),
        })
        .where(eq(gmailAccounts.id, ctx.gmailAccountId))
    }

    ctx.onProgress?.(
      `Incremental sync complete: ${messagesAdded} added, ${messagesDeleted} deleted, ${labelsChanged} labels changed`
    )

    return {
      success: true,
      messagesAdded,
      messagesDeleted,
      labelsChanged,
      historyId: newHistoryId,
      needsFullResync: false,
    }
  } catch (error) {
    console.error('Error in syncIncremental:', error)
    throw error
  }
}

/**
 * Ensure a thread exists in the database
 */
async function ensureThread(
  ctx: GmailSyncContext,
  client: GmailClient,
  rateLimiter: GmailRateLimiter,
  threadId: string
): Promise<string> {
  // Check if thread exists
  const existing = await ctx.db
    .select({ id: gmailThreads.id })
    .from(gmailThreads)
    .where(
      and(
        eq(gmailThreads.gmailAccountId, ctx.gmailAccountId),
        eq(gmailThreads.externalId, threadId)
      )
    )
    .limit(1)

  if (existing[0]) {
    return existing[0].id
  }

  // Fetch thread from Gmail
  const response = await gmailRequest(rateLimiter, () =>
    client.gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'To', 'Date'],
    })
  )

  const threadData = response.data
  const raw = threadData as Record<string, unknown>
  const sourceHash = hashObject(raw)

  // Extract subject from first message
  let subject: string | null = null
  const messages = threadData.messages || []
  if (messages[0]?.payload?.headers) {
    const subjectHeader = messages[0].payload.headers.find(
      (h: any) => h.name?.toLowerCase() === 'subject'
    )
    subject = subjectHeader?.value || null
  }

  // Get participant emails
  const participantEmails: string[] = []
  for (const msg of messages) {
    if (msg.payload?.headers) {
      for (const header of msg.payload.headers) {
        if (['from', 'to', 'cc'].includes(header.name?.toLowerCase() || '')) {
          const emails = parseEmailAddresses(header.value || '')
          participantEmails.push(...emails)
        }
      }
    }
  }

  // Get timing
  let firstMessageAt: Date | null = null
  let lastMessageAt: Date | null = null
  for (const msg of messages) {
    if (msg.internalDate) {
      const date = new Date(parseInt(msg.internalDate))
      if (!firstMessageAt || date < firstMessageAt) firstMessageAt = date
      if (!lastMessageAt || date > lastMessageAt) lastMessageAt = date
    }
  }

  // Create thread
  const [newThread] = await ctx.db
    .insert(gmailThreads)
    .values({
      integrationAccountId: ctx.integrationAccountId,
      gmailAccountId: ctx.gmailAccountId,
      externalId: threadId,
      historyId: threadData.historyId || null,
      snippet: threadData.snippet || null,
      subject,
      participantEmails: [...new Set(participantEmails)],
      messageCount: messages.length,
      firstMessageAt,
      lastMessageAt,
      labelIds: messages[0]?.labelIds || [],
      raw,
      sourceHash,
    })
    .returning({ id: gmailThreads.id })

  return newThread!.id
}

/**
 * Sync a single message to the database
 */
async function syncSingleMessage(
  ctx: GmailSyncContext,
  message: any
): Promise<void> {
  if (!message.id || !message.threadId) return

  // Get thread ID from database
  const thread = await ctx.db
    .select({ id: gmailThreads.id })
    .from(gmailThreads)
    .where(
      and(
        eq(gmailThreads.gmailAccountId, ctx.gmailAccountId),
        eq(gmailThreads.externalId, message.threadId)
      )
    )
    .limit(1)

  if (!thread[0]) {
    console.error(`Thread not found for message ${message.id}`)
    return
  }

  const raw = message as Record<string, unknown>
  const sourceHash = hashObject(raw)

  const headers = extractHeaders(message.payload)
  const fromParsed = parseFromHeader(headers['from'])
  const toEmails = parseEmailAddresses(headers['to'])
  const ccEmails = parseEmailAddresses(headers['cc'])
  const bccEmails = parseEmailAddresses(headers['bcc'])
  const body = extractBody(message.payload)

  const labelIds = message.labelIds || []

  // Check if message exists
  const existing = await ctx.db
    .select({ id: gmailMessages.id })
    .from(gmailMessages)
    .where(
      and(
        eq(gmailMessages.gmailAccountId, ctx.gmailAccountId),
        eq(gmailMessages.externalId, message.id)
      )
    )
    .limit(1)

  if (existing[0]) {
    // Update existing message
    await ctx.db
      .update(gmailMessages)
      .set({
        labelIds,
        isUnread: labelIds.includes('UNREAD'),
        isStarred: labelIds.includes('STARRED'),
        isImportant: labelIds.includes('IMPORTANT'),
        isInbox: labelIds.includes('INBOX'),
        isTrash: labelIds.includes('TRASH'),
        isSpam: labelIds.includes('SPAM'),
        lastSeenAt: new Date(),
        syncedAt: new Date(),
        sourceHash,
        raw,
      })
      .where(eq(gmailMessages.id, existing[0].id))
    return
  }

  // Create new message
  const [newMessage] = await ctx.db
    .insert(gmailMessages)
    .values({
      integrationAccountId: ctx.integrationAccountId,
      gmailAccountId: ctx.gmailAccountId,
      threadId: thread[0].id,
      externalId: message.id,
      externalThreadId: message.threadId,
      historyId: message.historyId || null,
      subject: headers['subject'] || null,
      fromEmail: fromParsed.email,
      fromName: fromParsed.name,
      toEmails,
      ccEmails,
      bccEmails,
      replyTo: headers['reply-to'] || null,
      messageIdHeader: headers['message-id'] || null,
      inReplyTo: headers['in-reply-to'] || null,
      references: headers['references'] || null,
      snippet: message.snippet || null,
      bodyPlain: body.plain,
      bodyHtml: body.html,
      internalDate: message.internalDate ? new Date(parseInt(message.internalDate)) : null,
      sentAt: headers['date'] ? new Date(headers['date']) : null,
      labelIds,
      isUnread: labelIds.includes('UNREAD'),
      isStarred: labelIds.includes('STARRED'),
      isImportant: labelIds.includes('IMPORTANT'),
      isDraft: labelIds.includes('DRAFT'),
      isSent: labelIds.includes('SENT'),
      isInbox: labelIds.includes('INBOX'),
      isTrash: labelIds.includes('TRASH'),
      isSpam: labelIds.includes('SPAM'),
      sizeEstimate: message.sizeEstimate || null,
      raw,
      sourceHash,
    })
    .returning({ id: gmailMessages.id })

  // Sync attachments
  if (newMessage) {
    await syncAttachmentsForMessage(ctx, newMessage.id, message)
  }
}
