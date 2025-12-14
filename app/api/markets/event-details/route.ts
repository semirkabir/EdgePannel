import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { KalshiClient } from '@/lib/api/kalshi'
import { PolymarketClient } from '@/lib/api/polymarket'
import { decrypt } from '@/lib/utils/encryption'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform') || 'kalshi'
    const eventId = searchParams.get('eventId')
    const ticker = searchParams.get('ticker')
    const slug = searchParams.get('slug')

    // Polymarket: fetch event details by slug
    if (platform === 'polymarket' && slug) {
      const client = new PolymarketClient()

      try {
        const eventData = await client.getEventDetails(slug)
        return NextResponse.json({ eventData })
      } catch (error: any) {
        console.error('[Polymarket Event Details] Error:', error.message || error)
        return NextResponse.json({ eventData: null })
      }
    }

    // Kalshi: fetch event details by ticker or eventId
    if (!eventId && !ticker) {
      return NextResponse.json({ error: 'eventId/ticker (Kalshi) or slug (Polymarket) is required' }, { status: 400 })
    }

    // Get user's Kalshi API keys
    let apiKeyRecord
    try {
      apiKeyRecord = await prisma.apiKey.findUnique({
        where: {
          userId_platform: {
            userId: session.user.id,
            platform: 'kalshi',
          },
        },
      })
    } catch (dbError: any) {
      console.error('Database error:', dbError)
      return NextResponse.json({ eventData: null })
    }

    if (!apiKeyRecord || !apiKeyRecord.encryptedKeyData) {
      console.log('[Kalshi Event Details] No API keys found for user:', session.user.id)
      return NextResponse.json({ eventData: null })
    }

    let accessKeyId: string
    let privateKey: string

    try {
      accessKeyId = decrypt(apiKeyRecord.encryptedKey)
      privateKey = decrypt(apiKeyRecord.encryptedKeyData)
    } catch (decryptError: any) {
      console.error('Error decrypting API keys:', decryptError)
      return NextResponse.json({ eventData: null })
    }

    try {
      const client = new KalshiClient({ accessKeyId, privateKey })

      console.log(`[Kalshi Event Details] Fetching event details for ${eventId || ticker}`)
      const eventData = await client.getEventDetails(eventId || ticker!)
      console.log(`[Kalshi Event Details] Successfully fetched event details`)

      return NextResponse.json({ eventData })
    } catch (apiError: any) {
      console.error('[Kalshi Event Details] Error calling API:', apiError.message || apiError)
      return NextResponse.json({ eventData: null })
    }
  } catch (error: any) {
    console.error('Error fetching Kalshi event details:', error)
    return NextResponse.json({ eventData: null })
  }
}
