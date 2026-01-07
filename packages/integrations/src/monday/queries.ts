/**
 * Monday.com GraphQL Queries
 */

// Add complexity query to all requests for rate limit tracking
const COMPLEXITY_FRAGMENT = `
  complexity {
    before
    after
    query
    reset_in_x_seconds
  }
`

/**
 * Get all workspaces
 */
export const GET_WORKSPACES = `
  query GetWorkspaces($limit: Int, $page: Int) {
    workspaces(limit: $limit, page: $page) {
      id
      name
      kind
      description
      created_at
      state
    }
    ${COMPLEXITY_FRAGMENT}
  }
`

/**
 * Get boards with pagination
 */
export const GET_BOARDS = `
  query GetBoards($limit: Int, $page: Int, $ids: [ID!]) {
    boards(limit: $limit, page: $page, ids: $ids) {
      id
      name
      description
      board_kind
      state
      workspace_id
      item_terminology
      items_count
      permissions
      updated_at
    }
    ${COMPLEXITY_FRAGMENT}
  }
`

/**
 * Get board with columns and groups
 */
export const GET_BOARD_SCHEMA = `
  query GetBoardSchema($boardId: ID!) {
    boards(ids: [$boardId]) {
      id
      name
      columns {
        id
        title
        type
        description
        settings_str
        width
      }
      groups {
        id
        title
        color
        position
        archived
        deleted
      }
    }
    ${COMPLEXITY_FRAGMENT}
  }
`

/**
 * Get items from a board with column values
 * Uses items_page for efficient pagination
 */
export const GET_BOARD_ITEMS = `
  query GetBoardItems($boardId: ID!, $limit: Int!, $cursor: String) {
    boards(ids: [$boardId]) {
      id
      items_page(limit: $limit, cursor: $cursor) {
        cursor
        items {
          id
          name
          state
          created_at
          updated_at
          creator_id
          group {
            id
          }
          column_values {
            id
            type
            value
            text
          }
        }
      }
    }
    ${COMPLEXITY_FRAGMENT}
  }
`

/**
 * Get item by ID with full details
 */
export const GET_ITEM = `
  query GetItem($itemId: ID!) {
    items(ids: [$itemId]) {
      id
      name
      state
      created_at
      updated_at
      creator_id
      board {
        id
      }
      group {
        id
      }
      column_values {
        id
        type
        value
        text
      }
      updates {
        id
        body
        text_body
        created_at
        updated_at
        creator_id
        creator {
          id
          name
          email
        }
        replies {
          id
          body
          text_body
          created_at
          creator_id
          creator {
            id
            name
            email
          }
        }
        assets {
          id
          name
          url
          public_url
          file_extension
          file_size
        }
      }
    }
    ${COMPLEXITY_FRAGMENT}
  }
`

/**
 * Get updates for an item
 */
export const GET_ITEM_UPDATES = `
  query GetItemUpdates($itemId: ID!, $limit: Int, $page: Int) {
    items(ids: [$itemId]) {
      id
      updates(limit: $limit, page: $page) {
        id
        body
        text_body
        created_at
        updated_at
        creator_id
        creator {
          id
          name
          email
        }
        replies {
          id
          body
          text_body
          created_at
          creator_id
          creator {
            id
            name
            email
          }
        }
        assets {
          id
          name
          url
          public_url
          file_extension
          file_size
        }
      }
    }
    ${COMPLEXITY_FRAGMENT}
  }
`

/**
 * Get all updates with pagination (across all boards)
 */
export const GET_UPDATES = `
  query GetUpdates($limit: Int, $page: Int) {
    updates(limit: $limit, page: $page) {
      id
      body
      text_body
      created_at
      updated_at
      creator_id
      creator {
        id
        name
        email
      }
      item_id
      replies {
        id
        body
        text_body
        created_at
        creator_id
        creator {
          id
          name
          email
        }
      }
      assets {
        id
        name
        url
        public_url
        file_extension
        file_size
      }
    }
    ${COMPLEXITY_FRAGMENT}
  }
`

/**
 * Get activity logs for a board
 */
export const GET_BOARD_ACTIVITY = `
  query GetBoardActivity($boardId: ID!, $from: ISO8601DateTime, $to: ISO8601DateTime, $limit: Int, $page: Int) {
    boards(ids: [$boardId]) {
      id
      activity_logs(from: $from, to: $to, limit: $limit, page: $page) {
        id
        event
        data
        user_id
        account_id
        created_at
        entity
      }
    }
    ${COMPLEXITY_FRAGMENT}
  }
`

/**
 * Get users
 */
export const GET_USERS = `
  query GetUsers($limit: Int, $page: Int) {
    users(limit: $limit, page: $page) {
      id
      name
      email
      phone
      title
      birthday
      country_code
      location
      time_zone_identifier
      is_admin
      is_guest
      is_view_only
      photo_original
      created_at
    }
    ${COMPLEXITY_FRAGMENT}
  }
`

/**
 * Get assets by IDs
 */
export const GET_ASSETS = `
  query GetAssets($ids: [ID!]!) {
    assets(ids: $ids) {
      id
      name
      url
      public_url
      url_thumbnail
      file_extension
      file_size
      created_at
      original_geometry
      uploaded_by {
        id
        name
      }
    }
    ${COMPLEXITY_FRAGMENT}
  }
`

/**
 * Get current account info
 */
export const GET_ACCOUNT = `
  query GetAccount {
    me {
      id
      name
      email
      account {
        id
        name
        plan {
          period
          tier
        }
      }
    }
    ${COMPLEXITY_FRAGMENT}
  }
`
