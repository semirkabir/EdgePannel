import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { encrypt } from '@/lib/utils/encryption'
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

    const { platform, apiKey, accessKeyId, privateKey } = await request.json()

    if (platform !== 'polymarket' && platform !== 'kalshi') {
      return NextResponse.json(
        { error: 'Invalid platform' },
        { status: 400 }
      )
    }

    if (platform === 'polymarket' && !apiKey) {
      return NextResponse.json(
        { error: 'API key is required for Polymarket' },
        { status: 400 }
      )
    }

    if (platform === 'kalshi' && (!accessKeyId || !privateKey)) {
      return NextResponse.json(
        { error: 'Access Key ID and Private Key are required for Kalshi' },
        { status: 400 }
      )
    }

    const encryptedKey = platform === 'polymarket'
      ? encrypt(apiKey)
      : encrypt(accessKeyId)

    const encryptedKeyData = platform === 'kalshi'
      ? encrypt(privateKey)
      : null

    await prisma.apiKey.upsert({
      where: {
        userId_platform: {
          userId: userId,
          platform,
        },
      },
      update: {
        encryptedKey,
        encryptedKeyData,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId: userId,
        platform,
        encryptedKey,
        encryptedKeyData,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error saving API keys:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save API keys' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
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

    const apiKeys = await prisma.apiKey.findMany({
      where: {
        userId: userId,
      },
      select: {
        id: true,
        platform: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ apiKeys })
  } catch (error: any) {
    console.error('Error fetching API keys:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch API keys' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')

    if (!platform || (platform !== 'polymarket' && platform !== 'kalshi')) {
      return NextResponse.json(
        { error: 'Invalid platform. Must be "polymarket" or "kalshi"' },
        { status: 400 }
      )
    }

    await prisma.apiKey.delete({
      where: {
        userId_platform: {
          userId: userId,
          platform: platform as 'polymarket' | 'kalshi',
        },
      },
    })

    return NextResponse.json({ success: true, message: 'API key deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting API key:', error)
    
    // If key doesn't exist, that's okay - return success
    if (error.code === 'P2025') {
      return NextResponse.json({ success: true, message: 'API key not found (already deleted)' })
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to delete API key' },
      { status: 500 }
    )
  }
}

