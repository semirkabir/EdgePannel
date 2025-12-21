export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { withAuth, withErrorHandler, validateBody, validateQuery } from '@/lib/api/middleware'
import { PortfolioSnapshotSchema } from '@/lib/api/schemas'
import { ErrorCodes } from '@/lib/api/error-codes'
import { logger } from '@/lib/utils/logger'
import { z } from 'zod'

const SnapshotCheckQuerySchema = z.object({
  userId: z.string().optional(), // Will be set by withAuth
})

export const POST = withErrorHandler(
  withAuth(async (userId: string, request: NextRequest) => {
    const body = await request.json()
    const snapshotData = validateBody(PortfolioSnapshotSchema, body)

    // Portfolio snapshots are calculated from trades, so we just return success
    // The portfolio history endpoint calculates snapshots from Trade records
    logger.info('Portfolio snapshot requested', { 
      userId: userId.substring(0, 8) + '...',
      platform: snapshotData.platform 
    })

    return NextResponse.json({
      success: true,
      message: 'Portfolio data is calculated from trades. No snapshot storage needed.',
      data: {
        snapshot: {
          userId,
          platform: snapshotData.platform,
          totalValue: snapshotData.totalValue,
          totalPnl: snapshotData.totalPnl,
          positionCount: snapshotData.positionCount,
          timestamp: new Date().toISOString()
        }
      }
    })
  })
)

// GET endpoint to check if snapshots exist for a user
export const GET = withErrorHandler(
  withAuth(async (userId: string, request: NextRequest) => {
    // Check if user has any trades (which are used to calculate portfolio)
    const tradeCount = await prisma.trade.count({
      where: { userId }
    })

    return NextResponse.json({
      success: true,
      data: {
        hasSnapshots: tradeCount > 0,
        snapshotCount: tradeCount,
        latestSnapshot: tradeCount > 0 ? {
          message: 'Portfolio calculated from trades',
          tradeCount
        } : null
      }
    })
  })
)
