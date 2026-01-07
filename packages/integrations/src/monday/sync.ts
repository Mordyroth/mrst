/**
 * Monday.com Sync Service
 * Handles syncing all Monday.com data to local database
 */

import { eq, and, sql } from 'drizzle-orm'
import { hashData, sleep } from '@mrst/shared'
import {
  mondayWorkspaces,
  mondayBoards,
  mondayColumns,
  mondayGroups,
  mondayItems,
  mondayItemColumnValues,
  mondayItemColumnValueVersions,
  mondayUpdates,
  mondayReplies,
  mondayActivityLogs,
  mondayFiles,
  mondayUsers,
  type Database,
} from '@mrst/db'
import { MondayClient } from './client'
import * as queries from './queries'
import type {
  MondayWorkspace,
  MondayBoard,
  MondayColumn,
  MondayGroup,
  MondayItem,
  MondayColumnValue,
  MondayUpdate,
  MondayReply,
  MondayUser,
  MondayAsset,
  MondayActivityLog,
  GetWorkspacesResponse,
  GetBoardsResponse,
  GetBoardSchemaResponse,
  GetBoardItemsResponse,
  GetItemUpdatesResponse,
  GetBoardActivityResponse,
  GetUsersResponse,
  GetAccountResponse,
} from './types'

export interface SyncContext {
  db: Database
  client: MondayClient
  integrationAccountId: string
  tenantId: string
  onProgress?: (message: string, counts?: SyncCounts) => void
}

export interface SyncCounts {
  processed: number
  created: number
  updated: number
  unchanged: number
  errored: number
}

export interface SyncResult {
  success: boolean
  counts: SyncCounts
  error?: string
}

/**
 * Creates a new sync counts object
 */
function createCounts(): SyncCounts {
  return { processed: 0, created: 0, updated: 0, unchanged: 0, errored: 0 }
}

/**
 * Sync all workspaces from Monday.com
 */
export async function syncWorkspaces(ctx: SyncContext): Promise<SyncResult> {
  const counts = createCounts()
  const now = new Date()

  try {
    ctx.onProgress?.('Fetching workspaces...')

    let page = 1
    const limit = 50
    let hasMore = true

    while (hasMore) {
      const response = await ctx.client.queryWithRetry<GetWorkspacesResponse>(
        queries.GET_WORKSPACES,
        { limit, page }
      )

      const workspaces = response.workspaces
      if (workspaces.length === 0) {
        hasMore = false
        continue
      }

      for (const workspace of workspaces) {
        counts.processed++

        try {
          const sourceHash = hashData(workspace)

          // Check if exists
          const existing = await ctx.db
            .select({ id: mondayWorkspaces.id, sourceHash: mondayWorkspaces.sourceHash })
            .from(mondayWorkspaces)
            .where(
              and(
                eq(mondayWorkspaces.integrationAccountId, ctx.integrationAccountId),
                eq(mondayWorkspaces.externalId, workspace.id)
              )
            )
            .limit(1)

          if (existing.length > 0) {
            const row = existing[0]
            if (row.sourceHash === sourceHash) {
              // No change, just update last_seen_at
              await ctx.db
                .update(mondayWorkspaces)
                .set({ lastSeenAt: now, syncedAt: now })
                .where(eq(mondayWorkspaces.id, row.id))
              counts.unchanged++
            } else {
              // Update
              await ctx.db
                .update(mondayWorkspaces)
                .set({
                  name: workspace.name,
                  kind: workspace.kind,
                  description: workspace.description || null,
                  raw: workspace,
                  sourceHash,
                  lastSeenAt: now,
                  syncedAt: now,
                })
                .where(eq(mondayWorkspaces.id, row.id))
              counts.updated++
            }
          } else {
            // Insert
            await ctx.db.insert(mondayWorkspaces).values({
              integrationAccountId: ctx.integrationAccountId,
              externalId: workspace.id,
              name: workspace.name,
              kind: workspace.kind,
              description: workspace.description || null,
              raw: workspace,
              sourceHash,
              firstSeenAt: now,
              lastSeenAt: now,
              syncedAt: now,
            })
            counts.created++
          }
        } catch (err) {
          console.error(`Error syncing workspace ${workspace.id}:`, err)
          counts.errored++
        }
      }

      page++
      if (workspaces.length < limit) hasMore = false
      await sleep(100)
    }

    ctx.onProgress?.(`Synced ${counts.processed} workspaces`, counts)
    return { success: true, counts }
  } catch (error) {
    return { success: false, counts, error: (error as Error).message }
  }
}

/**
 * Sync all boards from Monday.com
 * Optionally filter by specific board IDs
 */
