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
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's API keys
    const [kalshiKey, polymarketKey] = await Promise.all([
      prisma.apiKey.findUnique({
        where: {
          userId_platform: {
            userId: session.user.id,
            platform: 'kalshi',
          },
        },
      }),
      prisma.apiKey.findUnique({
        where: {
          userId_platform: {
            userId: session.user.id,
            platform: 'polymarket',
          },
        },
      }),
    ])

    let kalshiClient: KalshiClient | undefined
    let polymarketClient: PolymarketClient | undefined

    if (kalshiKey && kalshiKey.encryptedKeyData) {
      const accessKeyId = decrypt(kalshiKey.encryptedKey)
      const privateKey = decrypt(kalshiKey.encryptedKeyData)
      kalshiClient = new KalshiClient({ accessKeyId, privateKey })
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


