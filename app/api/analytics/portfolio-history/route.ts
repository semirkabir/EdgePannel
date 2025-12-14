import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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

    // Query portfolio snapshots
    const query = supabase
      .from('portfolio_snapshots')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })

    if (platform !== 'combined') {
      query.eq('platform', platform)
    }

    const { data: snapshots, error } = await query

    if (error) {
      console.error('[Portfolio History] Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch portfolio history', details: error.message },
        { status: 500 }
      )
    }

    // If no data exists, return empty array (frontend will show mock data)
    if (!snapshots || snapshots.length === 0) {
      return NextResponse.json({
        snapshots: [],
        hasData: false,
        message: 'No portfolio history found. Start tracking your portfolio to see data here.'
      })
    }

    // Format snapshots for the chart
    const formattedSnapshots = snapshots.map(snapshot => ({
      timestamp: snapshot.created_at,
      totalValue: parseFloat(snapshot.total_value),
      totalPnl: parseFloat(snapshot.total_pnl),
      positionCount: snapshot.position_count,
      exposure: snapshot.total_exposure ? parseFloat(snapshot.total_exposure) : 0,
      platform: snapshot.platform
    }))

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
