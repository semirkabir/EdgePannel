import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const platform = searchParams.get('platform') || 'combined'
    const timeRange = searchParams.get('timeRange') || '30d'

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Calculate date range
    const now = new Date()
    const ranges: Record<string, number> = {
      '24h': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
      'all': 365 * 10 // 10 years
    }

    const daysBack = ranges[timeRange] || 30
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)

    // Query trades from Prisma
    const whereClause: any = {
      userId,
      createdAt: {
        gte: startDate
      }
    }

    if (platform !== 'combined') {
      whereClause.platform = platform
    }

    const trades = await prisma.trade.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'asc'
      }
    })

    // If no data exists, return empty array (frontend will show mock data)
    if (!trades || trades.length === 0) {
      return NextResponse.json({
        snapshots: [],
        hasData: false,
        message: 'No portfolio history found. Start tracking your portfolio to see data here.'
      })
    }

    // Calculate portfolio snapshots from trades
    // Group by date and calculate totals
    const snapshotsByDate = new Map<string, {
      timestamp: string
      totalValue: number
      totalPnl: number
      positionCount: number
      exposure: number
      platform: string
    }>()

    trades.forEach(trade => {
      const date = trade.createdAt.toISOString().split('T')[0]
      const existing = snapshotsByDate.get(date) || {
        timestamp: date,
        totalValue: 0,
        totalPnl: 0,
        positionCount: 0,
        exposure: 0,
        platform: platform === 'combined' ? 'combined' : trade.platform
      }

      existing.totalValue += trade.totalAmount
      existing.totalPnl += (trade.side === 'buy' ? trade.totalAmount : -trade.totalAmount)
      existing.positionCount += 1
      existing.exposure += trade.totalAmount

      snapshotsByDate.set(date, existing)
    })

    const formattedSnapshots = Array.from(snapshotsByDate.values()).sort((a, b) => 
      a.timestamp.localeCompare(b.timestamp)
    )

    if (formattedSnapshots.length === 0) {
      return NextResponse.json({
        snapshots: [],
        hasData: false,
        message: 'No portfolio history found. Start tracking your portfolio to see data here.'
      })
    }

    // Calculate aggregated stats
    const latestSnapshot = formattedSnapshots[formattedSnapshots.length - 1]
    const oldestSnapshot = formattedSnapshots[0]

    const changeAmount = latestSnapshot.totalValue - oldestSnapshot.totalValue
    const changePercent = oldestSnapshot.totalValue > 0
      ? (changeAmount / oldestSnapshot.totalValue) * 100
      : 0

    const maxValue = Math.max(...formattedSnapshots.map(s => s.totalValue))
    const minValue = Math.min(...formattedSnapshots.map(s => s.totalValue))
    const maxPnl = Math.max(...formattedSnapshots.map(s => s.totalPnl))
    const minPnl = Math.min(...formattedSnapshots.map(s => s.totalPnl))

    return NextResponse.json({
      snapshots: formattedSnapshots,
      hasData: true,
      stats: {
        currentValue: latestSnapshot.totalValue,
        currentPnl: latestSnapshot.totalPnl,
        changeAmount,
        changePercent,
        maxValue,
        minValue,
        maxPnl,
        minPnl,
        snapshotCount: formattedSnapshots.length,
        firstSnapshot: oldestSnapshot.timestamp,
        latestSnapshot: latestSnapshot.timestamp
      }
    })
  } catch (error: any) {
    console.error('[Portfolio History] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
