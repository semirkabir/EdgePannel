import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'

/**
 * Get geotagged markets for map display
 * Supports filtering by country, region, category, platform, etc.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if GeotaggedMarket table exists
    try {
      await prisma.$queryRaw`SELECT 1 FROM "GeotaggedMarket" LIMIT 1`
    } catch (tableError: any) {
      console.error('[Geotagged Markets] Table does not exist:', tableError.message)
      return NextResponse.json({
        error: 'GeotaggedMarket table not found',
        message: 'Please run the database migration first. See: prisma/migrations/add_geotagged_markets.sql',
        instructions: {
          step1: 'Go to https://app.supabase.com/project/_/sql/new',
          step2: 'Copy SQL from prisma/migrations/add_geotagged_markets.sql',
          step3: 'Paste and run in SQL Editor',
          step4: 'Then visit /admin/index-markets to index your markets'
        },
        markets: [],
        total: 0
      }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)

    // Filters
    const platform = searchParams.get('platform') // 'kalshi', 'polymarket', or null for all
    const country = searchParams.get('country')
    const region = searchParams.get('region')
    const category = searchParams.get('category')
    const confidence = searchParams.get('confidence') // 'high', 'medium', 'low'
    const search = searchParams.get('search')

    // Bounding box for map viewport
    const minLat = searchParams.get('minLat') ? parseFloat(searchParams.get('minLat')!) : undefined
    const maxLat = searchParams.get('maxLat') ? parseFloat(searchParams.get('maxLat')!) : undefined
    const minLng = searchParams.get('minLng') ? parseFloat(searchParams.get('minLng')!) : undefined
    const maxLng = searchParams.get('maxLng') ? parseFloat(searchParams.get('maxLng')!) : undefined

    // Pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '1000'), 5000)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = {
      // Only active markets (not expired)
      OR: [
        { endDate: { gte: new Date() } },
        { endDate: null }
      ],
      // Must have coordinates
      latitude: { not: null },
      longitude: { not: null },
    }

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

    if (confidence) {
      where.confidence = confidence
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
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
        }
      }),
      prisma.geotaggedMarket.count({ where })
    ])

    console.log(`[Geotagged Markets] Returned ${markets.length} of ${total} markets`)

    return NextResponse.json({
      markets,
      total,
      limit,
      offset,
      hasMore: offset + markets.length < total
    })
  } catch (error: any) {
    console.error('[Geotagged Markets] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch geotagged markets', details: error.message },
      { status: 500 }
    )
  }
}
