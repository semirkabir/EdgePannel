import { NextRequest, NextResponse } from 'next/server'
import { withAuth, withErrorHandler, validateBody, ApiError } from '@/lib/api/middleware'
import { ApiKeySchema } from '@/lib/api/schemas'
import { ErrorCodes } from '@/lib/api/error-codes'
import { encrypt } from '@/lib/utils/encryption'
import { rotateApiKey } from '@/lib/api-key/rotation'
import { getRateLimitConfig } from '@/lib/api/rate-limit-config'
import { z } from 'zod'

const RotateApiKeySchema = z.object({
  apiKeyId: z.string().min(1),
  platform: z.enum(['polymarket', 'kalshi']),
  apiKey: z.string().optional(),
  accessKeyId: z.string().optional(),
  privateKey: z.string().optional(),
}).refine(
  (data) => {
    if (data.platform === 'polymarket') {
      return !!data.apiKey
    } else {
      return !!(data.accessKeyId && data.privateKey)
    }
  },
  {
    message: 'Missing required keys for platform',
  }
)

export const POST = withErrorHandler(
  withAuth(
    async (userId: string, request: NextRequest) => {
      const body = await request.json()
      const { apiKeyId, platform, apiKey, accessKeyId, privateKey } = validateBody(RotateApiKeySchema, body)

      const encryptedKey = platform === 'polymarket'
        ? encrypt(apiKey!)
        : encrypt(accessKeyId!)

      const encryptedKeyData = platform === 'kalshi'
        ? encrypt(privateKey!)
        : null

      await rotateApiKey(apiKeyId, encryptedKey, encryptedKeyData, userId, request)

      return NextResponse.json({
        success: true,
        message: 'API key rotated successfully',
      })
    },
    getRateLimitConfig('/api/user/api-keys')
  )
)

