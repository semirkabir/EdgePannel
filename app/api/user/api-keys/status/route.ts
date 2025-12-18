import { NextRequest, NextResponse } from 'next/server'
import { withAuth, withErrorHandler, validateQuery, ApiError } from '@/lib/api/middleware'
import { ErrorCodes } from '@/lib/api/error-codes'
import { checkKeyRotationStatus } from '@/lib/api-key/rotation'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'

const StatusQuerySchema = z.object({
  apiKeyId: z.string().optional(),
  platform: z.enum(['polymarket', 'kalshi']).optional(),
})

export const GET = withErrorHandler(
  withAuth(async (userId: string, request: NextRequest) => {
    const params = validateQuery(StatusQuerySchema, request.nextUrl.searchParams)

    if (params.apiKeyId) {
      // Check specific key
      const apiKey = await prisma.apiKey.findUnique({
        where: { id: params.apiKeyId },
        select: {
          id: true,
          userId: true,
          platform: true,
        },
      })

      if (!apiKey) {
        throw new ApiError(404, 'API key not found', ErrorCodes.NOT_FOUND)
      }

      if (apiKey.userId !== userId) {
        throw new ApiError(403, 'Unauthorized', ErrorCodes.FORBIDDEN)
      }

      const status = await checkKeyRotationStatus(apiKey.id)
      return NextResponse.json({
        success: true,
        data: {
          apiKeyId: apiKey.id,
          platform: apiKey.platform,
          ...status,
        },
      })
    } else {
      // Get all keys for user with status
      const apiKeys = await prisma.apiKey.findMany({
        where: {
          userId,
          ...(params.platform && { platform: params.platform }),
        },
        select: {
          id: true,
          platform: true,
          isActive: true,
          expiresAt: true,
          nextRotationDate: true,
          rotationDate: true,
        },
      })

      const keysWithStatus = await Promise.all(
        apiKeys.map(async (key) => {
          const status = await checkKeyRotationStatus(key.id)
          return {
            ...key,
            ...status,
          }
        })
      )

      return NextResponse.json({
        success: true,
        data: {
          keys: keysWithStatus,
        },
      })
    }
  })
)

