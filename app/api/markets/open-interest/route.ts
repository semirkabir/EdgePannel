export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { buildCacheKey, cachedJson } from '@/lib/api/response-cache'

/**
 * Get Open Interest for Polymarket markets
 * Uses Polymarket Data API: https://data-api.polymarket.com/oi
 * 
 * @see https://docs.polymarket.com/api-reference/misc/get-open-interest
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const marketId = searchParams.get('marketId')
    const marketIds = searchParams.get('marketIds')?.split(',').filter(Boolean)

    if (!marketId && !marketIds) {
      return NextResponse.json(
        { error: 'marketId or marketIds query parameter is required' },
        { status: 400 }
      )
    }

    // Polymarket Data API endpoint
    const apiUrl = 'https://data-api.polymarket.com/oi'

    if (marketIds && marketIds.length > 0) {
      // Batch fetch for multiple markets
      // API accepts multiple market query parameters
      const params = new URLSearchParams()
      marketIds.forEach(id => {
        params.append('market', id.toLowerCase())
      })

      const url = `${apiUrl}?${params.toString()}`
      const cacheKey = buildCacheKey('polymarket:data:open-interest:batch', [marketIds.join(',')])
      let data: Array<{ market: string; value: number }>
      try {
        data = await cachedJson<Array<{ market: string; value: number }>>(
          cacheKey,
          url,
          undefined,
          { ttlMs: 15_000, allowStaleOnError: true }
        )
      } catch (error: any) {
        console.warn('[Open Interest] API error:', error?.status || 'unknown', error?.message || error)
        return NextResponse.json({
          success: true,
          openInterest: {},
          message: 'Open interest data temporarily unavailable',
        })
      }

      // Convert array to object keyed by market ID
      const result: Record<string, { yesOI: number; noOI: number; totalOI: number }> = {}
      for (const item of data) {
        const normalizedMarket = item.market.toLowerCase()
        // The API only returns total value, so we split it evenly for Yes/No
        // (This is a limitation - the API doesn't provide Yes/No breakdown)
        const totalOI = item.value || 0
        result[normalizedMarket] = {
          yesOI: totalOI / 2,
          noOI: totalOI / 2,
          totalOI: totalOI,
        }
      }

      return NextResponse.json({
        success: true,
        openInterest: result,
      })
    } else if (marketId) {
      // Single market
      const normalizedMarketId = marketId.toLowerCase()
      const params = new URLSearchParams({ market: normalizedMarketId })

      const url = `${apiUrl}?${params.toString()}`
      const cacheKey = buildCacheKey('polymarket:data:open-interest', [normalizedMarketId])
      let data: Array<{ market: string; value: number }>
      try {
        data = await cachedJson<Array<{ market: string; value: number }>>(
          cacheKey,
          url,
          undefined,
          { ttlMs: 15_000, allowStaleOnError: true }
        )
      } catch (error: any) {
        console.warn('[Open Interest] API error:', error?.status || 'unknown', error?.message || error)
        return NextResponse.json({
          success: true,
          openInterest: null,
          message: 'Open interest data not available for this market',
        })
      }

      if (!data || data.length === 0) {
        return NextResponse.json({
          success: true,
          openInterest: null,
          message: 'Open interest data not available for this market',
        })
      }

      const oiData = data[0]
      const totalOI = oiData.value || 0

      // The API only returns total value, so we split it evenly for Yes/No
      // (This is a limitation - the API doesn't provide Yes/No breakdown)
      return NextResponse.json({
        success: true,
        openInterest: {
          market: oiData.market,
          yesOI: totalOI / 2,
          noOI: totalOI / 2,
          totalOI: totalOI,
          timestamp: new Date().toISOString(),
        },
      })
    }

    return NextResponse.json(
      { error: 'Invalid parameters' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('[Open Interest] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch open interest' },
      { status: 500 }
    )
  }
}
