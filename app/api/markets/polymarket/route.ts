import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { PolymarketClient } from '@/lib/api/polymarket'
import { decrypt } from '@/lib/utils/encryption'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Polymarket's public GraphQL API doesn't require authentication for reading markets
    // API key is only needed for trading operations
    // Try to get API key if available (for future trading features), but don't require it
    let apiKey: string | undefined
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: {
        userId_platform: {
          userId: session.user.id,
          platform: 'polymarket',
        },
      },
    })

    if (apiKeyRecord) {
      try {
        apiKey = decrypt(apiKeyRecord.encryptedKey)
        console.log('[Polymarket] API key found (for trading), using public API for market data')
      } catch (decryptError: any) {
        console.warn('[Polymarket] Error decrypting API key, continuing with public API:', decryptError)
      }
    } else {
      console.log('[Polymarket] No API key found, using public GraphQL API (no auth required)')
    }

    try {
      // Use empty string or placeholder - the getMarkets method uses public GraphQL API
      const client = new PolymarketClient({ apiKey: apiKey || '' })

      const { searchParams } = new URL(request.url)
      const limit = parseInt(searchParams.get('limit') || '100')
      const offset = parseInt(searchParams.get('offset') || '0')

      console.log(`[Polymarket] Fetching markets (limit: ${limit}, offset: ${offset})`)
      const { markets } = await client.getMarkets({ limit, offset })
      console.log(`[Polymarket] Successfully fetched ${markets.length} markets`)

      return NextResponse.json({ markets })
    } catch (apiError: any) {
      console.error('[Polymarket] Error calling API:', apiError.message || apiError)
      console.error('[Polymarket] Error stack:', apiError.stack)
      // Return empty markets instead of error - API call failed
      return NextResponse.json({ markets: [] })
    }
  } catch (error: any) {
    console.error('Error fetching Polymarket markets:', error)
    // Return empty markets instead of 500 error
    return NextResponse.json({ markets: [] })
  }
}

