import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// TEMPORARILY DISABLED: Set to false to disable authentication
const AUTH_ENABLED = false

// Bypass middleware when auth is disabled
export default AUTH_ENABLED ? withAuth({
  pages: {
    signIn: "/login",
  },
}) : (req: NextRequest) => {
  // No-op middleware - allows all requests through
  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/trading/:path*", "/api/user/:path*"],
}



