export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'

/**
 * Get all unique tags/categories from geotagged markets
 * This is used to populate filter dropdowns
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform') // Optional: filter tags by platform

    // Build where clause for active markets only
    const where: any = {
      OR: [
        { endDate: { gte: new Date() } },
        { endDate: null }
      ],
      latitude: { not: null },
      longitude: { not: null },
    }

    if (platform) {
      where.platform = platform
    }

    // Get all markets with tags
    const markets = await prisma.geotaggedMarket.findMany({
      where,
      select: {
        tags: true,
        category: true,
      }
    })

    // Collect all unique tags and count their frequency
    const tagCounts = new Map<string, number>()
    const categorySet = new Set<string>()

    markets.forEach(market => {
      // Add primary category
      if (market.category) {
        categorySet.add(market.category)
      }

      // Add all tags
      if (market.tags && Array.isArray(market.tags)) {
        market.tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
        })
      }
    })

    // Convert to sorted arrays
    const tags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count) // Sort by frequency

    const categories = Array.from(categorySet).sort()

    console.log(`[Tags API] Found ${tags.length} unique tags and ${categories.length} categories`)

    return NextResponse.json({
      tags,
      categories,
      total: markets.length
    })
  } catch (error: any) {
    console.error('[Tags API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tags', details: error.message },
      { status: 500 }
    )
  }
}
