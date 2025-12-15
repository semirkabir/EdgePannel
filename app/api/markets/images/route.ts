import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxy endpoint to fetch market images from Polymarket API
 * Avoids CORS issues by making requests server-side
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const conditionId = searchParams.get('conditionId')

    if (!conditionId) {
      return NextResponse.json(
        { error: 'conditionId parameter is required' },
        { status: 400 }
      )
    }

    // Try events endpoint first (has better image data)
    try {
      const eventsResponse = await fetch(
        `https://gamma-api.polymarket.com/events?id=${conditionId}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        }
      )

      if (eventsResponse.ok) {
        const events = await eventsResponse.json()
        if (Array.isArray(events) && events.length > 0) {
          const event = events[0]
          const image = event.image || event.markets?.[0]?.image
          const icon = event.icon || event.markets?.[0]?.icon

          if (image || icon) {
            return NextResponse.json({
              image,
              icon,
              source: 'events',
            })
          }
        }
      }
    } catch (error) {
      console.warn('[Images API] Events endpoint failed:', error)
    }

    // Fallback to direct market lookup
    try {
      const marketResponse = await fetch(
        `https://gamma-api.polymarket.com/markets/${conditionId}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        }
      )

      if (marketResponse.ok) {
        const market = await marketResponse.json()
        if (market.image || market.icon) {
          return NextResponse.json({
            image: market.image,
            icon: market.icon,
            source: 'market',
          })
        }
      }
    } catch (error) {
      console.warn('[Images API] Market endpoint failed:', error)
    }

    // No images found
    return NextResponse.json(
      { image: null, icon: null, source: 'none' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[Images API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch market images', details: error.message },
      { status: 500 }
    )
  }
}