export async function syncBoards(
  ctx: SyncContext,
  options: { boardIds?: string[]; markInScope?: boolean } = {}
): Promise<SyncResult> {
  const counts = createCounts()
  const now = new Date()

  try {
    ctx.onProgress?.('Fetching boards...')

    // Get workspace mapping for linking
    const workspaceMap = new Map<string, string>()
    const workspaces = await ctx.db
      .select({ id: mondayWorkspaces.id, externalId: mondayWorkspaces.externalId })
      .from(mondayWorkspaces)
      .where(eq(mondayWorkspaces.integrationAccountId, ctx.integrationAccountId))

    for (const row of workspaces) {
      workspaceMap.set(row.externalId, row.id)
    }

    let page = 1
    const limit = 50
    let hasMore = true

    while (hasMore) {
      const variables: Record<string, unknown> = { limit, page }
      if (options.boardIds && options.boardIds.length > 0) {
        variables.ids = options.boardIds
      }

      const response = await ctx.client.queryWithRetry<GetBoardsResponse>(
        queries.GET_BOARDS,
        variables
      )

      const boards = response.boards
      if (boards.length === 0) {
        hasMore = false
        continue
      }

      for (const board of boards) {
        counts.processed++

        try {
          const sourceHash = hashData(board)
          const workspaceId = board.workspace_id ? workspaceMap.get(board.workspace_id) : null

          // Check if exists
          const existing = await ctx.db
            .select({
              id: mondayBoards.id,
              sourceHash: mondayBoards.sourceHash,
              inScope: mondayBoards.inScope,
            })
            .from(mondayBoards)
            .where(
              and(
                eq(mondayBoards.integrationAccountId, ctx.integrationAccountId),
                eq(mondayBoards.externalId, board.id)
              )
            )
            .limit(1)

          // Determine if in scope - default to true if markInScope option set
          const inScope = options.markInScope === true

          if (existing.length > 0) {
            const row = existing[0]
            if (row.sourceHash === sourceHash && row.inScope === inScope) {
              // No change
              await ctx.db
                .update(mondayBoards)
                .set({ lastSeenAt: now, syncedAt: now })
                .where(eq(mondayBoards.id, row.id))
              counts.unchanged++
            } else {
              // Update
              await ctx.db
                .update(mondayBoards)
                .set({
                  workspaceId: workspaceId || null,
                  externalWorkspaceId: board.workspace_id || null,
                  name: board.name,
                  description: board.description || null,
                  boardKind: board.board_kind,
                  state: board.state,
                  itemsCount: board.items_count || 0,
                  inScope,
                  raw: board,
                  sourceHash,
                  lastSeenAt: now,
                  syncedAt: now,
                })
                .where(eq(mondayBoards.id, row.id))
              counts.updated++
            }
          } else {
            // Insert
            await ctx.db.insert(mondayBoards).values({
              integrationAccountId: ctx.integrationAccountId,
              workspaceId: workspaceId || null,
              externalId: board.id,
              externalWorkspaceId: board.workspace_id || null,
              name: board.name,
              description: board.description || null,
              boardKind: board.board_kind,
              state: board.state,
              itemsCount: board.items_count || 0,
              inScope,
              raw: board,
              sourceHash,
              firstSeenAt: now,
              lastSeenAt: now,
              syncedAt: now,
            })
            counts.created++
          }
        } catch (err) {
          console.error(`Error syncing board ${board.id}:`, err)
          counts.errored++
        }
      }

      page++
      if (boards.length < limit || options.boardIds) hasMore = false
      await sleep(100)
    }

    ctx.onProgress?.(`Synced ${counts.processed} boards`, counts)
    return { success: true, counts }
  } catch (error) {
    return { success: false, counts, error: (error as Error).message }
  }
}

/**
 * Sync board schema (columns and groups) for a specific board
 */
