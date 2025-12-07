import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { MarketAggregator } from '@/lib/api/market-aggregator'
import { KalshiClient } from '@/lib/api/kalshi'
import { PolymarketClient } from '@/lib/api/polymarket'
import { decrypt } from '@/lib/utils/encryption'

export async function GET(request: Request) {
  try {
    // Get user ID - use mock if auth is disabled (to match api-keys route)
    let userId: string
    const { AUTH_ENABLED, MOCK_USER_ID } = await import('@/lib/auth-config')
    
    if (AUTH_ENABLED) {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = session.user.id
    } else {
      userId = MOCK_USER_ID
    }
    
    console.log('[Compare API] Using user ID:', userId, '(AUTH_ENABLED:', AUTH_ENABLED, ')')

    // Get user's API keys
    console.log('[Compare API] Checking for Kalshi API keys for user:', userId)
    const [kalshiKey, polymarketKey] = await Promise.all([
      prisma.apiKey.findUnique({
        where: {
          userId_platform: {
            userId: userId,
            platform: 'kalshi',
          },
        },
      }),
      prisma.apiKey.findUnique({
        where: {
          userId_platform: {
            userId: userId,
            platform: 'polymarket',
          },
        },
      }),
    ])

    console.log('[Compare API] Kalshi key record:', {
      found: !!kalshiKey,
      hasEncryptedKey: !!kalshiKey?.encryptedKey,
      hasEncryptedKeyData: !!kalshiKey?.encryptedKeyData,
      isActive: kalshiKey?.isActive,
    })

    let kalshiClient: KalshiClient | undefined
    let polymarketClient: PolymarketClient | undefined

    if (kalshiKey && kalshiKey.encryptedKeyData) {
      try {
        console.log('[Compare API] Kalshi API keys found, decrypting...')
        const accessKeyId = decrypt(kalshiKey.encryptedKey)
        const privateKey = decrypt(kalshiKey.encryptedKeyData)
        console.log('[Compare API] Keys decrypted successfully, creating Kalshi client...')
        kalshiClient = new KalshiClient({ accessKeyId, privateKey })
        console.log('[Compare API] Kalshi client created successfully')
      } catch (error: any) {
        console.error('[Compare API] Error setting up Kalshi client:', error.message || error)
        console.error('[Compare API] Error stack:', error.stack)
      }
      } else {
        if (kalshiKey) {
          console.log('[Compare API] Kalshi key record exists but missing encryptedKeyData (private key)')
        } else {
          console.log('[Compare API] No Kalshi API keys found for user:', userId)
        }
      }

    if (polymarketKey) {
      const apiKey = decrypt(polymarketKey.encryptedKey)
      polymarketClient = new PolymarketClient({ apiKey })
    }

    const aggregator = new MarketAggregator(kalshiClient, polymarketClient)
    const markets = await aggregator.getAllMarkets()
    const comparisons = aggregator.findSimilarMarkets(markets)

    return NextResponse.json({ comparisons, totalMarkets: markets.length })
  } catch (error: any) {
    console.error('Error comparing markets:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to compare markets' },
      { status: 500 }
    )
  }
}



