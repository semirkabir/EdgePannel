import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"
import { rateLimit } from "@/lib/api/middleware"
import { NextRequest, NextResponse } from "next/server"

const handler = NextAuth(authOptions)

// Rate limiting wrapper for NextAuth
// Note: Rate limiting is also handled in lib/auth.ts authorize function
// This provides additional IP-based protection
async function rateLimitedHandler(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  // Only rate limit on signin attempts (not callbacks, etc.)
  const isSignIn = request.url.includes('/signin') || 
                   request.method === 'POST' && 
                   (await request.clone().json().catch(() => ({}))).email

  if (isSignIn) {
    // Get client identifier for rate limiting
    const identifier =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown'

    // Stricter rate limiting for auth endpoints: 5 attempts per 15 minutes
    if (!rateLimit(identifier, 5, 15 * 60 * 1000)) {
      return NextResponse.json(
        {
          error: 'Too many authentication attempts',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: 900, // 15 minutes in seconds
        },
        { status: 429 }
      )
    }
  }

  // Call NextAuth handler
  return handler(request, context)
}

export { rateLimitedHandler as GET, rateLimitedHandler as POST }