export async function syncBoardSchema(
  ctx: SyncContext,
  externalBoardId: string
): Promise<SyncResult> {
  const counts = createCounts()
  const now = new Date()

  try {
    ctx.onProgress?.(`Fetching schema for board ${externalBoardId}...`)

    // Get internal board ID
    const boardResult = await ctx.db
      .select({ id: mondayBoards.id })
      .from(mondayBoards)
      .where(
        and(
          eq(mondayBoards.integrationAccountId, ctx.integrationAccountId),
          eq(mondayBoards.externalId, externalBoardId)
        )
      )
      .limit(1)

    if (boardResult.length === 0) {
      return { success: false, counts, error: `Board ${externalBoardId} not found in database` }
    }

    const boardId = boardResult[0].id

    const response = await ctx.client.queryWithRetry<GetBoardSchemaResponse>(
      queries.GET_BOARD_SCHEMA,
      { boardId: externalBoardId }
    )

    if (!response.boards || response.boards.length === 0) {
      return { success: false, counts, error: `Board ${externalBoardId} not found in Monday.com` }
    }

    const board = response.boards[0]

    // Sync columns
    if (board.columns) {
      for (let i = 0; i < board.columns.length; i++) {
        const column = board.columns[i]
        counts.processed++

        try {
          const sourceHash = hashData(column)

          const existing = await ctx.db
            .select({ id: mondayColumns.id, sourceHash: mondayColumns.sourceHash })
            .from(mondayColumns)
            .where(
              and(
                eq(mondayColumns.boardId, boardId),
                eq(mondayColumns.externalId, column.id)
              )
            )
            .limit(1)

          let settings = null
          if (column.settings_str) {
            try {
              settings = JSON.parse(column.settings_str)
            } catch {
              settings = column.settings_str
            }
          }

          if (existing.length > 0) {
            const row = existing[0]
            if (row.sourceHash === sourceHash) {
              await ctx.db
                .update(mondayColumns)
                .set({ lastSeenAt: now, syncedAt: now })
                .where(eq(mondayColumns.id, row.id))
              counts.unchanged++
            } else {
              await ctx.db
                .update(mondayColumns)
                .set({
                  title: column.title,
                  type: column.type,
                  description: column.description || null,
                  settings,
                  width: column.width || null,
                  position: i,
                  raw: column,
                  sourceHash,
                  lastSeenAt: now,
                  syncedAt: now,
                })
                .where(eq(mondayColumns.id, row.id))
              counts.updated++
            }
          } else {
            await ctx.db.insert(mondayColumns).values({
              integrationAccountId: ctx.integrationAccountId,
              boardId,
              externalId: column.id,
              externalBoardId,
              title: column.title,
              type: column.type,
              description: column.description || null,
              settings,
              width: column.width || null,
              position: i,
              raw: column,
              sourceHash,
              firstSeenAt: now,
              lastSeenAt: now,
              syncedAt: now,
            })
            counts.created++
          }
        } catch (err) {
          console.error(`Error syncing column ${column.id}:`, err)
          counts.errored++
        }
      }
    }

    // Sync groups
    if (board.groups) {
      for (const group of board.groups) {
        counts.processed++

        try {
          const sourceHash = hashData(group)

          const existing = await ctx.db
            .select({ id: mondayGroups.id, sourceHash: mondayGroups.sourceHash })
            .from(mondayGroups)
            .where(
              and(
                eq(mondayGroups.boardId, boardId),
                eq(mondayGroups.externalId, group.id)
              )
            )
            .limit(1)

          // Parse position as integer (Monday API returns floats like "8128.0")
          const position = group.position != null ? Math.floor(group.position) : null

          if (existing.length > 0) {
            const row = existing[0]
            if (row.sourceHash === sourceHash) {
              await ctx.db
                .update(mondayGroups)
                .set({ lastSeenAt: now, syncedAt: now })
                .where(eq(mondayGroups.id, row.id))
              counts.unchanged++
            } else {
              await ctx.db
                .update(mondayGroups)
                .set({
                  title: group.title,
                  color: group.color || null,
                  position,
                  isArchived: group.archived || false,
                  isDeleted: group.deleted || false,
                  raw: group,
                  sourceHash,
                  lastSeenAt: now,
                  syncedAt: now,
                })
                .where(eq(mondayGroups.id, row.id))
              counts.updated++
            }
          } else {
            await ctx.db.insert(mondayGroups).values({
              integrationAccountId: ctx.integrationAccountId,
              boardId,
              externalId: group.id,
              externalBoardId,
              title: group.title,
              color: group.color || null,
              position,
              isArchived: group.archived || false,
              isDeleted: group.deleted || false,
              raw: group,
              sourceHash,
              firstSeenAt: now,
              lastSeenAt: now,
              syncedAt: now,
            })
            counts.created++
          }
        } catch (err) {
          console.error(`Error syncing group ${group.id}:`, err)
          counts.errored++
        }
      }
    }

    ctx.onProgress?.(`Synced schema for board ${externalBoardId}`, counts)
    return { success: true, counts }
  } catch (error) {
    return { success: false, counts, error: (error as Error).message }
  }
}

/**
 * Sync items for a specific board
 */
