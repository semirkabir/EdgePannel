import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

/**
 * Daily Cleanup of Expired Markets
 *
 * Marks markets as inactive when they've passed their end date.
 * This keeps the database lean and the map focused on active markets.
 *
 * Runs once daily at 3:00 AM UTC
 *
 * Process:
 * 1. Find all markets where endDate < now
 * 2. Delete them
 * 3. Return count of deleted markets
 */
export async function GET(request: Request) {
  const startTime = Date.now()

  try {
    // Always verify authorization (Vercel Cron Secret)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET

    if (!cronSecret) {
      console.error('[CleanupExpired] CRON_SECRET or VERCEL_CRON_SECRET environment variable not set')
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('[CleanupExpired] Unauthorized: Invalid or missing authorization header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[CleanupExpired] Starting cleanup of expired markets...')

    const now = new Date()

    // Find count of markets to be deleted
    const count = await prisma.geotaggedMarket.count({
      where: {
        endDate: {
          lt: now
        }
      }
    })

    console.log(`[CleanupExpired] Found ${count} expired markets to delete`)

    if (count === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired markets to clean up',
        deleted: 0,
        duration: Date.now() - startTime
      })
    }

    // Capture some examples before deletion
    const examples = await prisma.geotaggedMarket.findMany({
      where: {
        endDate: {
          lt: now
        }
      },
      take: 5,
      select: {
        title: true,
        endDate: true,
        platform: true
      }
    })

    // Delete expired markets
    const result = await prisma.geotaggedMarket.deleteMany({
      where: {
        endDate: {
          lt: now
        }
      }
    })

    console.log(`[CleanupExpired] Complete: ${result.count} markets deleted`)

    // Get statistics
    const stats = await prisma.geotaggedMarket.groupBy({
      by: ['platform'],
      _count: true
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      deleted: result.count,
      examples,
      statistics: stats,
      duration: Date.now() - startTime
    })
  } catch (error: any) {
    console.error('[CleanupExpired] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to cleanup expired markets',
        details: error.message,
        duration: Date.now() - startTime
      },
      { status: 500 }
    )
  }
}
