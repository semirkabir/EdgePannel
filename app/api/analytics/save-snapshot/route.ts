import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface SnapshotData {
  userId: string
  platform: 'kalshi' | 'polymarket' | 'combined'
  totalValue: number
  totalPnl: number
  totalExposure?: number
  positionCount: number
  positions?: Array<{
    ticker?: string
    marketId: string
    marketTitle?: string
    size: number
    entryPrice?: number
    currentPrice?: number
    realizedPnl?: number
    unrealizedPnl?: number
  }>
}

export async function POST(request: NextRequest) {
  try {
    const body: SnapshotData = await request.json()

    const {
      userId,
      platform,
      totalValue,
      totalPnl,
      totalExposure = 0,
      positionCount,
      positions = []
    } = body

    // Validation
    if (!userId || !platform) {
      return NextResponse.json(
        { error: 'userId and platform are required' },
        { status: 400 }
      )
    }

    if (typeof totalValue !== 'number' || typeof totalPnl !== 'number') {
      return NextResponse.json(
        { error: 'totalValue and totalPnl must be numbers' },
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

    // Save portfolio snapshot
    const { data: snapshot, error: snapshotError } = await supabase
      .from('portfolio_snapshots')
      .insert({
        user_id: userId,
        platform,
        total_value: totalValue,
        total_pnl: totalPnl,
        total_exposure: totalExposure,
        position_count: positionCount,
        snapshot_data: {
          positions,
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (snapshotError) {
      console.error('[Save Snapshot] Error saving snapshot:', snapshotError)
      return NextResponse.json(
        { error: 'Failed to save snapshot', details: snapshotError.message },
        { status: 500 }
      )
    }

    // Optionally save individual positions to position_history
    if (positions.length > 0) {
      const positionRecords = positions.map(pos => ({
        user_id: userId,
        platform: platform === 'combined' ? 'kalshi' : platform, // Default to kalshi for combined
        market_id: pos.marketId,
        ticker: pos.ticker,
        market_title: pos.marketTitle,
        position_size: pos.size,
        entry_price: pos.entryPrice,
        current_price: pos.currentPrice,
        realized_pnl: pos.realizedPnl || 0,
        unrealized_pnl: pos.unrealizedPnl || 0,
        position_data: pos
      }))

      const { error: positionsError } = await supabase
        .from('position_history')
        .insert(positionRecords)

      if (positionsError) {
        console.error('[Save Snapshot] Error saving positions:', positionsError)
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      snapshot: {
        id: snapshot.id,
        createdAt: snapshot.created_at,
        platform: snapshot.platform,
        totalValue: snapshot.total_value,
        totalPnl: snapshot.total_pnl,
        positionCount: snapshot.position_count
      }
    })
  } catch (error: any) {
    console.error('[Save Snapshot] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// GET endpoint to check if snapshots exist for a user
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
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

    // Count snapshots for this user
    const { count, error } = await supabase
      .from('portfolio_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) {
      console.error('[Save Snapshot] Error checking snapshots:', error)
      return NextResponse.json(
        { error: 'Failed to check snapshots', details: error.message },
        { status: 500 }
      )
    }

    // Get latest snapshot
    const { data: latest } = await supabase
      .from('portfolio_snapshots')
      .select('created_at, platform, total_value, total_pnl')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      hasSnapshots: (count || 0) > 0,
      snapshotCount: count || 0,
      latestSnapshot: latest || null
    })
  } catch (error: any) {
    console.error('[Save Snapshot] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