export async function syncBoardItems(
  ctx: SyncContext,
  externalBoardId: string,
  options: { trackValueChanges?: boolean } = {}
): Promise<SyncResult> {
  const counts = createCounts()
  const now = new Date()

  try {
    ctx.onProgress?.(`Fetching items for board ${externalBoardId}...`)

    // Get internal board ID
    const boardResult = await ctx.db
      .select({ id: mondayBoards.id })
      .from(mondayBoards)
      .where(
        and(
          eq(mondayBoards.integrationAccountId, ctx.integrationAccountId),
          eq(mondayBoards.externalId, externalBoardId)
        )
      )
      .limit(1)

    if (boardResult.length === 0) {
      return { success: false, counts, error: `Board ${externalBoardId} not found in database` }
    }

    const boardId = boardResult[0].id

    // Get group mapping
    const groupMap = new Map<string, string>()
    const groups = await ctx.db
      .select({ id: mondayGroups.id, externalId: mondayGroups.externalId })
      .from(mondayGroups)
      .where(eq(mondayGroups.boardId, boardId))

    for (const row of groups) {
      groupMap.set(row.externalId, row.id)
    }

    // Get column mapping
    const columnMap = new Map<string, string>()
    const columns = await ctx.db
      .select({ id: mondayColumns.id, externalId: mondayColumns.externalId })
      .from(mondayColumns)
      .where(eq(mondayColumns.boardId, boardId))

    for (const row of columns) {
      columnMap.set(row.externalId, row.id)
    }

    // Paginate through items using cursor
    let cursor: string | null = null
    const limit = 100

    do {
      const response = await ctx.client.queryWithRetry<GetBoardItemsResponse>(
        queries.GET_BOARD_ITEMS,
        { boardId: externalBoardId, limit, cursor }
      )

      if (!response.boards || response.boards.length === 0) break

      const itemsPage = response.boards[0].items_page
      const items = itemsPage.items
      cursor = itemsPage.cursor || null

      for (const item of items) {
        counts.processed++

        try {
          const sourceHash = hashData(item)
          const groupId = item.group?.id ? groupMap.get(item.group.id) : null

          // Check if item exists
          const existing = await ctx.db
            .select({ id: mondayItems.id, sourceHash: mondayItems.sourceHash })
            .from(mondayItems)
            .where(
              and(
                eq(mondayItems.integrationAccountId, ctx.integrationAccountId),
                eq(mondayItems.externalId, item.id)
              )
            )
            .limit(1)

          let itemId: string

          if (existing.length > 0) {
            const row = existing[0]
            itemId = row.id

            if (row.sourceHash === sourceHash) {
              await ctx.db
                .update(mondayItems)
                .set({ lastSeenAt: now, syncedAt: now })
                .where(eq(mondayItems.id, row.id))
              counts.unchanged++
            } else {
              await ctx.db
                .update(mondayItems)
                .set({
                  groupId: groupId || null,
                  externalGroupId: item.group?.id || null,
                  name: item.name,
                  state: item.state || null,
                  createdAtExternal: item.created_at ? new Date(item.created_at) : null,
                  updatedAtExternal: item.updated_at ? new Date(item.updated_at) : null,
                  creatorId: item.creator_id || null,
                  raw: item,
                  sourceHash,
                  lastSeenAt: now,
                  syncedAt: now,
                })
                .where(eq(mondayItems.id, row.id))
              counts.updated++
            }
          } else {
            const insertResult = await ctx.db
              .insert(mondayItems)
              .values({
                integrationAccountId: ctx.integrationAccountId,
                boardId,
                groupId: groupId || null,
                externalId: item.id,
                externalBoardId,
                externalGroupId: item.group?.id || null,
                name: item.name,
                state: item.state || null,
                createdAtExternal: item.created_at ? new Date(item.created_at) : null,
                updatedAtExternal: item.updated_at ? new Date(item.updated_at) : null,
                creatorId: item.creator_id || null,
                raw: item,
                sourceHash,
                firstSeenAt: now,
                lastSeenAt: now,
                syncedAt: now,
              })
              .returning({ id: mondayItems.id })
            itemId = insertResult[0].id
            counts.created++
          }

          // Sync column values
          if (item.column_values) {
            await syncColumnValues(ctx, itemId, item.id, columnMap, item.column_values, {
              trackChanges: options.trackValueChanges,
            })
          }
        } catch (err) {
          console.error(`Error syncing item ${item.id}:`, err)
          counts.errored++
        }
      }

      if (cursor) await sleep(100)
    } while (cursor)

    ctx.onProgress?.(`Synced items for board ${externalBoardId}`, counts)
    return { success: true, counts }
  } catch (error) {
    return { success: false, counts, error: (error as Error).message }
  }
}

/**
 * Sync column values for an item
 */
