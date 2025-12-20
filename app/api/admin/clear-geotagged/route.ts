import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { requireAdmin } from '@/lib/auth/admin'

/**
 * Clear all geotagged markets (admin only)
 */
export async function POST(request: Request) {
  try {
    // Check admin authorization
    await requireAdmin()
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Unauthorized: Admin access required' },
      { status: 403 }
    )
  }

  try {

    console.log('[Clear Geotagged] Deleting all geotagged markets...')

    // Use raw SQL to avoid the prepared statement issue
    const result = await prisma.$executeRaw`TRUNCATE TABLE "GeotaggedMarket";`

    console.log('[Clear Geotagged] Cleared successfully')

    return NextResponse.json({
      success: true,
      message: 'All geotagged markets cleared. Ready to re-index with fixed location extraction.'
    })
  } catch (error: any) {
    console.error('[Clear Geotagged] Error:', error)
    return NextResponse.json(
      { error: 'Failed to clear geotagged markets', details: error.message },
      { status: 500 }
    )
  }
}
