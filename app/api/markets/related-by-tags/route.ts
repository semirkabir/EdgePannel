import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tagId = searchParams.get('tagId')
    const tagSlug = searchParams.get('tagSlug')
    const excludeMarketId = searchParams.get('marketId') // Market ID to exclude from results
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!tagId && !tagSlug) {
      return NextResponse.json(
        { error: 'tagId or tagSlug is required' },
        { status: 400 }
      )
    }

    // Fetch related tags first, and also get the primary tag ID
    let relatedTagIds: number[] = []
    let primaryTagId: number | null = null
    
    try {
      if (tagId) {
        // We already have the primary tag ID
        primaryTagId = parseInt(tagId, 10)
        
        // Get related tags by tag ID
        const relatedTagsUrl = `https://gamma-api.polymarket.com/tags/${tagId}/related-tags/tags`
        const relatedTagsResponse = await fetch(relatedTagsUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        })

        if (relatedTagsResponse.ok) {
          const relatedTags = await relatedTagsResponse.json()
          if (Array.isArray(relatedTags)) {
            // Extract tag IDs from related tags
            relatedTagIds = relatedTags
              .map((tag: any) => tag.id)
              .filter((id: any) => id != null && id !== primaryTagId) // Exclude the primary tag itself
              .slice(0, 5) // Limit to top 5 related tags
          }
        }
      } else if (tagSlug) {
        // First, try to get the tag by slug to get its ID
        try {
          const tagUrl = `https://gamma-api.polymarket.com/tags/slug/${tagSlug}`
          const tagResponse = await fetch(tagUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
          })
          
          if (tagResponse.ok) {
            const tag = await tagResponse.json()
            primaryTagId = tag.id
          }
        } catch (e) {
          console.warn('[Related Markets API] Could not fetch tag by slug:', e)
        }

        // Get related tags by tag slug
        const relatedTagsUrl = `https://gamma-api.polymarket.com/tags/slug/${tagSlug}/related-tags/tags`
        const relatedTagsResponse = await fetch(relatedTagsUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        })

        if (relatedTagsResponse.ok) {
          const relatedTags = await relatedTagsResponse.json()
          if (Array.isArray(relatedTags)) {
            relatedTagIds = relatedTags
              .map((tag: any) => tag.id)
              .filter((id: any) => id != null && id !== primaryTagId) // Exclude the primary tag itself
              .slice(0, 5)
          }
        }
      }
    } catch (error) {
      console.error('[Related Markets API] Error fetching related tags:', error)
    }
    
    // Combine primary tag with related tags (but exclude primary from related list to avoid duplicates)
    // This ensures we get markets from both the primary tag AND related tags
    const tagsToSearch = primaryTagId 
      ? [primaryTagId, ...relatedTagIds.filter(id => id !== primaryTagId)]
      : relatedTagIds.length > 0 
        ? relatedTagIds 
        : []
    
    // Fetch markets for each related tag
    const allMarkets: any[] = []
    const seenMarketIds = new Set<string>()

    for (const tagIdToSearch of tagsToSearch) {
      try {
        // Fetch markets by tag ID
        const marketsUrl = `https://gamma-api.polymarket.com/markets?tags=${tagIdToSearch}&limit=10&closed=false&order=volume&ascending=false`
        const marketsResponse = await fetch(marketsUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        })

        if (marketsResponse.ok) {
          const markets = await marketsResponse.json()
          if (Array.isArray(markets)) {
            for (const market of markets) {
              const marketId = market.conditionId || market.id?.toString()
              // Exclude the current market and avoid duplicates
              if (marketId && marketId !== excludeMarketId && !seenMarketIds.has(marketId)) {
                seenMarketIds.add(marketId)
                
                // Parse outcome prices
                let price = 0
                try {
                  const prices = typeof market.outcomePrices === 'string'
                    ? JSON.parse(market.outcomePrices)
                    : market.outcomePrices
                  if (Array.isArray(prices) && prices.length > 0) {
                    price = parseFloat(prices[0].toString())
                  }
                } catch (e) {
                  // Use default price
                }

                allMarkets.push({
                  id: marketId,
                  conditionId: market.conditionId,
                  title: market.question || '',
                  description: market.description || '',
                  price,
                  probability: price,
                  volume24h: parseFloat(market.volume24hr?.toString() || '0'),
                  liquidity: parseFloat(market.liquidityNum?.toString() || '0'),
                  slug: market.slug,
                  imageUrl: market.image,
                  endDate: market.endDateIso,
                  platform: 'polymarket',
                  url: market.slug ? `https://polymarket.com/market/${market.slug}` : undefined,
                })
              }
            }
          }
        }
      } catch (error) {
        console.error(`[Related Markets API] Error fetching markets for tag ${tagIdToSearch}:`, error)
      }
    }

    // Sort by volume and limit
    const sortedMarkets = allMarkets
      .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
      .slice(0, limit)

    // Log for debugging (only in dev)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Related Markets API] Found ${sortedMarkets.length} related markets from ${tagsToSearch.length} related tags for tagId: ${tagId || 'N/A'}, tagSlug: ${tagSlug || 'N/A'}, excludeMarketId: ${excludeMarketId || 'N/A'}`)
    }

    return NextResponse.json({
      markets: sortedMarkets,
      relatedTagIds: tagsToSearch,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error: any) {
    console.error('[Related Markets API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch related markets', details: error.message },
      { status: 500 }
    )
  }
}
