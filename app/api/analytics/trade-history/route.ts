import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Build query
    let query = supabase
      .from('trade_history')
      .select('*')
      .eq('user_id', userId)
      .order('executed_at', { ascending: false })
      .limit(limit)

    // Filter by platform
    if (platform !== 'combined') {
      query = query.eq('platform', platform)
    }

    // Filter by date range
    if (startDate) {
      query = query.gte('executed_at', startDate)
    }
    if (endDate) {
      query = query.lte('executed_at', endDate)
    }

    const { data: trades, error } = await query

    if (error) {
      console.error('[Trade History] Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch trade history', details: error.message },
        { status: 500 }
      )
    }

    // Format trades for response
    const formattedTrades = (trades || []).map(trade => ({
      id: trade.id,
      userId: trade.user_id,
      platform: trade.platform,
      marketId: trade.market_id,
      ticker: trade.ticker,
      orderId: trade.order_id,
      tradeId: trade.trade_id,
      side: trade.side,
      action: trade.action,
      quantity: parseFloat(trade.quantity),
      price: parseFloat(trade.price),
      value: parseFloat(trade.value),
      fees: parseFloat(trade.fees),
      isTaker: trade.is_taker,
      executedAt: trade.executed_at,
      tradeData: trade.trade_data
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
