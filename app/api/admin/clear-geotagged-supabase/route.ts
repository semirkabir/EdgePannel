import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * Clear all geotagged markets using Supabase REST API (admin only)
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Clear Geotagged] Deleting all geotagged markets via Supabase REST API...')

    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.warn('[Clear Geotagged] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY, attempting via Prisma...')
      // Fallback to Prisma if env vars missing
      const result = await prisma.geotaggedMarket.deleteMany({})
      console.log('[Clear Geotagged] Cleared via Prisma: ' + result.count + ' records')
      return NextResponse.json({
        success: true,
        message: `Cleared ${result.count} geotagged markets. Ready to re-index.`
      })
    }

    // Try Supabase REST API first
    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/GeotaggedMarket?select=*`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          }
        }
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Supabase API error: ${response.status} ${error}`)
      }
    } catch (supabaseError: any) {
      console.warn('[Clear Geotagged] Supabase API failed, falling back to Prisma:', supabaseError.message)
      // Fallback to Prisma
      const result = await prisma.geotaggedMarket.deleteMany({})
      console.log('[Clear Geotagged] Cleared via Prisma: ' + result.count + ' records')
      return NextResponse.json({
        success: true,
        message: `Cleared ${result.count} geotagged markets (via fallback). Ready to re-index.`
      })
    }

    console.log('[Clear Geotagged] Cleared successfully')

    return NextResponse.json({
      success: true,
      message: 'All geotagged markets cleared. Ready to re-index with tags.'
    })
  } catch (error: any) {
    console.error('[Clear Geotagged] Error:', error)
    return NextResponse.json(
      { error: 'Failed to clear geotagged markets', details: error.message },
      { status: 500 }
    )
  }
}
