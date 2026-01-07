/**
 * Authentication middleware
 */

import { eq, gt } from 'drizzle-orm'
import type { Database } from '@mrst/db'
import { sessions, users, type UserRole } from '@mrst/db/schema'

export interface AuthUser {
  id: string
  tenantId: string
  email: string
  name: string
  role: UserRole
}

export interface AuthSession {
  id: string
  token: string
}

/**
 * Extract and validate session token from request
 */
export async function authenticateRequest(
  request: Request,
  db: Database
): Promise<{ user?: AuthUser; session?: AuthSession }> {
  // Get token from Authorization header
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return {}
  }

  const token = authHeader.slice(7)
  if (!token) {
    return {}
  }

  // Find valid session
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.token, token),
  })

  if (!session) {
    return {}
  }

  // Check expiration
  if (session.expiresAt < new Date()) {
    // Clean up expired session
    await db.delete(sessions).where(eq(sessions.id, session.id))
    return {}
  }

  // Get user
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  })

  if (!user || !user.isActive) {
    return {}
  }

  return {
    user: {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
    },
    session: {
      id: session.id,
      token: session.token,
    },
  }
}

/**
 * Check if user has required role
 */
export function hasRole(user: AuthUser, requiredRoles: UserRole[]): boolean {
  // Role hierarchy: owner > admin > manager > staff > driver > readonly
  const roleHierarchy: Record<UserRole, number> = {
    owner: 100,
    admin: 80,
    manager: 60,
    staff: 40,
    driver: 30,
    readonly: 10,
  }

  const userLevel = roleHierarchy[user.role]
  const minRequired = Math.min(...requiredRoles.map(r => roleHierarchy[r]))

  return userLevel >= minRequired
}
