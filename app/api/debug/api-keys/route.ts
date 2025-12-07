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
        // Don't return encrypted keys, just check if they exist
        encryptedKey: {
          select: {
            // Just check length to verify it exists
          }
        }
      },
    })

    // Check if keys exist (without exposing them)
    const keysStatus = apiKeys.map(key => ({
      platform: key.platform,
      isActive: key.isActive,
      hasKey: true, // If record exists, key exists
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



