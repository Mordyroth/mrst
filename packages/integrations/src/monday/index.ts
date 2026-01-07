/**
 * Monday.com integration
 * Implements GraphQL API with rate limiting (10M complexity/min)
 */

export * from './client'
export * from './types'
export * from './sync'
export {
  GET_WORKSPACES,
  GET_BOARDS,
  GET_BOARD_SCHEMA,
  GET_BOARD_ITEMS,
  GET_ITEM,
  GET_ITEM_UPDATES,
  GET_UPDATES,
  GET_BOARD_ACTIVITY,
  GET_USERS,
  GET_ASSETS,
  GET_ACCOUNT,
} from './queries'

export const MONDAY_CLIENT_VERSION = '1.0.0'
