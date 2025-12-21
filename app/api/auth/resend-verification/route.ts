export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { withErrorHandler, validateBody, withPublicRateLimit } from '@/lib/api/middleware'
import { z } from 'zod'
import { sendEmail } from '@/lib/email/client'
import { getVerificationEmailHtml } from '@/lib/email/templates'
import { generateVerificationToken } from '@/lib/email/client'

const ResendVerificationSchema = z.object({
  email: z.string().email('Invalid email address'),
})

// Rate limit: 3 requests per 15 minutes per IP
export const POST = withErrorHandler(
  withPublicRateLimit(3, 15 * 60 * 1000)(async (request: NextRequest) => {
    const { email } = validateBody(ResendVerificationSchema, await request.json())

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    })

    // Don't reveal if user exists (prevent user enumeration)
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a verification link has been sent.',
      })
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'Your email is already verified.',
      })
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken()
    const expires = new Date()
    expires.setDate(expires.getDate() + 1) // Token expires in 24 hours

    // Delete old token if exists and create new one
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: email,
      },
    })

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: verificationToken,
        expires,
      },
    })

    // Send verification email
    const emailResult = await sendEmail({
      to: email,
      subject: 'Verify Your Email - EdgePannel',
      html: getVerificationEmailHtml(verificationToken, email),
    })

    if (!emailResult.success) {
      console.error('[Resend Verification] Failed to send email:', emailResult.error)
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, a verification link has been sent.',
    })
  })
)