async function syncColumnValues(
  ctx: SyncContext,
  itemId: string,
  externalItemId: string,
  columnMap: Map<string, string>,
  columnValues: MondayColumnValue[],
  options: { trackChanges?: boolean } = {}
): Promise<void> {
  const now = new Date()

  for (const cv of columnValues) {
    const columnId = columnMap.get(cv.id)
    if (!columnId) continue // Column not found, skip

    const valueHash = hashData({ value: cv.value, text: cv.text })

    // Parse value JSON for extraction
    let valueJson: unknown = null
    let textValue = cv.text || null
    let dateValue: Date | null = null
    let numberValue: number | null = null

    if (cv.value) {
      try {
        valueJson = JSON.parse(cv.value)
        // Extract date if present
        if (valueJson && typeof valueJson === 'object' && 'date' in valueJson) {
          dateValue = new Date((valueJson as { date: string }).date)
        }
        // Extract number if present
        if (typeof valueJson === 'number') {
          numberValue = valueJson
        }
      } catch {
        // Value is not JSON
        valueJson = cv.value
      }
    }

    try {
      const existing = await ctx.db
        .select({ id: mondayItemColumnValues.id, valueHash: mondayItemColumnValues.valueHash })
        .from(mondayItemColumnValues)
        .where(
          and(
            eq(mondayItemColumnValues.itemId, itemId),
            eq(mondayItemColumnValues.columnId, columnId)
          )
        )
        .limit(1)

      if (existing.length > 0) {
        const row = existing[0]
        const oldValueHash = row.valueHash

        if (oldValueHash === valueHash) {
          // No change
          await ctx.db
            .update(mondayItemColumnValues)
            .set({ lastSeenAt: now, syncedAt: now })
            .where(eq(mondayItemColumnValues.id, row.id))
        } else {
          // Value changed - create version record if tracking
          if (options.trackChanges) {
            // Get old value before updating
            const oldValue = await ctx.db
              .select({
                valueJson: mondayItemColumnValues.valueJson,
                textValue: mondayItemColumnValues.textValue,
              })
              .from(mondayItemColumnValues)
              .where(eq(mondayItemColumnValues.id, row.id))
              .limit(1)

            if (oldValue.length > 0) {
              await ctx.db.insert(mondayItemColumnValueVersions).values({
                integrationAccountId: ctx.integrationAccountId,
                itemId,
                columnId,
                externalItemId,
                externalColumnId: cv.id,
                valueJson: oldValue[0].valueJson,
                textValue: oldValue[0].textValue,
                valueHash: oldValueHash,
                changedAt: now,
                detectedBy: 'diff_snapshot',
              })
            }
          }

          // Update current value
          await ctx.db
            .update(mondayItemColumnValues)
            .set({
              valueJson,
              textValue,
              dateValue,
              numberValue,
              valueHash,
              lastSeenAt: now,
              syncedAt: now,
            })
            .where(eq(mondayItemColumnValues.id, row.id))
        }
      } else {
        // Insert new value
        await ctx.db.insert(mondayItemColumnValues).values({
          integrationAccountId: ctx.integrationAccountId,
          itemId,
          columnId,
          externalItemId,
          externalColumnId: cv.id,
          valueJson,
          textValue,
          dateValue,
          numberValue,
          valueHash,
          firstSeenAt: now,
          lastSeenAt: now,
          syncedAt: now,
        })
      }
    } catch (err) {
      console.error(`Error syncing column value ${cv.id} for item ${externalItemId}:`, err)
    }
  }
}

/**
 * Sync updates (comments) for an item
 */
export async function syncItemUpdates(
  ctx: SyncContext,
  externalItemId: string
): Promise<SyncResult> {
  const counts = createCounts()
  const now = new Date()

  try {
    // Get internal item ID
    const itemResult = await ctx.db
      .select({ id: mondayItems.id })
      .from(mondayItems)
      .where(
        and(
          eq(mondayItems.integrationAccountId, ctx.integrationAccountId),
          eq(mondayItems.externalId, externalItemId)
        )
      )
      .limit(1)

    if (itemResult.length === 0) {
      return { success: false, counts, error: `Item ${externalItemId} not found in database` }
    }

    const itemId = itemResult[0].id

    let page = 1
    const limit = 50
    let hasMore = true

    while (hasMore) {
      const response = await ctx.client.queryWithRetry<GetItemUpdatesResponse>(
        queries.GET_ITEM_UPDATES,
        { itemId: externalItemId, limit, page }
      )

      if (!response.items || response.items.length === 0) break

      const updates = response.items[0].updates
      if (!updates || updates.length === 0) {
        hasMore = false
        continue
      }

      for (const update of updates) {
        counts.processed++

        try {
          const sourceHash = hashData(update)

          const existing = await ctx.db
            .select({ id: mondayUpdates.id, sourceHash: mondayUpdates.sourceHash })
            .from(mondayUpdates)
            .where(
              and(
                eq(mondayUpdates.integrationAccountId, ctx.integrationAccountId),
                eq(mondayUpdates.externalId, update.id)
              )
            )
            .limit(1)

          let updateId: string

          if (existing.length > 0) {
            const row = existing[0]
            updateId = row.id

            if (row.sourceHash === sourceHash) {
              await ctx.db
                .update(mondayUpdates)
                .set({ lastSeenAt: now, syncedAt: now })
                .where(eq(mondayUpdates.id, row.id))
              counts.unchanged++
            } else {
              await ctx.db
                .update(mondayUpdates)
                .set({
                  body: update.body || null,
                  textBody: update.text_body || null,
                  creatorId: update.creator_id || null,
                  creatorName: update.creator?.name || null,
                  createdAtExternal: update.created_at ? new Date(update.created_at) : null,
                  updatedAtExternal: update.updated_at ? new Date(update.updated_at) : null,
                  raw: update,
                  sourceHash,
                  lastSeenAt: now,
                  syncedAt: now,
                })
                .where(eq(mondayUpdates.id, row.id))
              counts.updated++
            }
          } else {
            const insertResult = await ctx.db
              .insert(mondayUpdates)
              .values({
                integrationAccountId: ctx.integrationAccountId,
                itemId,
                externalId: update.id,
                externalItemId,
                body: update.body || null,
                textBody: update.text_body || null,
                creatorId: update.creator_id || null,
                creatorName: update.creator?.name || null,
                createdAtExternal: update.created_at ? new Date(update.created_at) : null,
                updatedAtExternal: update.updated_at ? new Date(update.updated_at) : null,
                raw: update,
                sourceHash,
                firstSeenAt: now,
                lastSeenAt: now,
                syncedAt: now,
              })
              .returning({ id: mondayUpdates.id })
            updateId = insertResult[0].id
            counts.created++
          }

          // Sync replies
          if (update.replies && update.replies.length > 0) {
            await syncUpdateReplies(ctx, updateId, update.id, update.replies)
          }

          // Sync assets
          if (update.assets && update.assets.length > 0) {
            await syncUpdateAssets(ctx, itemId, externalItemId, updateId, update.id, update.assets)
          }
        } catch (err) {
          console.error(`Error syncing update ${update.id}:`, err)
          counts.errored++
        }
      }

      page++
      if (updates.length < limit) hasMore = false
      await sleep(100)
    }

    return { success: true, counts }
  } catch (error) {
    return { success: false, counts, error: (error as Error).message }
  }
}

