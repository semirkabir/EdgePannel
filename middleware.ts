import { withAuth } from "next-auth/middleware"
import type { NextRequestWithAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import type { NextRequest, NextFetchEvent } from "next/server"
import { applySecurityHeaders } from "@/lib/middleware/security-headers"

// Authentication middleware configuration
// In production, authentication should always be enabled
// Can be disabled in development via AUTH_ENABLED=false env var
const AUTH_ENABLED = process.env.NODE_ENV === 'production'
  ? true
  : (process.env.AUTH_ENABLED === 'true' || false)

// Warn if auth is disabled in production (should never happen)
if (process.env.NODE_ENV === 'production' && !AUTH_ENABLED) {
  console.error('⚠️  SECURITY WARNING: Authentication middleware is DISABLED in production!')
}

// Create auth middleware
const authMiddleware = AUTH_ENABLED ? withAuth({
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized: ({ token }) => {
      // Additional authorization checks can be added here
      return !!token
    },
  },
}) : undefined

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  let response: NextResponse | undefined

  if (authMiddleware) {
    // Apply authentication
    // @ts-ignore - NextAuth middleware typing can be tricky
    const authResult = await authMiddleware(req as NextRequestWithAuth, event)
    if (authResult instanceof NextResponse) {
      response = authResult
    }
  }

  if (!response) {
    response = NextResponse.next()
  }

  // Apply security headers to all responses
  return applySecurityHeaders(response)
}

export const config = {
  matcher: ["/dashboard/:path*", "/edge/:path*", "/admin/:path*", "/api/trading/:path*", "/api/user/:path*"],
}



