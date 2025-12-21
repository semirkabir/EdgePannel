import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db/client'
import { requireAdmin } from '@/lib/auth/admin'

export async function GET() {
    try {
        // Check admin authorization
        await requireAdmin()

        const [totalMarkets, totalUsers, providerStats, recentUsers] = await Promise.all([
            prisma.geotaggedMarket.count(),
            prisma.user.count(),
            prisma.account.groupBy({
                by: ['provider'],
                _count: {
                    _all: true
                }
            }),
            prisma.user.findMany({
                take: 20,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    createdAt: true,
                    image: true,
                    accounts: {
                        select: {
                            provider: true
                        }
                    }
                }
            })
        ])

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

        const usersByProvider: Record<string, number> = {}
        providerStats.forEach(p => {
            usersByProvider[p.provider] = p._count._all
        })

        return NextResponse.json({
            totalMarkets,
            totalUsers,
            usersByProvider,
            recentUsers,
            byPlatform: platformStats,
            byConfidence: confidenceStats,
            topCountries: countryStats
        })
    } catch (error: any) {
        // Check if it's an authorization error
        if (error.message?.includes('Unauthorized')) {
            return NextResponse.json(
                { error: 'Unauthorized: Admin access required' },
                { status: 403 }
            )
        }

        console.error('Error fetching admin stats:', error)
        return NextResponse.json(
            { error: 'Failed to fetch stats', details: error.message },
            { status: 500 }
        )
    }
}
