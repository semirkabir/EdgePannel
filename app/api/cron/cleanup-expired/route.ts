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
 * 1. Find all markets where endDate < now AND active = true
 * 2. Mark them as active = false
 * 3. Return count of deactivated markets
 */
export async function GET(request: Request) {
  const startTime = Date.now()

  try {
    // Verify authorization (Vercel Cron Secret)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[CleanupExpired] Unauthorized: Invalid or missing authorization header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[CleanupExpired] Starting cleanup of expired markets...')

    const now = new Date()

    // Find all active markets that have expired
    const expiredMarkets = await prisma.geotaggedMarket.findMany({
      where: {
        active: true,
        endDate: {
          lt: now
        }
      },
      select: {
        id: true,
        marketId: true,
        title: true,
        endDate: true,
        platform: true
      }
    })

    console.log(`[CleanupExpired] Found ${expiredMarkets.length} expired markets`)

    if (expiredMarkets.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired markets to clean up',
        deactivated: 0,
        duration: Date.now() - startTime
      })
    }

    // Mark them as inactive
    const result = await prisma.geotaggedMarket.updateMany({
      where: {
        active: true,
        endDate: {
          lt: now
        }
      },
      data: {
        active: false,
        updatedAt: now
      }
    })

    // Log some examples
    const examples = expiredMarkets.slice(0, 5).map(m => ({
      title: m.title.substring(0, 60),
      endDate: m.endDate,
      platform: m.platform
    }))

    console.log('[CleanupExpired] Deactivated markets examples:', examples)
    console.log(`[CleanupExpired] Complete: ${result.count} markets deactivated`)

    // Get statistics
    const stats = await prisma.geotaggedMarket.groupBy({
      by: ['platform', 'active'],
      _count: true
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      deactivated: result.count,
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