/**
 * Sync replies for an update
 */
async function syncUpdateReplies(
  ctx: SyncContext,
  updateId: string,
  externalUpdateId: string,
  replies: MondayReply[]
): Promise<void> {
  const now = new Date()

  for (const reply of replies) {
    const sourceHash = hashData(reply)

    try {
      const existing = await ctx.db
        .select({ id: mondayReplies.id, sourceHash: mondayReplies.sourceHash })
        .from(mondayReplies)
        .where(
          and(
            eq(mondayReplies.integrationAccountId, ctx.integrationAccountId),
            eq(mondayReplies.externalId, reply.id)
          )
        )
        .limit(1)

      if (existing.length > 0) {
        const row = existing[0]
        if (row.sourceHash !== sourceHash) {
          await ctx.db
            .update(mondayReplies)
            .set({
              body: reply.body || null,
              textBody: reply.text_body || null,
              creatorId: reply.creator_id || null,
              creatorName: reply.creator?.name || null,
              createdAtExternal: reply.created_at ? new Date(reply.created_at) : null,
              raw: reply,
              sourceHash,
              lastSeenAt: now,
              syncedAt: now,
            })
            .where(eq(mondayReplies.id, row.id))
        } else {
          await ctx.db
            .update(mondayReplies)
            .set({ lastSeenAt: now, syncedAt: now })
            .where(eq(mondayReplies.id, row.id))
        }
      } else {
        await ctx.db.insert(mondayReplies).values({
          integrationAccountId: ctx.integrationAccountId,
          updateId,
          externalId: reply.id,
          externalUpdateId,
          body: reply.body || null,
          textBody: reply.text_body || null,
          creatorId: reply.creator_id || null,
          creatorName: reply.creator?.name || null,
          createdAtExternal: reply.created_at ? new Date(reply.created_at) : null,
          raw: reply,
          sourceHash,
          firstSeenAt: now,
          lastSeenAt: now,
          syncedAt: now,
        })
      }
    } catch (err) {
      console.error(`Error syncing reply ${reply.id}:`, err)
    }
  }
}

/**
 * Sync assets/files from an update
 */
async function syncUpdateAssets(
  ctx: SyncContext,
  itemId: string,
  externalItemId: string,
  updateId: string,
  externalUpdateId: string,
  assets: MondayAsset[]
): Promise<void> {
  const now = new Date()

  for (const asset of assets) {
    const sourceHash = hashData(asset)

    try {
      const existing = await ctx.db
        .select({ id: mondayFiles.id, sourceHash: mondayFiles.sourceHash })
        .from(mondayFiles)
        .where(
          and(
            eq(mondayFiles.integrationAccountId, ctx.integrationAccountId),
            eq(mondayFiles.externalId, asset.id)
          )
        )
        .limit(1)

      const isImage = asset.file_extension
        ? ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(asset.file_extension.toLowerCase())
        : false

      if (existing.length > 0) {
        const row = existing[0]
        if (row.sourceHash !== sourceHash) {
          await ctx.db
            .update(mondayFiles)
            .set({
              name: asset.name,
              url: asset.public_url || asset.url || '',
              fileExtension: asset.file_extension || null,
              fileSize: asset.file_size || null,
              isImage,
              raw: asset,
              sourceHash,
              lastSeenAt: now,
              syncedAt: now,
            })
            .where(eq(mondayFiles.id, row.id))
        } else {
          await ctx.db
            .update(mondayFiles)
            .set({ lastSeenAt: now, syncedAt: now })
            .where(eq(mondayFiles.id, row.id))
        }
      } else {
        await ctx.db.insert(mondayFiles).values({
          integrationAccountId: ctx.integrationAccountId,
          itemId,
          updateId,
          externalId: asset.id,
          externalItemId,
          externalUpdateId,
          name: asset.name,
          url: asset.public_url || asset.url || '',
          fileExtension: asset.file_extension || null,
          fileSize: asset.file_size || null,
          isImage,
          raw: asset,
          sourceHash,
          firstSeenAt: now,
          lastSeenAt: now,
          syncedAt: now,
        })
      }
    } catch (err) {
      console.error(`Error syncing asset ${asset.id}:`, err)
    }
  }
}

