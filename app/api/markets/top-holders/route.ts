import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Polymarket Top Holders API
 * Fetches top holders for markets from the Core API
 * See: https://docs.polymarket.com/api-reference/core/get-top-holders-for-markets
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const conditionId = searchParams.get('conditionId')
    const limit = searchParams.get('limit') || '10'

    if (!conditionId) {
      return NextResponse.json(
        { error: 'conditionId is required' },
        { status: 400 }
      )
    }

    console.log('[Top Holders API] Fetching top holders for conditionId:', conditionId)

    // Use Polymarket Data API to fetch top holders
    // Note: API expects 'market' parameter with condition ID
    const apiUrl = `https://data-api.polymarket.com/holders?market=${conditionId}&limit=${limit}`
    console.log('[Top Holders API] Fetching from:', apiUrl)

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('[Top Holders API] API error:', response.status, response.statusText)
      return NextResponse.json({
        holders: [],
        total: 0,
        error: `API returned ${response.status}: ${response.statusText}`
      })
    }

    const data = await response.json()
    console.log('[Top Holders API] Received tokens:', data.length || 0)

    // The API returns an array of tokens (one for each outcome)
    // Each token has: { token: string, holders: array }
    // We need to flatten and combine holders from both outcomes
    let allHolders: any[] = []

    if (Array.isArray(data)) {
      data.forEach((tokenData: any, outcomeIndex: number) => {
        if (tokenData.holders && Array.isArray(tokenData.holders)) {
          // Add outcome info to each holder
          const holdersWithOutcome = tokenData.holders.map((holder: any) => ({
            ...holder,
            outcome: holder.outcomeIndex !== undefined ? holder.outcomeIndex : outcomeIndex,
            token: tokenData.token
          }))
          allHolders = allHolders.concat(holdersWithOutcome)
        }
      })
    }

    // Sort by amount (highest first)
    allHolders.sort((a, b) => (b.amount || 0) - (a.amount || 0))

    console.log('[Top Holders API] Total flattened holders:', allHolders.length)

    return NextResponse.json({
      holders: allHolders,
      total: allHolders.length,
      conditionId
    })
  } catch (error) {
    console.error('[Top Holders API] Error:', error)
    return NextResponse.json(
      {
        holders: [],
        total: 0,
        error: 'Failed to fetch top holders',
        details: String(error)
      },
      { status: 500 }
    )
  }
}
