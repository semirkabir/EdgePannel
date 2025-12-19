import { NextRequest, NextResponse } from 'next/server'

/**
 * List of known bot/scraper user agents to block
 */
const BLOCKED_USER_AGENTS = [
    'axios',
    'python-requests',
    'node-fetch',
    'got',
    'scraper',
    'crawler',
    'spider',
    'bot',
    'headless',
    'selenium',
    'puppeteer',
    'curl',
    'wget',
    'postmanruntime',
    'insomnia',
    'go-http-client',
    'java',
    'perl',
    'php',
    'ruby',
]

/**
 * Checks if a request is coming from a bot or scraper
 */
export function isBot(req: NextRequest): boolean {
    const userAgent = req.headers.get('user-agent')?.toLowerCase() || ''

    if (!userAgent) return true // Block empty user agents as they are usually scripts

    return BLOCKED_USER_AGENTS.some(bot => userAgent.includes(bot)) &&
        !userAgent.includes('mozilla') &&
        !userAgent.includes('applewebkit') &&
        !userAgent.includes('safari') &&
        !userAgent.includes('chrome')
}

/**
 * Anti-scraping middleware
 */
export function antiScrapeMiddleware(req: NextRequest) {
    // 1. Check User Agent
    if (isBot(req)) {
        return new NextResponse(
            JSON.stringify({ error: 'Access denied. Bots and scrapers are not permitted.', code: 403 }),
            { status: 403, headers: { 'content-type': 'application/json' } }
        )
    }

    // 2. Check for missing headers typically present in browsers
    const acceptLanguage = req.headers.get('accept-language')
    const secFetchDest = req.headers.get('sec-fetch-dest')

    // If it's an API request and missing common browser headers, it might be a script
    // We allow it if it has an auth token, handle that in top-level middleware

    return null
}
