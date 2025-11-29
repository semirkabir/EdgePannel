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

    // Get user's Polymarket API key
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: {
        userId_platform: {
          userId: session.user.id,
          platform: 'polymarket',
        },
      },
    })

    if (!apiKeyRecord) {
      return NextResponse.json(
        { error: 'Polymarket API key not configured' },
        { status: 400 }
      )
    }

    const apiKey = decrypt(apiKeyRecord.encryptedKey)
    const client = new PolymarketClient({ apiKey })

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const markets = await client.getMarkets({ limit, offset })

    return NextResponse.json({ markets })
  } catch (error: any) {
    console.error('Error fetching Polymarket markets:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch markets' },
      { status: 500 }
    )
  }
}

