import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { KalshiClient } from '@/lib/api/kalshi'
import { PolymarketClient } from '@/lib/api/polymarket'
import { decrypt } from '@/lib/utils/encryption'
import { withAuth, withErrorHandler, validateBody, ApiError } from '@/lib/api/middleware'
import { TradeOrderSchema } from '@/lib/api/schemas'
import { ErrorCodes } from '@/lib/api/error-codes'
import { logger } from '@/lib/utils/logger'
import { getRateLimitConfig } from '@/lib/api/rate-limit-config'
import { auditLogFromRequest } from '@/lib/audit/audit-logger'

export const POST = withErrorHandler(
  withAuth(
    async (userId: string, request: NextRequest) => {
      const body = await request.json()
      const order = validateBody(TradeOrderSchema, body)

      logger.logRequest('POST', '/api/trading', userId, { platform: order.platform })

      // Get user's API keys for the platform
      const apiKeyRecord = await prisma.apiKey.findUnique({
        where: {
          userId_platform: {
            userId: userId,
            platform: order.platform,
          },
        },
      })

      if (!apiKeyRecord) {
        throw new ApiError(
          400,
          `${order.platform} API keys not configured`,
          ErrorCodes.API_KEYS_NOT_CONFIGURED
        )
      }

      let result: { order_id?: string; id?: string }

      if (order.platform === 'kalshi') {
        if (!apiKeyRecord.encryptedKeyData) {
          throw new ApiError(
            400,
            'Kalshi private key not configured',
            ErrorCodes.KALSHI_PRIVATE_KEY_MISSING
          )
        }

      const accessKeyId = decrypt(apiKeyRecord.encryptedKey)
      const privateKey = decrypt(apiKeyRecord.encryptedKeyData)
      const client = new KalshiClient({ accessKeyId, privateKey })

      result = await client.createOrder({
        ticker: order.marketId,
        side: order.side === 'buy' ? 'yes' : 'no',
        action: order.side,
        count: order.quantity,
        type: order.orderType,
        price: order.price ? Math.round(order.price * 100) : undefined,
      })
    } else if (order.platform === 'polymarket') {
      const apiKey = decrypt(apiKeyRecord.encryptedKey)
      const client = new PolymarketClient({ apiKey })

      result = await client.createOrder({
        market: order.marketId,
        side: order.side,
        size: order.quantity.toString(),
        price: order.price?.toString() || '0',
        type: order.orderType === 'limit' ? 'LIMIT' : 'MARKET',
      })
    } else {
      throw new ApiError(400, 'Invalid platform', ErrorCodes.INVALID_PLATFORM)
    }

    // Save trade to database
    const trade = await prisma.trade.create({
      data: {
        userId: userId,
        platform: order.platform,
        marketId: order.marketId,
        marketTitle: order.marketId, // Will be updated with actual title
        side: order.side,
        quantity: order.quantity,
        price: order.price || 0,
        totalAmount: order.quantity * (order.price || 0),
        status: 'pending',
        orderId: result.order_id || result.id || null,
      },
    })

    logger.info('Trade executed', { 
      userId: userId.substring(0, 8) + '...',
      platform: order.platform,
      orderId: result.order_id || result.id 
    })

    // Audit log
    await auditLogFromRequest(request, {
      userId,
      action: 'TRADE_EXECUTED',
      resource: 'trade',
      resourceId: trade.id,
      details: {
        platform: order.platform,
        marketId: order.marketId,
        side: order.side,
        quantity: order.quantity,
        price: order.price,
        orderId: result.order_id || result.id,
      },
      status: 'SUCCESS',
    })

    return NextResponse.json({ 
      success: true, 
      data: { order: result } 
    })
    },
    getRateLimitConfig('/api/trading')
  )
)



