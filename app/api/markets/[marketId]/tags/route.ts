import { NextResponse } from 'next/server'

/**
 * Get tags for a specific Polymarket market
 * Returns tag objects with id, slug, and label
 */
export async function GET(
  request: Request,
  { params }: { params: { marketId: string } }
) {
  try {
    const { marketId } = params

    if (!marketId) {
      return NextResponse.json(
        { error: 'marketId is required' },
        { status: 400 }
      )
    }

    // Fetch tags from Polymarket API
    const tagsUrl = `https://gamma-api.polymarket.com/markets/${marketId}/tags`
    const response = await fetch(tagsUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch tags from Polymarket' },
        { status: response.status }
      )
    }

    const tags = await response.json()

    if (!Array.isArray(tags)) {
      return NextResponse.json({ tags: [] })
    }

    // Return tags with id, slug, and label
    return NextResponse.json({ tags })
  } catch (error: any) {
    console.error('[Market Tags API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tags', details: error.message },
      { status: 500 }
    )
  }
}


