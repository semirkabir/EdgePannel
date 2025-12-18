import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { withErrorHandler, validateBody, ApiError } from '@/lib/api/middleware'
import { ErrorCodes } from '@/lib/api/error-codes'
import { z } from 'zod'
import { hashPassword } from '@/lib/auth/security'
import { auditLogFromRequest } from '@/lib/audit/audit-logger'

const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[@$!%*?&]/, 'Password must contain at least one special character (@$!%*?&)'),
})

export const POST = withErrorHandler(async (request: NextRequest) => {
  const { token, email, password } = validateBody(ResetPasswordSchema, await request.json())

  // Find reset token
  const resetToken = await prisma.verificationToken.findUnique({
    where: {
      token,
    },
  })

  if (!resetToken) {
    throw new ApiError(400, 'Invalid reset token', ErrorCodes.INVALID_TOKEN)
  }

  // Check if token is expired
  if (resetToken.expires < new Date()) {
    // Delete expired token
    await prisma.verificationToken.delete({
      where: { token },
    })
    throw new ApiError(400, 'Reset token has expired', ErrorCodes.TOKEN_EXPIRED)
  }

  // Check if identifier (email) matches
  if (resetToken.identifier !== email) {
    throw new ApiError(400, 'Email does not match token', ErrorCodes.INVALID_TOKEN)
  }

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    throw new ApiError(404, 'User not found', ErrorCodes.NOT_FOUND)
  }

  // Hash new password
  const hashedPassword = await hashPassword(password)

  // Update password
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
    },
  })

  // Delete used token
  await prisma.verificationToken.delete({
    where: { token },
  })

  // Audit log
  await auditLogFromRequest(request, {
    userId: user.id,
    action: 'PASSWORD_RESET',
    resource: 'user',
    resourceId: user.id,
    status: 'SUCCESS',
    details: {
      email,
    },
  })

  return NextResponse.json({
    success: true,
    message: 'Password has been reset successfully. You can now log in with your new password.',
  })
})
