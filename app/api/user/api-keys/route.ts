import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { encrypt } from '@/lib/utils/encryption'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
          userId: session.user.id,
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
        userId: session.user.id,
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
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKeys = await prisma.apiKey.findMany({
      where: {
        userId: session.user.id,
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

