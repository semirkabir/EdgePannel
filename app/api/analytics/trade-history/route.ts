import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/db/client'
import { withAuth, withErrorHandler, validateQuery } from '@/lib/api/middleware'
import { z } from 'zod'

const TradeHistoryQuerySchema = z.object({
  platform: z.enum(['kalshi', 'polymarket', 'combined']).default('combined'),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(1000)).default('1000'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export const GET = withErrorHandler(
  withAuth(async (userId: string, request: NextRequest) => {
    const searchParams = request.nextUrl.searchParams
    const params = validateQuery(TradeHistoryQuerySchema, searchParams)

    // Build query
    const whereClause: {
      userId: string
      platform?: string
      executedAt?: { gte?: Date; lte?: Date }
    } = {
      userId
    }

    // Filter by platform
    if (params.platform !== 'combined') {
      whereClause.platform = params.platform
    }

    // Filter by date range
    if (params.startDate || params.endDate) {
      whereClause.executedAt = {}
      if (params.startDate) {
        whereClause.executedAt.gte = new Date(params.startDate)
      }
      if (params.endDate) {
        whereClause.executedAt.lte = new Date(params.endDate)
      }
    }

    const trades = await prisma.trade.findMany({
      where: whereClause,
      orderBy: {
        executedAt: 'desc'
      },
      take: params.limit
    })

    // Format trades for response
    const formattedTrades = trades.map(trade => ({
      id: trade.id,
      userId: trade.userId,
      platform: trade.platform,
      marketId: trade.marketId,
      marketTitle: trade.marketTitle,
      orderId: trade.orderId,
      side: trade.side,
      action: trade.side, // Use side as action
      quantity: trade.quantity,
      price: trade.price,
      value: trade.totalAmount,
      fees: 0, // Not stored in Trade model
      isTaker: true, // Default
      executedAt: trade.executedAt?.toISOString() || trade.createdAt.toISOString(),
      tradeData: {}
    }))

    // Calculate aggregate statistics
    const stats = {
      totalTrades: formattedTrades.length,
      totalVolume: formattedTrades.reduce((sum, t) => sum + t.value, 0),
      totalFees: formattedTrades.reduce((sum, t) => sum + t.fees, 0),
      avgTradeSize: formattedTrades.length > 0
        ? formattedTrades.reduce((sum, t) => sum + t.value, 0) / formattedTrades.length
        : 0,
      buyTrades: formattedTrades.filter(t => t.action === 'buy' || t.action === 'open').length,
      sellTrades: formattedTrades.filter(t => t.action === 'sell' || t.action === 'close').length,
      platforms: {
        kalshi: formattedTrades.filter(t => t.platform === 'kalshi').length,
        polymarket: formattedTrades.filter(t => t.platform === 'polymarket').length
      }
    }

    return NextResponse.json({
      trades: formattedTrades,
      stats,
      hasData: formattedTrades.length > 0
    })
  })
)
