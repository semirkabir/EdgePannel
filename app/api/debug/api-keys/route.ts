import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'

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
        encryptedKey: true,
      },
    })

    // Check if keys exist (without exposing them)
    const keysStatus = apiKeys.map(key => ({
      platform: key.platform,
      isActive: key.isActive,
      hasKey: !!key.encryptedKey, // If record exists, key exists
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    }))

    return NextResponse.json({
      userId: session.user.id,
      apiKeys: keysStatus,
      totalKeys: apiKeys.length,
    })
  } catch (error: any) {
    console.error('Error fetching API keys debug info:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch API keys' },
      { status: 500 }
    )
  }
}



