import { NextRequest, NextResponse } from 'next/server'

// In-memory fallback for rate limiting (only used when Redis is unavailable)
const rateLimitMap = new Map<string, { count: number; lastReset: number }>()

const DEFAULT_WINDOW_MS = 60 * 1000 // 1 minute

function getEnvInt(name: string, fallback: number): number {
    const raw = process.env[name]
    if (!raw) return fallback
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const isProd = process.env.NODE_ENV === 'production'
const windowMs = getEnvInt('RATE_LIMIT_WINDOW_MS', DEFAULT_WINDOW_MS)
const pageLimit = getEnvInt('RATE_LIMIT_MAX_PER_MINUTE', isProd ? 300 : 1000)
const apiLimit = getEnvInt('RATE_LIMIT_API_MAX_PER_MINUTE', isProd ? 2000 : 2000)
const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED?.toLowerCase() !== 'false'

/**
 * In-memory rate limiting (fixed window)
 * Note: Redis-based rate limiting removed due to Edge runtime incompatibility
 * For production with Redis, implement rate limiting in API routes or use a separate service
 */
function rateLimitMemory(key: string, limit: number, windowMs: number): {
    allowed: boolean
    remaining: number
    resetAt: number
} {
    const now = Date.now()
    const record = rateLimitMap.get(key) || { count: 0, lastReset: now }

    // Reset window if needed
    if (now - record.lastReset > windowMs) {
        record.count = 0
        record.lastReset = now
    }

    record.count++
    rateLimitMap.set(key, record)

    const allowed = record.count <= limit
    const remaining = Math.max(0, limit - record.count)
    const resetAt = record.lastReset + windowMs

    return { allowed, remaining, resetAt }
}

/**
 * Rate limiting middleware with Redis support
 */
export async function rateLimit(req: NextRequest) {
    if (!rateLimitEnabled) return null

    // EXEMPT: Auth routes and static files
    const pathname = req.nextUrl.pathname
    if (
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/_next') ||
        pathname.includes('/favicon') ||
        pathname.startsWith('/public')
    ) {
        return null
    }

    // Use IP address as the key
    const forwardedFor = req.headers.get('x-forwarded-for')
    const ip = forwardedFor?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'

    const isApiRequest = pathname.startsWith('/api/')
    const bucket = isApiRequest ? 'api' : 'page'
    const key = `rate_limit:${ip}:${bucket}`
    const limit = isApiRequest ? apiLimit : pageLimit

    let result: { allowed: boolean; remaining: number; resetAt: number }

    // Edge runtime doesn't support Redis (ioredis), so always use memory
    // In production, use a Node.js runtime middleware or separate rate limiting service
    result = rateLimitMemory(key, limit, windowMs)

    // Return 429 if limit exceeded
    if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
        return new NextResponse(
            JSON.stringify({
                error: 'Too many requests. Please try again later.',
                code: 429,
                retryAfter
            }),
            {
                status: 429,
                headers: {
                    'content-type': 'application/json',
                    'Retry-After': retryAfter.toString(),
                    'X-RateLimit-Limit': limit.toString(),
                    'X-RateLimit-Remaining': result.remaining.toString(),
                    'X-RateLimit-Reset': result.resetAt.toString()
                }
            }
        )
    }

    return null
}

/**
 * Maintenance: Clean up old entries from the map to prevent memory leaks
 */
setInterval(() => {
    const now = Date.now()
    const keysToDelete: string[] = []
    rateLimitMap.forEach((record, ip) => {
        if (now - record.lastReset > windowMs * 2) {
            keysToDelete.push(ip)
        }
    })
    keysToDelete.forEach(key => rateLimitMap.delete(key))
}, windowMs * 5)
