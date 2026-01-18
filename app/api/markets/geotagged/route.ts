export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { withErrorHandler, getUserId } from '@/lib/api/middleware'
import { validateQuery } from '@/lib/api/validate'
import { GeotaggedMarketsQuerySchema } from '@/lib/api/schemas/markets'

/**
 * Get geotagged markets for map display
 * Groups markets by eventId so each event appears as a single marker
 * Supports filtering by country, region, category, platform, etc.
 */
export const GET = withErrorHandler(async (request: Request) => {
  try {
    const userId = await getUserId()

    const { searchParams } = new URL(request.url)

    // Validate and parse query parameters
    const params = validateQuery(GeotaggedMarketsQuerySchema, searchParams)

    const {
      platform,
      country,
      region,
      category,
      tag,
      confidence,
      search,
      groupByEvent,
      minLat,
      maxLat,
      minLng,
      maxLng,
      limit,
      offset
    } = params

    // Build where clause
    const where: any = {
      // Must have coordinates
      latitude: { not: null },
      longitude: { not: null },
    }

    // Active markets filter (not expired)
    const activeMarketFilter = [
      { endDate: { gte: new Date() } },
      { endDate: null }
    ]

    if (platform) {
      where.platform = platform
    }

    if (country) {
      where.country = country
    }

    if (region) {
      where.region = region
    }

    if (category) {
      where.category = {
        contains: category,
        mode: 'insensitive'
      }
    }

    if (tag) {
      // Filter by markets that have this tag in their tags array
      where.tags = {
        has: tag
      }
    }

    if (confidence) {
      where.confidence = confidence
    }

    // Combine active market filter with search filter using AND
    if (search) {
      where.AND = [
        { OR: activeMarketFilter },
        {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } }
          ]
        }
      ]
    } else {
      where.OR = activeMarketFilter
    }

    // Bounding box filter
    if (minLat !== undefined && maxLat !== undefined && minLng !== undefined && maxLng !== undefined) {
      where.latitude = { gte: minLat, lte: maxLat }
      where.longitude = { gte: minLng, lte: maxLng }
    }

    // Query markets
    const [markets, total] = await Promise.all([
      prisma.geotaggedMarket.findMany({
        where,
        orderBy: [
          { volume24h: 'desc' },
          { probability: 'desc' }
        ],
        take: limit,
        skip: offset,
        select: {
          id: true,
          marketId: true,
          platform: true,
          externalId: true,
          title: true,
          description: true,
          category: true,
          tags: true,
          probability: true,
          volume24h: true,
          liquidity: true,
          endDate: true,
          slug: true,
          ticker: true,
          country: true,
          region: true,
          city: true,
          latitude: true,
          longitude: true,
          confidence: true,
          updatedAt: true,
          rawData: true,
        }
      }),
      prisma.geotaggedMarket.count({ where })
    ])

    console.log(`[Geotagged Markets] Fetched ${markets.length} of ${total} markets`)

    // Transform markets to include outcomes and outcomePrices from rawData
    const transformedMarkets = markets.map((market: any) => {
      const rawData = market.rawData || {}

      // Extract outcomes and outcomePrices from rawData if available
      let outcomes = rawData.outcomes
      let outcomePrices = rawData.outcomePrices

      // Parse outcomePrices if it's a string
      if (typeof outcomePrices === 'string') {
        try {
          outcomePrices = JSON.parse(outcomePrices)
        } catch (e) {
          // Ignore parse errors
        }
      }

      // Convert string prices to numbers if needed
      if (Array.isArray(outcomePrices)) {
        outcomePrices = outcomePrices.map((p: any) => typeof p === 'string' ? parseFloat(p) : p)
      }

      return {
        ...market,
        image: rawData.image || rawData.icon || rawData.eventImage,
        outcomes,
        outcomePrices,
        price: market.probability,
        // Preserve eventId for grouping
        eventId: rawData.eventId || null,
        eventTitle: rawData.eventTitle || null,
      }
    })

    // Group markets by eventId if requested (default behavior)
    if (groupByEvent) {
      const eventGroups = new Map<string, any[]>()
      const ungroupedMarkets: any[] = []

      // Group markets by eventId
      for (const market of transformedMarkets) {
        const eventId = market.eventId || market.rawData?.eventId
        
        if (eventId) {
          if (!eventGroups.has(eventId)) {
            eventGroups.set(eventId, [])
          }
          eventGroups.get(eventId)!.push(market)
        } else {
          // Markets without eventId are treated as single-market events
          ungroupedMarkets.push(market)
        }
      }

      // Convert groups to event objects
      const events: any[] = []

      for (const [eventId, eventMarkets] of eventGroups.entries()) {
        // Use the first market as the primary (usually highest volume)
        const primaryMarket = eventMarkets[0]
        const rawData = primaryMarket.rawData || {}

        // Calculate aggregate stats
        const totalVolume = eventMarkets.reduce((sum, m) => sum + (m.volume24h || 0), 0)
        const totalLiquidity = eventMarkets.reduce((sum, m) => sum + (m.liquidity || 0), 0)

        events.push({
          id: eventId,
          eventId: eventId,
          isEvent: true,
          marketCount: eventMarkets.length,
          // Use event title if available, otherwise use first market's title
          title: rawData.eventTitle || primaryMarket.title,
          description: primaryMarket.description,
          category: primaryMarket.category,
          tags: primaryMarket.tags,
          platform: primaryMarket.platform,
          // Location from primary market
          country: primaryMarket.country,
          region: primaryMarket.region,
          city: primaryMarket.city,
          latitude: primaryMarket.latitude,
          longitude: primaryMarket.longitude,
          confidence: primaryMarket.confidence,
          // Aggregate stats
          volume24h: totalVolume,
          liquidity: totalLiquidity,
          // Use highest probability market's price for display
          probability: Math.max(...eventMarkets.map(m => m.probability || 0)),
          price: Math.max(...eventMarkets.map(m => m.price || 0)),
          // End date from earliest expiring market
          endDate: eventMarkets
            .filter(m => m.endDate)
            .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())[0]?.endDate,
          // Image from event or first market
          image: rawData.eventImage || rawData.image || rawData.icon || primaryMarket.image,
          // Include all markets in this event for the details panel
          markets: eventMarkets.map(m => ({
            id: m.externalId || m.id,
            marketId: m.marketId,
            title: m.title,
            slug: m.slug,
            ticker: m.ticker,
            probability: m.probability,
            price: m.price,
            volume24h: m.volume24h,
            liquidity: m.liquidity,
            outcomes: m.outcomes,
            outcomePrices: m.outcomePrices,
            endDate: m.endDate,
            platform: m.platform,
            image: m.image,
            rawData: m.rawData,
          })),
          // Raw data for compatibility
          rawData: {
            ...rawData,
            eventId,
            markets: eventMarkets.map(m => m.rawData),
          },
        })
      }

      // Add ungrouped markets as single-market events
      for (const market of ungroupedMarkets) {
        events.push({
          ...market,
          id: market.externalId || market.id,
          eventId: `single_${market.platform}_${market.externalId || market.id}`,
          isEvent: true,
          marketCount: 1,
          markets: [{
            id: market.externalId || market.id,
            marketId: market.marketId,
            title: market.title,
            slug: market.slug,
            ticker: market.ticker,
            probability: market.probability,
            price: market.price,
            volume24h: market.volume24h,
            liquidity: market.liquidity,
            outcomes: market.outcomes,
            outcomePrices: market.outcomePrices,
            endDate: market.endDate,
            platform: market.platform,
            image: market.image,
            rawData: market.rawData,
          }],
        })
      }

      // Sort events by volume
      events.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))

      console.log(`[Geotagged Markets] Grouped into ${events.length} events (${eventGroups.size} multi-market, ${ungroupedMarkets.length} single-market)`)

      return NextResponse.json({
        markets: events,
        total: events.length,
        limit,
        offset: offset || 0,
        hasMore: (offset || 0) + markets.length < total,
        grouped: true,
      })
    }

    // Return ungrouped markets if groupByEvent=false
    return NextResponse.json({
      markets: transformedMarkets,
      total,
      limit,
      offset: offset || 0,
      hasMore: (offset || 0) + markets.length < total,
      grouped: false,
    })
  } catch (error: any) {
    console.error('[Geotagged Markets] Error:', error)

    // Check for missing table error (Prisma P2021 or table doesn't exist)
    const isTableMissing =
      error?.code === 'P2021' ||
      error?.message?.includes('does not exist') ||
      error?.message?.includes('relation') ||
      error?.message?.includes('table')

    if (isTableMissing) {
      return NextResponse.json(
        {
          error: 'Database table not found',
          message: 'The geotagged_market table has not been created yet.',
          instructions: 'Run: npx prisma db push or npx prisma migrate dev',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch geotagged markets', details: error.message },
      { status: 500 }
    )
  }
})
