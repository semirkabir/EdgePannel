export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { KalshiClient } from '@/lib/api/kalshi'
import { withAuth, withErrorHandler, ApiError } from '@/lib/api/middleware'
import { ErrorCodes } from '@/lib/api/error-codes'
import { prisma } from '@/lib/db/client'
import { decrypt } from '@/lib/utils/encryption'

export const GET = withErrorHandler(
  withAuth(async (userId: string, request: NextRequest) => {
    const searchParams = request.nextUrl.searchParams
    const ticker = searchParams.get('ticker')
    const platform = searchParams.get('platform') || 'kalshi'

    if (!ticker) {
      throw new ApiError(400, 'Ticker is required', ErrorCodes.VALIDATION_ERROR)
    }

    if (platform === 'kalshi') {
      // Get user's API keys from database
      const apiKeyRecord = await prisma.apiKey.findUnique({
        where: {
          userId_platform: {
            userId: userId,
            platform: 'kalshi',
          },
        },
      })

      if (!apiKeyRecord || !apiKeyRecord.encryptedKeyData) {
        throw new ApiError(
          400,
          'Kalshi API keys not configured. Please add your API keys in Settings.',
          ErrorCodes.API_KEYS_NOT_CONFIGURED
        )
      }

      const accessKeyId = decrypt(apiKeyRecord.encryptedKey)
      const privateKey = decrypt(apiKeyRecord.encryptedKeyData)
      const kalshi = new KalshiClient({ accessKeyId, privateKey })
      const { bids, asks } = await kalshi.getOrderBook(ticker)

      // Calculate spread and depth metrics
      const spread = asks.length > 0 && bids.length > 0
        ? asks[0].price - bids[0].price
        : 0

      const bidDepth = bids.reduce((sum, level) => sum + (level.price * level.quantity), 0)
      const askDepth = asks.reduce((sum, level) => sum + (level.price * level.quantity), 0)
      const totalDepth = bidDepth + askDepth
      const imbalance = totalDepth > 0 ? (bidDepth - askDepth) / totalDepth : 0

      return NextResponse.json({
        ticker,
        platform,
        bids,
        asks,
        metrics: {
          spread,
          spreadPercent: bids.length > 0 ? (spread / bids[0].price) * 100 : 0,
          bidDepth,
          askDepth,
          totalDepth,
          imbalance,
          bidLevels: bids.length,
          askLevels: asks.length,
        }
      })
    }

    throw new ApiError(400, 'Platform not supported', ErrorCodes.INVALID_PLATFORM)
  })
)
