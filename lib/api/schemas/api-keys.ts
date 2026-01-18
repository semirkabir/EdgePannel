import { z } from 'zod'
import { PlatformSchema } from './common'

/**
 * API key management validation schemas
 */

// API Key creation/update
export const ApiKeySchema = z.object({
  platform: PlatformSchema,
  apiKey: z.string().trim().min(1).optional(),
  accessKeyId: z.string().trim().min(1).optional(),
  privateKey: z.string().trim().min(1).optional(),
}).refine(
  (data) => {
    if (data.platform === 'polymarket') {
      return !!data.apiKey && data.apiKey.length > 0
    }
    if (data.platform === 'kalshi') {
      return !!data.accessKeyId && !!data.privateKey &&
             data.accessKeyId.length > 0 && data.privateKey.length > 0
    }
    return false
  },
  {
    message: 'Invalid API key combination for platform. Polymarket requires apiKey, Kalshi requires accessKeyId and privateKey',
  }
)

// API Key deletion query
export const DeleteApiKeyQuerySchema = z.object({
  platform: PlatformSchema,
})

// API Key rotation body
export const RotateApiKeySchema = z.object({
  platform: PlatformSchema,
  newApiKey: z.string().trim().min(1).optional(),
  newAccessKeyId: z.string().trim().min(1).optional(),
  newPrivateKey: z.string().trim().min(1).optional(),
}).refine(
  (data) => {
    if (data.platform === 'polymarket') {
      return !!data.newApiKey && data.newApiKey.length > 0
    }
    if (data.platform === 'kalshi') {
      return !!data.newAccessKeyId && !!data.newPrivateKey &&
             data.newAccessKeyId.length > 0 && data.newPrivateKey.length > 0
    }
    return false
  },
  {
    message: 'Invalid API key combination for platform rotation',
  }
)
