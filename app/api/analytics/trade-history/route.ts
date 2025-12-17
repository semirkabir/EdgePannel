import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const platform = searchParams.get('platform') || 'combined'
    const limit = parseInt(searchParams.get('limit') || '1000')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Build query
    const whereClause: any = {
      userId
    }

    // Filter by platform
    if (platform !== 'combined') {
      whereClause.platform = platform
    }

    // Filter by date range
    if (startDate || endDate) {
      whereClause.executedAt = {}
      if (startDate) {
        whereClause.executedAt.gte = new Date(startDate)
      }
      if (endDate) {
        whereClause.executedAt.lte = new Date(endDate)
      }
    }

    const trades = await prisma.trade.findMany({
      where: whereClause,
      orderBy: {
        executedAt: 'desc'
      },
      take: limit
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
  } catch (error: any) {
    console.error('[Trade History] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
