export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { withErrorHandler, validateBody, withPublicRateLimit } from '@/lib/api/middleware'
import { ErrorCodes } from '@/lib/api/error-codes'
import { z } from 'zod'
import { sendEmail } from '@/lib/email/client'
import { getPasswordResetEmailHtml } from '@/lib/email/templates'
import { generateResetToken } from '@/lib/email/client'

const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

// Rate limit: 3 requests per 15 minutes per IP
export const POST = withErrorHandler(
  withPublicRateLimit(3, 15 * 60 * 1000)(async (request: NextRequest) => {
    const { email } = validateBody(ForgotPasswordSchema, await request.json())

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    })

    // Don't reveal if user exists (prevent user enumeration)
    // Always return success, even if user doesn't exist
    if (!user) {
      // Still return success to prevent user enumeration
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      })
    }

    // Generate reset token
    const resetToken = generateResetToken()
    const expires = new Date()
    expires.setHours(expires.getHours() + 1) // Token expires in 1 hour

    // Store reset token (using VerificationToken table)
    await prisma.verificationToken.upsert({
      where: {
        identifier_token: {
          identifier: email,
          token: resetToken,
        },
      },
      create: {
        identifier: email,
        token: resetToken,
        expires,
      },
      update: {
        token: resetToken,
        expires,
      },
    })

    // Send password reset email
    const emailResult = await sendEmail({
      to: email,
      subject: 'Reset Your Password - EdgePannel',
      html: getPasswordResetEmailHtml(resetToken, email),
    })

    if (!emailResult.success) {
      console.error('[Forgot Password] Failed to send email:', emailResult.error)
      // Still return success to user (don't reveal email service issues)
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    })
  })
)
