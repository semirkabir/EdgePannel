import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory cache for rate limiting
// Note: This only works on a per-instance basis. For distributed scaling, use Redis.
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
 * Basic rate limiting middleware
 */
export async function rateLimit(req: NextRequest) {
    if (!rateLimitEnabled) return null

    // 1. Skip rate limiting in development or for specific routes if needed
    // However, it's better to keep it on but with higher limits to test the logic.

    // 2. EXEMPT: Auth routes and static files should never be rate limited by this middleware
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
    const now = Date.now()

    const isApiRequest = pathname.startsWith('/api/')
    const bucket = isApiRequest ? 'api' : 'page'
    const key = `${ip}:${bucket}`
    const record = rateLimitMap.get(key) || { count: 0, lastReset: now }

    // Reset window if needed
    if (now - record.lastReset > windowMs) {
        record.count = 0
        record.lastReset = now
    }

    record.count++
    rateLimitMap.set(key, record)

    // Higher limit in development to prevent issues during HMR/Refresh
    const limit = isApiRequest ? apiLimit : pageLimit
    if (record.count > limit) {
        return new NextResponse(
            JSON.stringify({
                error: 'Too many requests. Please try again later.',
                code: 429,
                retryAfter: Math.ceil((windowMs - (now - record.lastReset)) / 1000)
            }),
            {
                status: 429,
                headers: {
                    'content-type': 'application/json',
                    'Retry-After': Math.ceil((windowMs - (now - record.lastReset)) / 1000).toString()
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
    for (const [ip, record] of rateLimitMap.entries()) {
        if (now - record.lastReset > windowMs * 2) {
            rateLimitMap.delete(ip)
        }
    }
}, windowMs * 5)
