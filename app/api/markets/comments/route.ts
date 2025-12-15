import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Polymarket Comments API
 * Fetches comments from the Data API
 * See: https://docs.polymarket.com/api-reference/comments/list-comments
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const conditionId = searchParams.get('conditionId')
    const marketId = searchParams.get('marketId')
    const slug = searchParams.get('slug')
    const limit = searchParams.get('limit') || '20'

    if (!conditionId && !marketId && !slug) {
      return NextResponse.json(
        { error: 'conditionId, marketId, or slug is required' },
        { status: 400 }
      )
    }

    console.log('[Comments API] Fetching comments for:', { conditionId, marketId, slug })

    // Step 1: Get market data to find the event ID
    let marketNumericId = marketId
    let eventId: number | null = null

    // If we have conditionId, fetch market data to get numeric ID and event info
    if (conditionId || slug) {
      try {
        const marketUrl = conditionId
          ? `https://gamma-api.polymarket.com/markets/${conditionId}`
          : `https://gamma-api.polymarket.com/markets?slug=${slug}&limit=1`

        console.log('[Comments API] Fetching market data from:', marketUrl)
        const marketResponse = await fetch(marketUrl, {
          headers: { 'Accept': 'application/json' }
        })

        if (marketResponse.ok) {
          const marketData = await marketResponse.json()
          const market = Array.isArray(marketData) ? marketData[0] : marketData

          if (market) {
            marketNumericId = market.id
            // Check if market has events array with event ID
            if (market.events && Array.isArray(market.events) && market.events.length > 0) {
              eventId = market.events[0].id || market.events[0].ID
            }
            console.log('[Comments API] Market ID:', marketNumericId, 'Event ID:', eventId)
          }
        }
      } catch (error) {
        console.error('[Comments API] Error fetching market data:', error)
      }
    }

    // Step 2: Fetch comments using event ID (Event type) or market ID
    if (eventId) {
      try {
        const commentsUrl = `https://gamma-api.polymarket.com/comments?limit=${limit}&offset=0&parent_entity_type=Event&parent_entity_id=${eventId}`
        console.log('[Comments API] Fetching comments from:', commentsUrl)

        const commentsResponse = await fetch(commentsUrl, {
          headers: { 'Accept': 'application/json' }
        })

        if (commentsResponse.ok) {
          const comments = await commentsResponse.json()
          console.log('[Comments API] Received', comments.length, 'comments')

          // Transform comments to simpler format
          const transformedComments = comments.map((comment: any) => ({
            id: comment.id,
            comment: comment.body,
            user: {
              username: comment.profile?.name || comment.profile?.pseudonym || 'Anonymous',
              profile_image: comment.profile?.profileImage || null
            },
            created_at: comment.createdAt,
            likes: comment.reactionCount || 0,
            replies_count: 0 // We're not fetching replies for now
          }))

          return NextResponse.json({
            comments: transformedComments,
            total: transformedComments.length,
            source: 'gamma-api-event'
          })
        }
      } catch (error) {
        console.error('[Comments API] Error fetching comments:', error)
      }
    }

    // Fallback: Return empty with helpful message
    console.log('[Comments API] No event ID found, cannot fetch comments')
    return NextResponse.json({
      comments: [],
      total: 0,
      source: 'none',
      message: 'Could not fetch comments. Market may not have an associated event.'
    })
  } catch (error) {
    console.error('[Comments API] Error:', error)
    return NextResponse.json(
      {
        comments: [],
        total: 0,
        error: 'Failed to fetch comments',
        details: String(error)
      },
      { status: 500 }
    )
  }
}
