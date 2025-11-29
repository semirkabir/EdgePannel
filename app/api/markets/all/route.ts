import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { MarketAggregator } from '@/lib/api/market-aggregator'
import { KalshiClient } from '@/lib/api/kalshi'
import { PolymarketClient } from '@/lib/api/polymarket'
import { decrypt } from '@/lib/utils/encryption'
import { getBreakingNews, getLivePredictions, getCategories, EnrichedMarket } from '@/lib/markets/enrich'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get API keys for both platforms
    let kalshiClient: KalshiClient | undefined
    let polymarketClient: PolymarketClient | undefined

    // Try to get Kalshi credentials
    const kalshiKeyRecord = await prisma.apiKey.findUnique({
      where: {
        userId_platform: {
          userId: session.user.id,
          platform: 'kalshi',
        },
      },
    })

    if (kalshiKeyRecord?.encryptedKeyData) {
      try {
        const accessKeyId = decrypt(kalshiKeyRecord.encryptedKey)
        const privateKey = decrypt(kalshiKeyRecord.encryptedKeyData)
        kalshiClient = new KalshiClient({ accessKeyId, privateKey })
      } catch (error) {
        console.error('Error setting up Kalshi client:', error)
      }
    }

    // Try to get Polymarket credentials (optional for market reading)
    const polymarketKeyRecord = await prisma.apiKey.findUnique({
      where: {
        userId_platform: {
          userId: session.user.id,
          platform: 'polymarket',
        },
      },
    })

    if (polymarketKeyRecord) {
      try {
        const apiKey = decrypt(polymarketKeyRecord.encryptedKey)
        polymarketClient = new PolymarketClient({ apiKey })
      } catch (error) {
        // Polymarket can work without API key for reading markets
        polymarketClient = new PolymarketClient({ apiKey: '' })
      }
    } else {
      // Polymarket public API doesn't require auth
      polymarketClient = new PolymarketClient({ apiKey: '' })
    }

    // Create aggregator and get enriched markets
    const aggregator = new MarketAggregator(kalshiClient, polymarketClient)
    
    // Get markets from both platforms (errors are handled internally)
    const enrichedMarkets = await aggregator.getAllEnrichedMarkets()
    
    console.log(`[Markets API] Total enriched markets: ${enrichedMarkets.length}`)

    // Extract breaking news and live predictions
    const breakingNews = getBreakingNews(enrichedMarkets)
    const livePredictions = getLivePredictions(enrichedMarkets)
    const categories = getCategories(enrichedMarkets)
    
    console.log(`[Markets API] Breaking news: ${breakingNews.length}, Live predictions: ${livePredictions.length}, Categories: ${categories.length}`)

    return NextResponse.json({
      markets: enrichedMarkets,
      breakingNews,
      livePredictions,
      categories,
      stats: {
        total: enrichedMarkets.length,
        byPlatform: {
          polymarket: enrichedMarkets.filter(m => m.platform === 'polymarket').length,
          kalshi: enrichedMarkets.filter(m => m.platform === 'kalshi').length,
        },
        byCategory: categories.reduce((acc, cat) => {
          acc[cat] = enrichedMarkets.filter(m => m.normalizedCategory === cat).length
          return acc
        }, {} as Record<string, number>),
      },
    })
  } catch (error: any) {
    console.error('Error fetching all markets:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch markets',
        markets: [],
        breakingNews: [],
        livePredictions: [],
        categories: [],
        stats: { total: 0, byPlatform: {}, byCategory: {} },
      },
      { status: 500 }
    )
  }
}

