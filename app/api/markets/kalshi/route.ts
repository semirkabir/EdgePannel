import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { KalshiClient } from '@/lib/api/kalshi'
import { decrypt } from '@/lib/utils/encryption'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's Kalshi API keys
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: {
        userId_platform: {
          userId: session.user.id,
          platform: 'kalshi',
        },
      },
    })

    if (!apiKeyRecord || !apiKeyRecord.encryptedKeyData) {
      return NextResponse.json(
        { error: 'Kalshi API keys not configured' },
        { status: 400 }
      )
    }

    const accessKeyId = decrypt(apiKeyRecord.encryptedKey)
    const privateKey = decrypt(apiKeyRecord.encryptedKeyData)

    const client = new KalshiClient({ accessKeyId, privateKey })

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')

    const markets = await client.getMarkets({ limit })

    return NextResponse.json({ markets })
  } catch (error: any) {
    console.error('Error fetching Kalshi markets:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch markets' },
      { status: 500 }
    )
  }
}

