import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory cache for rate limiting
// Note: This only works on a per-instance basis. For distributed scaling, use Redis.
const rateLimitMap = new Map<string, { count: number; lastReset: number }>()

const LIMIT = 100 // requests
const WINDOW = 60 * 1000 // 1 minute in milliseconds

/**
 * Basic rate limiting middleware
 */
export async function rateLimit(req: NextRequest) {
    // Use IP address as the key
    const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown'
    const now = Date.now()

    const record = rateLimitMap.get(ip) || { count: 0, lastReset: now }

    // Reset window if needed
    if (now - record.lastReset > WINDOW) {
        record.count = 0
        record.lastReset = now
    }

    record.count++
    rateLimitMap.set(ip, record)

    // If limit exceeded
    if (record.count > LIMIT) {
        return new NextResponse(
            JSON.stringify({
                error: 'Too many requests. Please try again later.',
                code: 429,
                retryAfter: Math.ceil((WINDOW - (now - record.lastReset)) / 1000)
            }),
            {
                status: 429,
                headers: {
                    'content-type': 'application/json',
                    'Retry-After': Math.ceil((WINDOW - (now - record.lastReset)) / 1000).toString()
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
        if (now - record.lastReset > WINDOW * 2) {
            rateLimitMap.delete(ip)
        }
    }
}, WINDOW * 5)
