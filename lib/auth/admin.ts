import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AUTH_ENABLED } from '@/lib/auth-config'

// Admin email - set this to your email address
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || ''

/**
 * Check if the current user is an admin
 * Returns the user's email if they are an admin, null otherwise
 */
export async function getAdminEmail(): Promise<string | null> {
  if (!ADMIN_EMAIL) {
    console.error('[Admin] ADMIN_EMAIL environment variable is not set')
    return null
  }

  if (!AUTH_ENABLED) {
    // In development mode without auth, still require email to be set
    console.warn('[Admin] Access check skipped (AUTH_ENABLED=false)')
    return null
  }

  const session = await getServerSession(authOptions)
  
  if (!session?.user?.email) {
    return null
  }

  // Check if user email matches admin email (case-insensitive)
  if (session.user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return session.user.email
  }

  return null
}

/**
 * Check if the current user is an admin
 * Throws an error if not authorized
 */
export async function requireAdmin(): Promise<string> {
  const adminEmail = await getAdminEmail()
  
  if (!adminEmail) {
    throw new Error('Unauthorized: Admin access required')
  }

  return adminEmail
}
