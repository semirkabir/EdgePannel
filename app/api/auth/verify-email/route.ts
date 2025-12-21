export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { withErrorHandler, validateQuery, ApiError } from '@/lib/api/middleware'
import { ErrorCodes } from '@/lib/api/error-codes'
import { z } from 'zod'
import { auditLogFromRequest } from '@/lib/audit/audit-logger'

const VerifyEmailQuerySchema = z.object({
  token: z.string().min(1),
  email: z.string().email(),
})

export const GET = withErrorHandler(async (request: NextRequest) => {
  const { token, email } = validateQuery(VerifyEmailQuerySchema, request.nextUrl.searchParams)

  // Find verification token
  const verificationToken = await prisma.verificationToken.findUnique({
    where: {
      token,
    },
  })

  if (!verificationToken) {
    throw new ApiError(400, 'Invalid verification token', ErrorCodes.INVALID_TOKEN)
  }

  // Check if token is expired
  if (verificationToken.expires < new Date()) {
    // Delete expired token
    await prisma.verificationToken.delete({
      where: { token },
    })
    throw new ApiError(400, 'Verification token has expired', ErrorCodes.TOKEN_EXPIRED)
  }

  // Check if identifier (email) matches
  if (verificationToken.identifier !== email) {
    throw new ApiError(400, 'Email does not match token', ErrorCodes.INVALID_TOKEN)
  }

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    throw new ApiError(404, 'User not found', ErrorCodes.NOT_FOUND)
  }

  // Check if already verified
  if (user.emailVerified) {
    // Delete token anyway
    await prisma.verificationToken.delete({
      where: { token },
    })
    
    // Redirect to login with success message
    return NextResponse.redirect(
      new URL('/login?verified=true&message=Email already verified', request.url)
    )
  }

  // Verify email
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: new Date(),
    },
  })

  // Delete used token
  await prisma.verificationToken.delete({
    where: { token },
  })

  // Audit log
  await auditLogFromRequest(request, {
    userId: user.id,
    action: 'EMAIL_VERIFIED',
    resource: 'user',
    resourceId: user.id,
    status: 'SUCCESS',
    details: {
      email,
    },
  })

  // Redirect to login with success message
  return NextResponse.redirect(
    new URL('/login?verified=true&message=Email verified successfully', request.url)
  )
})
