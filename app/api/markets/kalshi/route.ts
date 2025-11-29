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
      // If database connection fails, return empty markets instead of error
      return NextResponse.json({ markets: [] })
    }

    if (!apiKeyRecord || !apiKeyRecord.encryptedKeyData) {
      console.log('[Kalshi] No API keys found for user:', session.user.id)
      // Return empty markets instead of error - API keys not configured yet
      return NextResponse.json({ markets: [] })
    }

    console.log('[Kalshi] API keys found, attempting to decrypt...')

    let accessKeyId: string
    let privateKey: string
    
    try {
      accessKeyId = decrypt(apiKeyRecord.encryptedKey)
      privateKey = decrypt(apiKeyRecord.encryptedKeyData)
    } catch (decryptError: any) {
      console.error('Error decrypting API keys:', decryptError)
      return NextResponse.json({ markets: [] })
    }

    try {
      const client = new KalshiClient({ accessKeyId, privateKey })

      const { searchParams } = new URL(request.url)
      const limit = parseInt(searchParams.get('limit') || '100')

      console.log(`[Kalshi] Fetching markets (limit: ${limit})`)
      const markets = await client.getMarkets({ limit })
      console.log(`[Kalshi] Successfully fetched ${markets.length} markets`)

      return NextResponse.json({ markets })
    } catch (apiError: any) {
      console.error('[Kalshi] Error calling API:', apiError.message || apiError)
      console.error('[Kalshi] Error stack:', apiError.stack)
      // Return empty markets instead of error - API call failed
      return NextResponse.json({ markets: [] })
    }
  } catch (error: any) {
    console.error('Error fetching Kalshi markets:', error)
    // Return empty markets instead of 500 error
    return NextResponse.json({ markets: [] })
  }
}

