import { NextRequest, NextResponse } from 'next/server'
import { KalshiClient } from '@/lib/api/kalshi'
import { withAuth, withErrorHandler, ApiError } from '@/lib/api/middleware'
import { ErrorCodes } from '@/lib/api/error-codes'
import { prisma } from '@/lib/db/client'
import { decrypt } from '@/lib/utils/encryption'
import { KalshiFillsQuerySchema } from '@/lib/api/schemas'
import { validateQuery } from '@/lib/api/validate'

export const GET = withErrorHandler(
  withAuth(async (userId: string, request: NextRequest) => {
    const searchParams = request.nextUrl.searchParams
    const params = validateQuery(KalshiFillsQuerySchema, searchParams)

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
    const kalshi = new KalshiClient({
      accessKeyId,
      privateKey,
    })

    const data = await kalshi.getFills({
      ticker: params.ticker,
      orderId: undefined, // Not in schema yet
      minTs: undefined, // Not in schema yet
      maxTs: undefined, // Not in schema yet
      limit: params.limit,
      cursor: params.cursor,
    })

    return NextResponse.json(data)
  })
)
