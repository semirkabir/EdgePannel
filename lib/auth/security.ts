/**
 * Authentication security utilities
 */

import bcrypt from 'bcryptjs'

/**
 * Bcrypt configuration
 * Using 12 rounds for better security (10 is minimum, 12-14 recommended)
 */
export const BCRYPT_ROUNDS = 12

/**
 * Hash a password securely
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Account lockout configuration
 */
export const ACCOUNT_LOCKOUT_CONFIG = {
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000, // 15 minutes
  RESET_WINDOW_MS: 60 * 60 * 1000, // 1 hour
} as const

/**
 * Track failed login attempts
 * In production, use Redis or database instead of in-memory
 */
const failedAttempts = new Map<string, {
  count: number
  lockedUntil: number | null
  lastAttempt: number
}>()

/**
 * Record a failed login attempt
 */
export function recordFailedAttempt(identifier: string): {
  isLocked: boolean
  remainingAttempts: number
  lockedUntil: number | null
} {
  const now = Date.now()
  const record = failedAttempts.get(identifier) || {
    count: 0,
    lockedUntil: null,
    lastAttempt: now,
  }

  // Reset count if outside reset window
  if (now - record.lastAttempt > ACCOUNT_LOCKOUT_CONFIG.RESET_WINDOW_MS) {
    record.count = 0
    record.lockedUntil = null
  }

  // Check if currently locked
  if (record.lockedUntil && now < record.lockedUntil) {
    return {
      isLocked: true,
      remainingAttempts: 0,
      lockedUntil: record.lockedUntil,
    }
  }

  // Increment failed attempts
  record.count++
  record.lastAttempt = now

  // Lock account if threshold reached
  if (record.count >= ACCOUNT_LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + ACCOUNT_LOCKOUT_CONFIG.LOCKOUT_DURATION_MS
  }

  failedAttempts.set(identifier, record)

  return {
    isLocked: record.lockedUntil !== null && now < record.lockedUntil,
    remainingAttempts: Math.max(0, ACCOUNT_LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS - record.count),
    lockedUntil: record.lockedUntil,
  }
}

/**
 * Clear failed attempts on successful login
 */
export function clearFailedAttempts(identifier: string): void {
  failedAttempts.delete(identifier)
}

/**
 * Check if account is locked
 */
export function isAccountLocked(identifier: string): boolean {
  const record = failedAttempts.get(identifier)
  if (!record || !record.lockedUntil) {
    return false
  }

  const now = Date.now()
  if (now >= record.lockedUntil) {
    // Lockout expired, clear it
    failedAttempts.delete(identifier)
    return false
  }

  return true
}

/**
 * Get lockout status
 */
export function getLockoutStatus(identifier: string): {
  isLocked: boolean
  remainingAttempts: number
  lockedUntil: number | null
} {
  const record = failedAttempts.get(identifier)
  if (!record) {
    return {
      isLocked: false,
      remainingAttempts: ACCOUNT_LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS,
      lockedUntil: null,
    }
  }

  const now = Date.now()
  if (record.lockedUntil && now < record.lockedUntil) {
    return {
      isLocked: true,
      remainingAttempts: 0,
      lockedUntil: record.lockedUntil,
    }
  }

  return {
    isLocked: false,
    remainingAttempts: Math.max(0, ACCOUNT_LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS - record.count),
    lockedUntil: record.lockedUntil,
  }
}

