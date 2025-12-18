import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db/client'

export async function GET() {
    try {
        const total = await prisma.geotaggedMarket.count()

        const byPlatform = await prisma.geotaggedMarket.groupBy({
            by: ['platform'],
            _count: {
                _all: true
            }
        })

        const byConfidence = await prisma.geotaggedMarket.groupBy({
            by: ['confidence'],
            _count: {
                _all: true
            }
        })

        const topCountries = await prisma.geotaggedMarket.groupBy({
            by: ['country'],
            _count: {
                _all: true
            },
            orderBy: {
                _count: {
                    country: 'desc'
                }
            },
            take: 10
        })

        // Format results
        const platformStats: Record<string, number> = {}
        byPlatform.forEach(p => {
            platformStats[p.platform] = p._count._all
        })

        const confidenceStats: Record<string, number> = {}
        byConfidence.forEach(c => {
            if (c.confidence) confidenceStats[c.confidence] = c._count._all
        })

        const countryStats = topCountries
            .filter(c => c.country)
            .map(c => ({
                country: c.country,
                count: c._count._all
            }))

        return NextResponse.json({
            total,
            byPlatform: platformStats,
            byConfidence: confidenceStats,
            topCountries: countryStats
        })
    } catch (error: any) {
        console.error('Error fetching admin stats:', error)
        return NextResponse.json(
            { error: 'Failed to fetch stats', details: error.message },
            { status: 500 }
        )
    }
}
