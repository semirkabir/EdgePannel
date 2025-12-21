export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { PolymarketClient } from '@/lib/api/polymarket'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userAddress = searchParams.get('address')

    if (!userAddress) {
      return NextResponse.json(
        { error: 'User address is required' },
        { status: 400 }
      )
    }

    const market = searchParams.get('market') || undefined

    const polymarket = new PolymarketClient()
    const value = await polymarket.getPortfolioValue(userAddress, market)

    return NextResponse.json({ value, address: userAddress })
  } catch (error: any) {
    console.error('[API] Error fetching Polymarket portfolio value:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch portfolio value' },
      { status: 500 }
    )
  }
}
