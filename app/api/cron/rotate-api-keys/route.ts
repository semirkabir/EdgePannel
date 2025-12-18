import { NextRequest, NextResponse } from 'next/server'
import { getKeysNeedingReminders, getExpiredKeys, deactivateExpiredKeys, markReminderSent } from '@/lib/api-key/rotation'
import { logger } from '@/lib/utils/logger'
import { auditLog } from '@/lib/audit/audit-logger'

/**
 * Cron job endpoint for API key rotation management
 * Should be called periodically (e.g., daily) to:
 * 1. Send rotation reminders
 * 2. Deactivate expired keys
 * 3. Log rotation events
 * 
 * Protect this endpoint with a secret token in production
 */
export async function GET(request: NextRequest) {
  // In production, verify cron secret token
  const cronSecret = request.headers.get('x-cron-secret')
  if (process.env.NODE_ENV === 'production' && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = {
      remindersSent: 0,
      keysExpired: 0,
      keysDeactivated: 0,
    }

    // 1. Get keys needing rotation reminders
    const keysNeedingReminders = await getKeysNeedingReminders()
    logger.info(`Found ${keysNeedingReminders.length} keys needing rotation reminders`)

    for (const key of keysNeedingReminders) {
      // In a real implementation, send email notification here
      // For now, just mark as sent and log
      await markReminderSent(key.id)
      
      // Audit log
      await auditLog({
        userId: key.userId,
        action: 'API_KEY_ROTATED',
        resource: 'api_key',
        resourceId: key.id,
        details: {
          platform: key.platform,
          daysUntilRotation: key.daysUntilRotation,
          reminderSent: true,
        },
      })

      results.remindersSent++
      logger.info(`Rotation reminder sent for ${key.platform} key (${key.id.substring(0, 8)}...)`)
    }

    // 2. Get expired keys
    const expiredKeys = await getExpiredKeys()
    logger.info(`Found ${expiredKeys.length} expired keys`)

    for (const key of expiredKeys) {
      await auditLog({
        userId: key.userId,
        action: 'API_KEY_EXPIRED',
        resource: 'api_key',
        resourceId: key.id,
        details: {
          platform: key.platform,
          expiresAt: key.expiresAt.toISOString(),
        },
      })
      results.keysExpired++
    }

    // 3. Deactivate expired keys
    const deactivatedCount = await deactivateExpiredKeys()
    results.keysDeactivated = deactivatedCount

    return NextResponse.json({
      success: true,
      message: 'API key rotation check completed',
      data: results,
    })
  } catch (error) {
    logger.error('Error in API key rotation cron job', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

