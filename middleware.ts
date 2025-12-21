import { withAuth } from "next-auth/middleware"
import type { NextRequestWithAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import type { NextRequest, NextFetchEvent } from "next/server"
import { applySecurityHeaders } from "@/lib/middleware/security-headers"
import { antiScrapeMiddleware } from "@/lib/middleware/bot-detection"
import { rateLimit } from "@/lib/middleware/rate-limit"

import { AUTH_ENABLED } from "@/lib/auth-config"

// Create auth middleware
const authMiddleware = AUTH_ENABLED ? withAuth({
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized: ({ token, req }) => {
      // Always authorized for root path and other public paths
      const { pathname } = req.nextUrl
      if (
        pathname === '/' ||
        pathname.startsWith('/api/auth') ||
        pathname === '/login' ||
        pathname === '/register'
      ) {
        return true
      }
      return !!token
    },
  },
}) : undefined

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  // 1. Anti-scraping check
  const botResponse = antiScrapeMiddleware(req)
  if (botResponse) return applySecurityHeaders(botResponse)

  // 2. Rate limiting
  const ratelimitResponse = await rateLimit(req)
  if (ratelimitResponse) return applySecurityHeaders(ratelimitResponse)

  // 3. Exemption check
  const isPublicPath =
    req.nextUrl.pathname === '/' ||
    req.nextUrl.pathname.startsWith('/api/auth') ||
    req.nextUrl.pathname.startsWith('/api/cron') ||
    req.nextUrl.pathname.startsWith('/api/public') ||
    req.nextUrl.pathname.startsWith('/api/markets/search') ||
    req.nextUrl.pathname.startsWith('/api/markets/analytics') ||
    req.nextUrl.pathname === '/login' ||
    req.nextUrl.pathname === '/register'

  console.log(`[Middleware] ${req.nextUrl.pathname} - isPublic: ${isPublicPath} - AUTH_ENABLED: ${AUTH_ENABLED}`)

  // 4. Authentication
  let response: NextResponse | undefined

  if (authMiddleware && !isPublicPath) {
    // @ts-ignore
    const authResult = await authMiddleware(req as NextRequestWithAuth, event)

    // If authMiddleware decided to redirect (e.g. to /login)
    if (authResult instanceof NextResponse) {
      // If it's an API request, return 401 instead of redirecting to a HTML page
      if (req.nextUrl.pathname.startsWith('/api/')) {
        return applySecurityHeaders(new NextResponse(
          JSON.stringify({ error: 'Unauthorized. Please log in.', code: 401 }),
          { status: 401, headers: { 'content-type': 'application/json' } }
        ))
      }
      response = authResult
    }
  } else if (!AUTH_ENABLED && (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/register')) {
    // If auth is disabled and we're on login/register, go home
    return NextResponse.redirect(new URL('/', req.url))
  }

  if (!response) {
    response = NextResponse.next()
  }

  // 5. CSRF / Origin validation for APIs
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const origin = req.headers.get('origin')
    const host = req.headers.get('host')

    // Validate origin if present (proper CORS check)
    if (origin && host) {
      try {
        const originUrl = new URL(origin)
        const expectedOrigins = [
          `https://${host}`,
          `http://${host}`, // Allow HTTP for local development
        ]

        // In development, also allow localhost variations
        if (process.env.NODE_ENV !== 'production') {
          expectedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000')
        }

        const isAllowedOrigin = expectedOrigins.some(allowed => {
          try {
            const allowedUrl = new URL(allowed)
            return originUrl.protocol === allowedUrl.protocol &&
              originUrl.host === allowedUrl.host
          } catch {
            return false
          }
        })

        if (!isAllowedOrigin) {
          return applySecurityHeaders(new NextResponse(
            JSON.stringify({ error: 'CORS policy violation. Access from this origin is not permitted.', code: 403 }),
            { status: 403, headers: { 'content-type': 'application/json' } }
          ))
        }
      } catch (error) {
        // Invalid origin URL format
        return applySecurityHeaders(new NextResponse(
          JSON.stringify({ error: 'Invalid origin header', code: 400 }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        ))
      }
    }
  }

  // Apply security headers to all responses
  return applySecurityHeaders(response)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
}




