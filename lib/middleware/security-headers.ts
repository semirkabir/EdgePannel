/**
 * Security headers middleware
 * Adds security headers to all responses
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Security headers configuration
 */
const securityHeaders = {
  'X-DNS-Prefetch-Control': 'on',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // Content Security Policy - adjust based on your needs
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:",
    "style-src 'self' 'unsafe-inline' https://api.maptiler.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.polymarket.com https://*.kalshi.com https://*.kalshi.co https://raw.githubusercontent.com https://api.maptiler.com https://nominatim.openstreetmap.org wss://ws-subscriptions-clob.polymarket.com wss://*.kalshi.co wss://*.kalshi.com",
    "worker-src 'self' blob:",
    "frame-ancestors 'self'",
  ].join('; '),
}

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

/**
 * Middleware wrapper to add security headers
 */
export function withSecurityHeaders(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const response = await handler(request)
    return applySecurityHeaders(response)
  }
}

