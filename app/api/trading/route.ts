import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { KalshiClient } from '@/lib/api/kalshi'
import { PolymarketClient } from '@/lib/api/polymarket'
import { decrypt } from '@/lib/utils/encryption'
import { TradeOrder } from '@/types/trading'
import { AUTH_ENABLED, MOCK_USER_ID } from '@/lib/auth-config'

export async function POST(request: Request) {
  try {
    // Get user ID - use mock if auth is disabled
    let userId: string
    if (AUTH_ENABLED) {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = session.user.id
    } else {
      userId = MOCK_USER_ID
    }

    const order: TradeOrder = await request.json()

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
      return NextResponse.json(
        { error: `${order.platform} API keys not configured` },
        { status: 400 }
      )
    }

    let result: any

    if (order.platform === 'kalshi') {
      if (!apiKeyRecord.encryptedKeyData) {
        return NextResponse.json(
          { error: 'Kalshi private key not configured' },
          { status: 400 }
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
      return NextResponse.json(
        { error: 'Invalid platform' },
        { status: 400 }
      )
    }

    // Save trade to database
    await prisma.trade.create({
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
        orderId: result.order_id || result.id,
      },
    })

    return NextResponse.json({ success: true, order: result })
  } catch (error: any) {
    console.error('Error executing trade:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to execute trade' },
      { status: 500 }
    )
  }
}

