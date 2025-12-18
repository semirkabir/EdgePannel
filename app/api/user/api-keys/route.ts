import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { encrypt } from '@/lib/utils/encryption'
import { withAuth, withErrorHandler, validateBody, ApiError } from '@/lib/api/middleware'
import { ApiKeySchema } from '@/lib/api/schemas'
import { ErrorCodes } from '@/lib/api/error-codes'
import { logger } from '@/lib/utils/logger'
import { getRateLimitConfig } from '@/lib/api/rate-limit-config'
import { auditLogFromRequest } from '@/lib/audit/audit-logger'
import { calculateNextRotationDate, calculateExpirationDate, checkKeyRotationStatus } from '@/lib/api-key/rotation'

export const POST = withErrorHandler(
  withAuth(
    async (userId: string, request: NextRequest) => {
      const body = await request.json()
      const { platform, apiKey, accessKeyId, privateKey } = validateBody(ApiKeySchema, body)

      const encryptedKey = platform === 'polymarket'
        ? encrypt(apiKey!)
        : encrypt(accessKeyId!)

      const encryptedKeyData = platform === 'kalshi'
        ? encrypt(privateKey!)
        : null

      // Log only non-sensitive information
      logger.info(`Saving ${platform} API keys`, {
        userId: userId.substring(0, 8) + '...',
        platform
      })

      // Check if this is an update or create
      const existing = await prisma.apiKey.findUnique({
        where: {
          userId_platform: {
            userId: userId,
            platform,
          },
        },
      })

      const isUpdate = !!existing

      const resolvedApiKey = await prisma.apiKey.upsert({
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
          // Set rotation dates if not already set
          nextRotationDate: existing?.nextRotationDate || calculateNextRotationDate(),
          expiresAt: existing?.expiresAt || calculateExpirationDate(),
          updatedAt: new Date(),
        },
        create: {
          userId: userId,
          platform,
          encryptedKey,
          encryptedKeyData,
          nextRotationDate: calculateNextRotationDate(),
          expiresAt: calculateExpirationDate(),
        },
      })

      // Audit log
      await auditLogFromRequest(request, {
        userId,
        action: isUpdate ? 'API_KEY_UPDATED' : 'API_KEY_CREATED',
        resource: 'api_key',
        resourceId: resolvedApiKey.id,
        details: {
          platform,
        },
      })

      logger.info(`Successfully saved ${platform} keys`)
      return NextResponse.json({ success: true })
    },
    getRateLimitConfig('/api/user/api-keys')
  )
)

export const GET = withErrorHandler(
  withAuth(async (userId: string) => {
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
        expiresAt: true,
        nextRotationDate: true,
        rotationDate: true,
      },
    })

    // Add rotation status for each key
    const keysWithStatus = await Promise.all(
      apiKeys.map(async (key) => {
        const status = await checkKeyRotationStatus(key.id)
        return {
          ...key,
          rotationStatus: status,
        }
      })
    )

    return NextResponse.json({ apiKeys: keysWithStatus })
  })
)

export const DELETE = withErrorHandler(
  withAuth(async (userId: string, request: NextRequest) => {
    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')

    if (!platform || (platform !== 'polymarket' && platform !== 'kalshi')) {
      throw new ApiError(400, 'Invalid platform. Must be "polymarket" or "kalshi"', ErrorCodes.INVALID_PLATFORM)
    }

    try {
      const apiKey = await prisma.apiKey.findUnique({
        where: {
          userId_platform: {
            userId: userId,
            platform: platform as 'polymarket' | 'kalshi',
          },
        },
      })

      if (apiKey) {
        await prisma.apiKey.delete({
          where: {
            userId_platform: {
              userId: userId,
              platform: platform as 'polymarket' | 'kalshi',
            },
          },
        })

        // Audit log
        await auditLogFromRequest(request, {
          userId,
          action: 'API_KEY_DELETED',
          resource: 'api_key',
          resourceId: apiKey.id,
          details: {
            platform,
          },
        })
      }

      return NextResponse.json({ success: true, message: 'API key deleted successfully' })
    } catch (error: unknown) {
      // If key doesn't exist, that's okay - return success
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
        return NextResponse.json({ success: true, message: 'API key not found (already deleted)' })
      }
      throw error
    }
  })
)

