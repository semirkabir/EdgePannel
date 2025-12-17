import { NextResponse } from 'next/server'
import { PolymarketClient } from '@/lib/api/polymarket'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const closed = searchParams.get('closed') === 'true'
    const order = searchParams.get('order') || 'id'
    const ascending = searchParams.get('ascending') === 'true'

    const client = new PolymarketClient()

    console.log(`[Events API] Fetching events (limit: ${limit}, offset: ${offset}, closed: ${closed})`)
    const { events, hasMore, nextOffset } = await client.getEvents({
      limit,
      offset,
      closed,
      order: order as any,
      ascending,
    })

    console.log(`[Events API] Successfully fetched ${events.length} events`)

    return NextResponse.json({
      events,
      hasMore,
      nextOffset,
    })
  } catch (error: any) {
    console.error('[Events API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events', details: error.message },
      { status: 500 }
    )
  }
}
