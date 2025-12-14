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
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined
    const sortBy = searchParams.get('sortBy') || undefined
    const sortDirection = (searchParams.get('sortDirection') as 'asc' | 'desc') || undefined

    const polymarket = new PolymarketClient()

    const positions = await polymarket.getPositions(userAddress, {
      market,
      limit,
      sortBy,
      sortDirection,
    })

    return NextResponse.json({ positions })
  } catch (error: any) {
    console.error('[API] Error fetching Polymarket positions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch positions' },
      { status: 500 }
    )
  }
}
