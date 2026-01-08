/**
 * Sync messages for all Gmail threads
 * Run after thread sync to populate message bodies and attachments
 */

import { createDb, gmailAccounts, gmailThreads, gmailMessages } from '@mrst/db'
import { eq, and, isNull, desc, notExists, sql } from 'drizzle-orm'
import { createGmailClient, GmailRateLimiter, gmailRequest } from './client'
import type { GmailSyncContext, SyncResult } from './types'
import {
  extractHeaders,
  extractBody,
  extractAttachments,
  parseFromHeader,
  parseEmailAddresses,
  shouldKeepAttachment,
} from './types'
import { createHash } from 'crypto'
import {
  gmailAttachments,
} from '@mrst/db'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://mrst:mrst_dev_2025@localhost:5432/mrst'

function hashObject(obj: unknown): string {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex')
}

async function main() {
  console.log('=== Gmail Message Sync ===\n')

  const db = createDb(DATABASE_URL)
  const rateLimiter = new GmailRateLimiter()

  // Get Gmail account
  const accounts = await db
    .select({
      id: gmailAccounts.id,
      emailAddress: gmailAccounts.emailAddress,
      integrationAccountId: gmailAccounts.integrationAccountId,
    })
    .from(gmailAccounts)
    .limit(10)

  console.log(`Found ${accounts.length} Gmail account(s)\n`)

  for (const account of accounts) {
    console.log(`\nProcessing: ${account.emailAddress}`)

    try {
      const client = await createGmailClient({ userEmail: account.emailAddress })

      // Count threads needing message sync (threads without messages)
      const threadsNeedingSync = await db
        .select({ count: sql<number>`count(*)` })
        .from(gmailThreads)
        .leftJoin(gmailMessages, eq(gmailThreads.id, gmailMessages.threadId))
        .where(
          and(
            eq(gmailThreads.gmailAccountId, account.id),
            isNull(gmailThreads.deletedAt),
            isNull(gmailMessages.id)
          )
        )

      const totalToSync = Number(threadsNeedingSync[0]?.count || 0)
      console.log(`Threads needing message sync: ${totalToSync}`)

      if (totalToSync === 0) {
        console.log('All threads already have messages synced.')
        continue
      }

      let processed = 0
      let created = 0
      let skipped = 0
      const batchSize = 50

      while (processed < totalToSync) {
        // Get batch of threads without messages
        const threads = await db
          .select({
            id: gmailThreads.id,
            externalId: gmailThreads.externalId,
          })
          .from(gmailThreads)
          .leftJoin(gmailMessages, eq(gmailThreads.id, gmailMessages.threadId))
          .where(
            and(
              eq(gmailThreads.gmailAccountId, account.id),
              isNull(gmailThreads.deletedAt),
              isNull(gmailMessages.id)
            )
          )
          .orderBy(desc(gmailThreads.lastMessageAt))
          .limit(batchSize)

        if (threads.length === 0) break

        console.log(`  Processing batch ${Math.floor(processed / batchSize) + 1} (${processed}/${totalToSync})...`)

        for (const thread of threads) {
          try {
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
              const existing = await db
                .select({ id: gmailMessages.id })
                .from(gmailMessages)
                .where(
                  and(
                    eq(gmailMessages.gmailAccountId, account.id),
                    eq(gmailMessages.externalId, message.id)
                  )
                )
                .limit(1)

              if (existing[0]) {
                skipped++
                continue
              }

              // Insert message
              const [newMessage] = await db
                .insert(gmailMessages)
                .values({
                  integrationAccountId: account.integrationAccountId,
                  gmailAccountId: account.id,
                  threadId: thread.id,
                  externalId: message.id,
                  externalThreadId: thread.externalId,
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
              const attachments = extractAttachments(message.payload)
              for (const att of attachments) {
                if (!shouldKeepAttachment(att.filename, att.mimeType, att.size, att.contentId, att.isInline)) {
                  continue
                }

                await db.insert(gmailAttachments).values({
                  integrationAccountId: account.integrationAccountId,
                  gmailAccountId: account.id,
                  messageId: newMessage!.id,
                  externalId: att.attachmentId,
                  externalMessageId: message.id,
                  filename: att.filename,
                  mimeType: att.mimeType,
                  size: att.size,
                  contentId: att.contentId,
                  isInline: att.isInline,
                })
              }

              created++
            }
          } catch (err: any) {
            console.error(`    Error syncing thread ${thread.externalId}:`, err.message)
            skipped++
          }
        }

        processed += threads.length
      }

      console.log(`\nCompleted: ${created} messages created, ${skipped} skipped`)

    } catch (err: any) {
      console.error(`Error processing ${account.emailAddress}:`, err.message)
    }
  }

  console.log('\n\nMessage sync complete!')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
