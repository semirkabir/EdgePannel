import { NextRequest, NextResponse } from 'next/server'
import { KalshiClient } from '@/lib/api/kalshi'
import { withAuth, withErrorHandler, ApiError } from '@/lib/api/middleware'
import { ErrorCodes } from '@/lib/api/error-codes'
import { prisma } from '@/lib/db/client'
import { decrypt } from '@/lib/utils/encryption'
import { validateQuery } from '@/lib/api/validate'
import { z } from 'zod'

const MarketTradesQuerySchema = z.object({
  ticker: z.string().trim().max(100).optional(),
  platform: z.enum(['kalshi', 'polymarket']).default('kalshi'),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  cursor: z.string().optional(),
})

export const GET = withErrorHandler(
  withAuth(async (userId: string, request: NextRequest) => {
    const searchParams = request.nextUrl.searchParams
    const { ticker, platform, limit, cursor } = validateQuery(MarketTradesQuerySchema, searchParams)

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
      const { trades, cursor: nextCursor } = await kalshi.getTrades({
        ticker: ticker || undefined,
        limit,
        cursor,
      })

      // Calculate volume and trade stats
      const totalVolume = trades.reduce((sum, t) => sum + (t.yesPrice * t.count), 0)
      const avgTradeSize = trades.length > 0 ? totalVolume / trades.length : 0

      return NextResponse.json({
        platform,
        ticker,
        trades,
        cursor: nextCursor,
        stats: {
          totalTrades: trades.length,
          totalVolume,
          avgTradeSize,
          buyVolume: trades
            .filter(t => t.takerSide === 'yes')
            .reduce((sum, t) => sum + (t.yesPrice * t.count), 0),
          sellVolume: trades
            .filter(t => t.takerSide === 'no')
            .reduce((sum, t) => sum + (t.noPrice * t.count), 0),
        }
      })
    }

    throw new ApiError(400, 'Platform not supported', ErrorCodes.INVALID_PLATFORM)
  })
)
