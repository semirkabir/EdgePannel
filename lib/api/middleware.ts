import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AUTH_ENABLED, MOCK_USER_ID } from '@/lib/auth-config'
import { z } from 'zod'
import { ErrorCodes, type ErrorCode } from './error-codes'
import { logger } from '@/lib/utils/logger'
import { getRateLimitConfig } from './rate-limit-config'

/**
 * API Error Response
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: ErrorCode = ErrorCodes.INTERNAL_ERROR,
    public details?: unknown,
    public retryAfter?: number
  ) {
    super(message)
    this.name = 'ApiError'
  }

  toResponse() {
    return NextResponse.json(
      {
        error: this.message,
        code: this.code,
        ...(this.retryAfter ? { retryAfter: this.retryAfter } : {}),
        ...(process.env.NODE_ENV === 'development' && this.details ? { details: this.details } : {}),
      },
      { status: this.statusCode }
    )
  }
}

/**
 * Get authenticated user ID
 * Returns user ID or throws ApiError if unauthorized
 */
export async function getUserId(request?: NextRequest): Promise<string> {
  if (!AUTH_ENABLED) {
    return MOCK_USER_ID
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new ApiError(401, 'Unauthorized', ErrorCodes.UNAUTHORIZED)
  }

  return session.user.id
}

/**
 * Validate request body against Zod schema
 */
export function validateBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown
): z.infer<T> {
  try {
    return schema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError(
        400,
        'Invalid request body',
        ErrorCodes.VALIDATION_ERROR,
        error.errors
      )
    }
    throw error
  }
}

/**
 * Validate query parameters against Zod schema
 */
export function validateQuery<T extends z.ZodTypeAny>(
  schema: T,
  searchParams: URLSearchParams
): z.infer<T> {
  const params: Record<string, string | undefined> = {}
  searchParams.forEach((value, key) => {
    params[key] = value || undefined
  })

  try {
    return schema.parse(params)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError(
        400,
        'Invalid query parameters',
        ErrorCodes.VALIDATION_ERROR,
        error.errors
      )
    }
    throw error
  }
}

/**
 * Wrapper for API route handlers with error handling
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<Response>>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args)
    } catch (error) {
      if (error instanceof ApiError) {
        return error.toResponse()
      }

      // Log unexpected errors with structured logging
      logger.error(
        'Unexpected API error',
        error instanceof Error ? error : new Error(String(error)),
        {
          handler: handler.name || 'unknown',
        }
      )

      return NextResponse.json(
        {
          error: 'Internal server error',
          code: ErrorCodes.INTERNAL_ERROR,
          ...(process.env.NODE_ENV === 'development' && {
            details: error instanceof Error ? error.message : String(error),
          }),
        },
        { status: 500 }
      )
    }
  }) as T
}

/**
 * Wrapper for authenticated API route handlers
 * Automatically applies rate limiting based on endpoint configuration
 */
export function withAuth<T extends (userId: string, request: NextRequest, ...args: any[]) => Promise<Response>>(
  handler: T,
  rateLimitConfig?: { maxRequests: number; windowMs: number; perUser?: boolean }
) {
  const wrappedHandler = withErrorHandler(async (request: NextRequest, ...args: any[]) => {
    const userId = await getUserId(request)

    // Apply rate limiting if configured
    if (rateLimitConfig) {
      const identifier = rateLimitConfig.perUser
        ? userId
        : request.headers.get('x-forwarded-for')?.split(',')[0] ||
        request.headers.get('x-real-ip') ||
        'unknown'

      if (!rateLimit(identifier, rateLimitConfig.maxRequests, rateLimitConfig.windowMs)) {
        throw new ApiError(
          429,
          'Too many requests',
          ErrorCodes.RATE_LIMIT_EXCEEDED,
          { retryAfter: rateLimitConfig.windowMs / 1000 },
          rateLimitConfig.windowMs / 1000
        )
      }
    }

    return handler(userId, request, ...args)
  })

  return wrappedHandler
}

/**
 * Rate limiting (simple in-memory implementation)
 * For production, use Redis or a dedicated service
 * 
 * TODO: Migrate to Redis for production
 * - Use Redis for distributed rate limiting
 * - Persist across server restarts
 * - Better for multi-instance deployments
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute
): boolean {
  const now = Date.now()
  const key = identifier
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (record.count >= maxRequests) {
    return false
  }

  record.count++
  return true
}

/**
 * Get rate limit status (for debugging/monitoring)
 */
export function getRateLimitStatus(identifier: string): {
  count: number
  resetAt: number
  remaining: number
  isLimited: boolean
} | null {
  const record = rateLimitStore.get(identifier)
  if (!record) {
    return null
  }

  const now = Date.now()
  const isLimited = now < record.resetAt && record.count >= 100 // Assuming default maxRequests

  return {
    count: record.count,
    resetAt: record.resetAt,
    remaining: Math.max(0, 100 - record.count), // Assuming default maxRequests
    isLimited,
  }
}

/**
 * Middleware to apply rate limiting
 * Supports both IP-based and user-based rate limiting
 */
export function withRateLimit(
  maxRequests: number = 100,
  windowMs: number = 60000,
  perUser: boolean = false
) {
  return (handler: (userId: string, request: NextRequest, ...args: any[]) => Promise<Response>) => {
    return withErrorHandler(async (userId: string, request: NextRequest, ...args: any[]) => {
      // Get identifier (IP address or user ID)
      const identifier = perUser
        ? userId
        : request.headers.get('x-forwarded-for')?.split(',')[0] ||
        request.headers.get('x-real-ip') ||
        'unknown'

      if (!rateLimit(identifier, maxRequests, windowMs)) {
        throw new ApiError(
          429,
          'Too many requests',
          ErrorCodes.RATE_LIMIT_EXCEEDED,
          { retryAfter: windowMs / 1000 },
          windowMs / 1000
        )
      }

      return handler(userId, request, ...args)
    })
  }
}

/**
 * Rate limiting wrapper that doesn't require auth
 * For public endpoints
 */
export function withPublicRateLimit(
  maxRequests: number = 100,
  windowMs: number = 60000
) {
  return (handler: (request: NextRequest, ...args: any[]) => Promise<Response>) => {
    return withErrorHandler(async (request: NextRequest, ...args: any[]) => {
      // Get identifier (IP address)
      const identifier =
        request.headers.get('x-forwarded-for')?.split(',')[0] ||
        request.headers.get('x-real-ip') ||
        'unknown'

      if (!rateLimit(identifier, maxRequests, windowMs)) {
        throw new ApiError(
          429,
          'Too many requests',
          ErrorCodes.RATE_LIMIT_EXCEEDED,
          { retryAfter: windowMs / 1000 },
          windowMs / 1000
        )
      }

      return handler(request, ...args)
    })
  }
}

