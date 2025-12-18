/**
 * API Key Rotation Management
 * Handles key rotation, expiration, and reminders
 */

import { prisma } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger'
import { auditLog } from '@/lib/audit/audit-logger'
import crypto from 'crypto'

/**
 * Default rotation period: 90 days
 */
export const DEFAULT_ROTATION_PERIOD_DAYS = 90

/**
 * Reminder period: 7 days before expiration
 */
export const ROTATION_REMINDER_DAYS = 7

/**
 * Calculate next rotation date
 */
export function calculateNextRotationDate(rotationPeriodDays: number = DEFAULT_ROTATION_PERIOD_DAYS): Date {
  const date = new Date()
  date.setDate(date.getDate() + rotationPeriodDays)
  return date
}

/**
 * Calculate expiration date
 */
export function calculateExpirationDate(rotationPeriodDays: number = DEFAULT_ROTATION_PERIOD_DAYS): Date {
  return calculateNextRotationDate(rotationPeriodDays)
}

/**
 * Hash a key for comparison (to detect if key changed)
 */
export function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

/**
 * Check if API key needs rotation
 */
export async function checkKeyRotationStatus(apiKeyId: string): Promise<{
  needsRotation: boolean
  daysUntilRotation: number | null
  isExpired: boolean
  daysUntilExpiration: number | null
}> {
  const apiKey = await prisma.apiKey.findUnique({
    where: { id: apiKeyId },
    select: {
      id: true,
      expiresAt: true,
      nextRotationDate: true,
      isActive: true,
    },
  })

  if (!apiKey) {
    return {
      needsRotation: false,
      daysUntilRotation: null,
      isExpired: false,
      daysUntilExpiration: null,
    }
  }

  const now = new Date()
  const isExpired = apiKey.expiresAt ? apiKey.expiresAt < now : false
  const needsRotation = apiKey.nextRotationDate ? apiKey.nextRotationDate <= now : false

  const daysUntilRotation = apiKey.nextRotationDate
    ? Math.ceil((apiKey.nextRotationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null

  const daysUntilExpiration = apiKey.expiresAt
    ? Math.ceil((apiKey.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null

  return {
    needsRotation,
    daysUntilRotation,
    isExpired,
    daysUntilExpiration,
  }
}

/**
 * Rotate an API key
 * This marks the old key for rotation and sets up the new key
 */
export async function rotateApiKey(
  apiKeyId: string,
  newEncryptedKey: string,
  newEncryptedKeyData: string | null,
  userId: string,
  request?: Request
): Promise<void> {
  const apiKey = await prisma.apiKey.findUnique({
    where: { id: apiKeyId },
  })

  if (!apiKey) {
    throw new Error('API key not found')
  }

  if (apiKey.userId !== userId) {
    throw new Error('Unauthorized: Cannot rotate another user\'s API key')
  }

  // Store hash of old key for transition period
  const oldKeyHash = hashKey(apiKey.encryptedKey)

  // Update the key
  await prisma.apiKey.update({
    where: { id: apiKeyId },
    data: {
      encryptedKey: newEncryptedKey,
      encryptedKeyData: newEncryptedKeyData,
      previousKeyHash: oldKeyHash,
      rotationDate: new Date(),
      nextRotationDate: calculateNextRotationDate(),
      expiresAt: calculateExpirationDate(),
      rotationReminderSent: false,
      updatedAt: new Date(),
    },
  })

  logger.info('API key rotated', {
    apiKeyId: apiKeyId.substring(0, 8) + '...',
    userId: userId.substring(0, 8) + '...',
    platform: apiKey.platform,
  })

  // Audit log
  await auditLog({
    userId,
    action: 'API_KEY_ROTATED',
    resource: 'api_key',
    resourceId: apiKeyId,
    details: {
      platform: apiKey.platform,
    },
    ...(request && (await import('@/lib/audit/audit-logger')).extractRequestMetadata(request)),
  })
}

/**
 * Get keys that need rotation reminders
 */
export async function getKeysNeedingReminders(): Promise<Array<{
  id: string
  userId: string
  platform: string
  nextRotationDate: Date
  daysUntilRotation: number
}>> {
  const now = new Date()
  const reminderDate = new Date(now)
  reminderDate.setDate(reminderDate.getDate() + ROTATION_REMINDER_DAYS)

  const keys = await prisma.apiKey.findMany({
    where: {
      isActive: true,
      nextRotationDate: {
        lte: reminderDate,
        gte: now,
      },
      rotationReminderSent: false,
    },
    select: {
      id: true,
      userId: true,
      platform: true,
      nextRotationDate: true,
    },
  })

  return keys.map(key => ({
    id: key.id,
    userId: key.userId,
    platform: key.platform,
    nextRotationDate: key.nextRotationDate!,
    daysUntilRotation: Math.ceil((key.nextRotationDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  }))
}

/**
 * Get expired keys
 */
export async function getExpiredKeys(): Promise<Array<{
  id: string
  userId: string
  platform: string
  expiresAt: Date
}>> {
  const now = new Date()

  const keys = await prisma.apiKey.findMany({
    where: {
      isActive: true,
      expiresAt: {
        lt: now,
      },
    },
    select: {
      id: true,
      userId: true,
      platform: true,
      expiresAt: true,
    },
  })

  return keys.map(key => ({
    id: key.id,
    userId: key.userId,
    platform: key.platform,
    expiresAt: key.expiresAt!,
  }))
}

/**
 * Mark rotation reminder as sent
 */
export async function markReminderSent(apiKeyId: string): Promise<void> {
  await prisma.apiKey.update({
    where: { id: apiKeyId },
    data: { rotationReminderSent: true },
  })
}

/**
 * Deactivate expired keys
 */
export async function deactivateExpiredKeys(): Promise<number> {
  const now = new Date()

  const result = await prisma.apiKey.updateMany({
    where: {
      isActive: true,
      expiresAt: {
        lt: now,
      },
    },
    data: {
      isActive: false,
    },
  })

  if (result.count > 0) {
    logger.warn(`Deactivated ${result.count} expired API keys`)
  }

  return result.count
}

