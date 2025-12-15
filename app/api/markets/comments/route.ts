import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Polymarket Comments API
 *
 * Note: Polymarket's comments are primarily available via WebSocket (RTDS)
 * The REST API endpoint is restricted and returns validation errors.
 * This endpoint serves as a placeholder for future WebSocket integration.
 *
 * See: https://docs.polymarket.com/developers/RTDS/RTDS-comments
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const conditionId = searchParams.get('conditionId')
    const marketId = searchParams.get('marketId')
    const slug = searchParams.get('slug')

    if (!conditionId && !marketId && !slug) {
      return NextResponse.json(
        { error: 'conditionId, marketId, or slug is required' },
        { status: 400 }
      )
    }

    console.log('[Comments API] Request for:', { conditionId, marketId, slug })
    console.log('[Comments API] Comments require WebSocket (RTDS) integration')

    // Return empty comments with info message
    // The RTDS WebSocket system requires more complex integration
    return NextResponse.json({
      comments: [],
      total: 0,
      message: 'Comments are available via WebSocket (RTDS) only. REST API endpoint is restricted.',
      info: {
        websocket_url: 'wss://ws-subscriptions-clob.polymarket.com/ws/market',
        documentation: 'https://docs.polymarket.com/developers/RTDS/RTDS-comments',
        note: 'Consider implementing WebSocket client for real-time comments'
      }
    })
  } catch (error) {
    console.error('[Comments API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
