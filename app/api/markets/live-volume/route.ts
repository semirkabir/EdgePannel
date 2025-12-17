import { NextResponse } from 'next/server'

/**
 * Fetches live volume for a Polymarket event
 * @see https://docs.polymarket.com/api-reference/misc/get-live-volume-for-an-event
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId query parameter is required' },
        { status: 400 }
      )
    }

    // Validate eventId is a number
    const eventIdNum = parseInt(eventId, 10)
    if (isNaN(eventIdNum) || eventIdNum < 1) {
      return NextResponse.json(
        { error: 'eventId must be a positive integer' },
        { status: 400 }
      )
    }

    // Fetch live volume from Polymarket Data API
    const response = await fetch(
      `https://data-api.polymarket.com/live-volume?id=${eventIdNum}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        // Cache for 30 seconds
        next: { revalidate: 30 },
      }
    )

    if (!response.ok) {
      console.error(`[Live Volume] Polymarket API error: ${response.status} ${response.statusText}`)
      return NextResponse.json(
        { error: 'Failed to fetch live volume from Polymarket' },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Polymarket returns an array with one object containing total and markets
    if (Array.isArray(data) && data.length > 0) {
      const volumeData = data[0]
      return NextResponse.json({
        success: true,
        total: volumeData.total || 0,
        markets: volumeData.markets || [],
        eventId: eventIdNum,
      })
    }

    // Fallback if structure is different
    return NextResponse.json({
      success: true,
      total: data.total || 0,
      markets: data.markets || [],
      eventId: eventIdNum,
    })
  } catch (error: any) {
    console.error('[Live Volume] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch live volume' },
      { status: 500 }
    )
  }
}

