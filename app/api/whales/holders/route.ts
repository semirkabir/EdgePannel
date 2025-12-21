export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { PolymarketClient } from '@/lib/api/polymarket'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const conditionId = searchParams.get('market')

    if (!conditionId) {
      return NextResponse.json(
        { error: 'Market condition ID is required' },
        { status: 400 }
      )
    }

    const limit = parseInt(searchParams.get('limit') || '100')

    const polymarket = new PolymarketClient()
    const holders = await polymarket.getHolders(conditionId, limit)

    // Calculate total holdings
    const totalHoldings = holders.reduce((sum, h) => sum + h.amount, 0)

    // Add percentage to each holder
    const holdersWithPercentage = holders.map(h => ({
      ...h,
      percentage: totalHoldings > 0 ? (h.amount / totalHoldings) * 100 : 0
    }))

    return NextResponse.json({
      holders: holdersWithPercentage,
      totalHolders: holders.length,
      totalHoldings,
      market: conditionId
    })
  } catch (error: any) {
    console.error('[API] Error fetching whale holders:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch holders' },
      { status: 500 }
    )
  }
}