/**
 * Sync activity logs for a board
 */
export async function syncBoardActivity(
  ctx: SyncContext,
  externalBoardId: string,
  options: { from?: Date; to?: Date } = {}
): Promise<SyncResult> {
  const counts = createCounts()
  const now = new Date()

  try {
    ctx.onProgress?.(`Fetching activity for board ${externalBoardId}...`)

    // Get internal board ID
    const boardResult = await ctx.db
      .select({ id: mondayBoards.id })
      .from(mondayBoards)
      .where(
        and(
          eq(mondayBoards.integrationAccountId, ctx.integrationAccountId),
          eq(mondayBoards.externalId, externalBoardId)
        )
      )
      .limit(1)

    if (boardResult.length === 0) {
      return { success: false, counts, error: `Board ${externalBoardId} not found in database` }
    }

    const boardId = boardResult[0].id

    // Get item mapping for activity log linking
    const itemMap = new Map<string, string>()
    const items = await ctx.db
      .select({ id: mondayItems.id, externalId: mondayItems.externalId })
      .from(mondayItems)
      .where(eq(mondayItems.boardId, boardId))

    for (const row of items) {
      itemMap.set(row.externalId, row.id)
    }

    let page = 1
    const limit = 100
    let hasMore = true

    while (hasMore) {
      const variables: Record<string, unknown> = {
        boardId: externalBoardId,
        limit,
        page,
      }

      if (options.from) {
        variables.from = options.from.toISOString()
      }
      if (options.to) {
        variables.to = options.to.toISOString()
      }

      const response = await ctx.client.queryWithRetry<GetBoardActivityResponse>(
        queries.GET_BOARD_ACTIVITY,
        variables
      )

      if (!response.boards || response.boards.length === 0) break

      const activities = response.boards[0].activity_logs
      if (!activities || activities.length === 0) {
        hasMore = false
        continue
      }

      for (const activity of activities) {
        counts.processed++

        try {
          // Parse activity data to extract item ID
          let activityData: Record<string, unknown> | null = null
          let externalItemId: string | null = null

          if (activity.data) {
            try {
              activityData = JSON.parse(activity.data)
              externalItemId = (activityData?.pulse_id as string) || null
            } catch {
              // Data is not JSON
            }
          }

          const itemId = externalItemId ? itemMap.get(externalItemId) : null

          // Monday activity log created_at is Unix timestamp (17 digits = microseconds)
          let createdAtExternal: Date | null = null
          if (activity.created_at) {
            // Convert from microseconds to milliseconds
            const timestamp = parseInt(activity.created_at, 10) / 1000
            createdAtExternal = new Date(timestamp)
          }

          const existing = await ctx.db
            .select({ id: mondayActivityLogs.id })
            .from(mondayActivityLogs)
            .where(
              and(
                eq(mondayActivityLogs.integrationAccountId, ctx.integrationAccountId),
                eq(mondayActivityLogs.externalId, activity.id)
              )
            )
            .limit(1)

          if (existing.length > 0) {
            // Activity logs are immutable, just update sync time
            await ctx.db
              .update(mondayActivityLogs)
              .set({ syncedAt: now })
              .where(eq(mondayActivityLogs.id, existing[0].id))
            counts.unchanged++
          } else {
            await ctx.db.insert(mondayActivityLogs).values({
              integrationAccountId: ctx.integrationAccountId,
              boardId,
              itemId: itemId || null,
              externalId: activity.id,
              externalBoardId,
              externalItemId,
              event: activity.event,
              data: activityData,
              userId: activity.user_id || null,
              createdAtExternal,
              raw: activity,
              firstSeenAt: now,
              syncedAt: now,
            })
            counts.created++
          }
        } catch (err) {
          console.error(`Error syncing activity ${activity.id}:`, err)
          counts.errored++
        }
      }

      page++
      if (activities.length < limit) hasMore = false
      await sleep(100)
    }

    ctx.onProgress?.(`Synced activity for board ${externalBoardId}`, counts)
    return { success: true, counts }
  } catch (error) {
    return { success: false, counts, error: (error as Error).message }
  }
}

/**
 * Sync all Monday.com users
 */
