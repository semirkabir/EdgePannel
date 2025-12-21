export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { withAuth, withErrorHandler, validateBody, ApiError } from '@/lib/api/middleware'
import { PasswordUpdateSchema } from '@/lib/api/schemas'
import { verifyPassword, hashPassword } from '@/lib/auth/security'
import { ErrorCodes } from '@/lib/api/error-codes'
import { logger } from '@/lib/utils/logger'
import { auditLogFromRequest } from '@/lib/audit/audit-logger'

export const POST = withErrorHandler(
  withAuth(async (userId: string, request: NextRequest) => {
    const body = await request.json()
    const { currentPassword, newPassword } = validateBody(PasswordUpdateSchema, body)

    // Get user to verify current password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    })

    if (!user) {
      throw new ApiError(404, 'User not found', ErrorCodes.USER_NOT_FOUND)
    }

    // If user has a password, verify current password
    if (user.password) {
      const isPasswordValid = await verifyPassword(currentPassword, user.password)
      if (!isPasswordValid) {
        throw new ApiError(401, 'Current password is incorrect', ErrorCodes.INVALID_PASSWORD)
      }
    }

    // Hash new password with secure rounds
    const hashedPassword = await hashPassword(newPassword)

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    logger.info('Password updated', { userId: userId.substring(0, 8) + '...' })

    // Audit log
    await auditLogFromRequest(request, {
      userId,
      action: 'PASSWORD_CHANGED',
      resource: 'user',
      resourceId: userId,
      status: 'SUCCESS',
    })

    return NextResponse.json({ success: true })
  })
)

