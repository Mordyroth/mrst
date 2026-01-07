/**
 * Monday.com API Types
 */

export interface MondayWorkspace {
  id: string
  name: string
  kind: 'open' | 'closed'
  description?: string
  created_at?: string
  state?: 'active' | 'archived' | 'deleted'
}

export interface MondayBoard {
  id: string
  name: string
  description?: string
  board_kind: 'public' | 'private' | 'share'
  state: 'active' | 'archived' | 'deleted' | 'all'
  workspace_id?: string
  item_terminology?: string
  items_count?: number
  permissions?: string
  created_at?: string
  updated_at?: string
}

export interface MondayColumn {
  id: string
  title: string
  type: string
  description?: string
  settings_str?: string
  width?: number
}

export interface MondayGroup {
  id: string
  title: string
  color?: string
  position?: number
  archived?: boolean
  deleted?: boolean
}

export interface MondayColumnValue {
  id: string
  type: string
  value?: string // JSON string
  text?: string // Display text
}

export interface MondayItem {
  id: string
  name: string
  state?: 'active' | 'archived' | 'deleted'
  created_at?: string
  updated_at?: string
  creator_id?: string
  board?: { id: string }
  group?: { id: string }
  column_values?: MondayColumnValue[]
  updates?: MondayUpdate[]
}

export interface MondayUser {
  id: string
  name: string
  email?: string
  phone?: string
  title?: string
  birthday?: string
  country_code?: string
  location?: string
  time_zone_identifier?: string
  is_admin?: boolean
  is_guest?: boolean
  is_view_only?: boolean
  photo_original?: string
  created_at?: string
}

export interface MondayAsset {
  id: string
  name: string
  url?: string
  public_url?: string
  url_thumbnail?: string
  file_extension?: string
  file_size?: number
  created_at?: string
  original_geometry?: string
  uploaded_by?: {
    id: string
    name: string
  }
}

export interface MondayReply {
  id: string
  body?: string
  text_body?: string
  created_at?: string
  creator_id?: string
  creator?: MondayUser
}

export interface MondayUpdate {
  id: string
  body?: string
  text_body?: string
  created_at?: string
  updated_at?: string
  creator_id?: string
  creator?: MondayUser
  item_id?: string
  replies?: MondayReply[]
  assets?: MondayAsset[]
}

export interface MondayActivityLog {
  id: string
  event: string
  data?: string // JSON string
  user_id?: string
  account_id?: string
  created_at?: string // Unix timestamp (17 digits)
  entity?: 'board' | 'pulse'
}

export interface MondayItemsPage {
  cursor?: string
  items: MondayItem[]
}

export interface MondayBoardWithSchema extends MondayBoard {
  columns?: MondayColumn[]
  groups?: MondayGroup[]
  items_page?: MondayItemsPage
}

// API Response types
export interface GetWorkspacesResponse {
  workspaces: MondayWorkspace[]
}

export interface GetBoardsResponse {
  boards: MondayBoard[]
}

export interface GetBoardSchemaResponse {
  boards: MondayBoardWithSchema[]
}

export interface GetBoardItemsResponse {
  boards: Array<{
    id: string
    items_page: MondayItemsPage
  }>
}

export interface GetItemResponse {
  items: MondayItem[]
}

export interface GetItemUpdatesResponse {
  items: Array<{
    id: string
    updates: MondayUpdate[]
  }>
}

export interface GetUpdatesResponse {
  updates: MondayUpdate[]
}

export interface GetBoardActivityResponse {
  boards: Array<{
    id: string
    activity_logs: MondayActivityLog[]
  }>
}

export interface GetUsersResponse {
  users: MondayUser[]
}

export interface GetAssetsResponse {
  assets: MondayAsset[]
}

export interface GetAccountResponse {
  me: {
    id: string
    name: string
    email: string
    account: {
      id: string
      name: string
      plan?: {
        period?: string
        tier?: string
      }
    }
  }
}
