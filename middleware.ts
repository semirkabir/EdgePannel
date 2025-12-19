import { withAuth } from "next-auth/middleware"
import type { NextRequestWithAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import type { NextRequest, NextFetchEvent } from "next/server"
import { applySecurityHeaders } from "@/lib/middleware/security-headers"
import { antiScrapeMiddleware } from "@/lib/middleware/bot-detection"
import { rateLimit } from "@/lib/middleware/rate-limit"

// Authentication middleware configuration
// In production, authentication should always be enabled
const AUTH_ENABLED = process.env.NODE_ENV === 'production'
  ? true
  : (process.env.AUTH_ENABLED === 'true' || false)

// Create auth middleware
const authMiddleware = AUTH_ENABLED ? withAuth({
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized: ({ token }) => {
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
    req.nextUrl.pathname.startsWith('/api/auth') ||
    req.nextUrl.pathname.startsWith('/api/cron') ||
    req.nextUrl.pathname.startsWith('/api/public') ||
    req.nextUrl.pathname === '/login' ||
    req.nextUrl.pathname === '/register'

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
    "/dashboard/:path*",
    "/edge/:path*",
    "/admin/:path*",
    "/api/:path*" // Apply to ALL api routes now
  ],
}