export async function syncUsers(ctx: SyncContext): Promise<SyncResult> {
  const counts = createCounts()
  const now = new Date()

  try {
    ctx.onProgress?.('Fetching users...')

    let page = 1
    const limit = 50
    let hasMore = true

    while (hasMore) {
      const response = await ctx.client.queryWithRetry<GetUsersResponse>(
        queries.GET_USERS,
        { limit, page }
      )

      const users = response.users
      if (users.length === 0) {
        hasMore = false
        continue
      }

      for (const user of users) {
        counts.processed++

        try {
          const sourceHash = hashData(user)

          const existing = await ctx.db
            .select({ id: mondayUsers.id, sourceHash: mondayUsers.sourceHash })
            .from(mondayUsers)
            .where(
              and(
                eq(mondayUsers.integrationAccountId, ctx.integrationAccountId),
                eq(mondayUsers.externalId, user.id)
              )
            )
            .limit(1)

          if (existing.length > 0) {
            const row = existing[0]
            if (row.sourceHash === sourceHash) {
              await ctx.db
                .update(mondayUsers)
                .set({ lastSeenAt: now, syncedAt: now })
                .where(eq(mondayUsers.id, row.id))
              counts.unchanged++
            } else {
              await ctx.db
                .update(mondayUsers)
                .set({
                  name: user.name,
                  email: user.email || null,
                  phone: user.phone || null,
                  title: user.title || null,
                  birthday: user.birthday || null,
                  countryCode: user.country_code || null,
                  location: user.location || null,
                  timeZoneIdentifier: user.time_zone_identifier || null,
                  isAdmin: user.is_admin || false,
                  isGuest: user.is_guest || false,
                  isViewOnly: user.is_view_only || false,
                  photoUrl: user.photo_original || null,
                  raw: user,
                  sourceHash,
                  lastSeenAt: now,
                  syncedAt: now,
                })
                .where(eq(mondayUsers.id, row.id))
              counts.updated++
            }
          } else {
            await ctx.db.insert(mondayUsers).values({
              integrationAccountId: ctx.integrationAccountId,
              externalId: user.id,
              name: user.name,
              email: user.email || null,
              phone: user.phone || null,
              title: user.title || null,
              birthday: user.birthday || null,
              countryCode: user.country_code || null,
              location: user.location || null,
              timeZoneIdentifier: user.time_zone_identifier || null,
              isAdmin: user.is_admin || false,
              isGuest: user.is_guest || false,
              isViewOnly: user.is_view_only || false,
              photoUrl: user.photo_original || null,
              raw: user,
              sourceHash,
              firstSeenAt: now,
              lastSeenAt: now,
              syncedAt: now,
            })
            counts.created++
          }
        } catch (err) {
          console.error(`Error syncing user ${user.id}:`, err)
          counts.errored++
        }
      }

      page++
      if (users.length < limit) hasMore = false
      await sleep(100)
    }

    ctx.onProgress?.(`Synced ${counts.processed} users`, counts)
    return { success: true, counts }
  } catch (error) {
    return { success: false, counts, error: (error as Error).message }
  }
}

/**
 * Get account info (for verification)
 */
export async function getAccountInfo(ctx: SyncContext): Promise<{ id: string; name: string; email: string } | null> {
  try {
    const response = await ctx.client.queryWithRetry<GetAccountResponse>(queries.GET_ACCOUNT, {})
    return {
      id: response.me.id,
      name: response.me.name,
      email: response.me.email,
    }
  } catch (error) {
    console.error('Error getting account info:', error)
    return null
  }
}

/**
 * Full sync for a board - schema, items, updates, and activity
 */
export async function syncFullBoard(
  ctx: SyncContext,
  externalBoardId: string,
  options: {
    syncActivity?: boolean
    activityFrom?: Date
    trackValueChanges?: boolean
  } = {}
): Promise<{ schema: SyncResult; items: SyncResult; activity?: SyncResult }> {
  // First sync schema
  ctx.onProgress?.(`Syncing schema for board ${externalBoardId}...`)
  const schemaResult = await syncBoardSchema(ctx, externalBoardId)

  if (!schemaResult.success) {
    return { schema: schemaResult, items: { success: false, counts: createCounts() } }
  }

  // Then sync items
  ctx.onProgress?.(`Syncing items for board ${externalBoardId}...`)
  const itemsResult = await syncBoardItems(ctx, externalBoardId, {
    trackValueChanges: options.trackValueChanges,
  })

  const result: { schema: SyncResult; items: SyncResult; activity?: SyncResult } = {
    schema: schemaResult,
    items: itemsResult,
  }

  // Optionally sync activity
  if (options.syncActivity) {
    ctx.onProgress?.(`Syncing activity for board ${externalBoardId}...`)
    result.activity = await syncBoardActivity(ctx, externalBoardId, {
      from: options.activityFrom,
    })
  }

  return result
}
