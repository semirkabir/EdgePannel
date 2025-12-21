export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { withErrorHandler, validateBody, ApiError, withPublicRateLimit } from '@/lib/api/middleware'
import { RegistrationSchema } from '@/lib/api/schemas'
import { hashPassword } from '@/lib/auth/security'
import { ErrorCodes } from '@/lib/api/error-codes'
import { logger } from '@/lib/utils/logger'
import { auditLogFromRequest } from '@/lib/audit/audit-logger'
import { sendEmail } from '@/lib/email/client'
import { getVerificationEmailHtml } from '@/lib/email/templates'
import { generateVerificationToken } from '@/lib/email/client'

// Rate limit registration: 3 attempts per 15 minutes per IP
export const POST = withErrorHandler(
  withPublicRateLimit(3, 15 * 60 * 1000)(async (request: NextRequest) => {
    const body = await request.json()
    const { name, email, password } = validateBody(RegistrationSchema, body)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      throw new ApiError(400, 'User already exists', ErrorCodes.USER_EXISTS)
    }

    // Hash password with secure rounds
    const hashedPassword = await hashPassword(password)

    // Create user in Prisma
    const user = await prisma.user.create({
      data: {
        name: name || email.split('@')[0],
        email,
        password: hashedPassword,
        emailVerified: null,
      },
    })

    logger.info('User registered', { userId: user.id.substring(0, 8) + '...', email })

    // Generate verification token
    const verificationToken = generateVerificationToken()
    const expires = new Date()
    expires.setDate(expires.getDate() + 1) // Token expires in 24 hours

    // Store verification token
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
      logger.warn('Failed to send verification email', { 
        userId: user.id.substring(0, 8) + '...', 
        error: emailResult.error 
      })
      // Don't fail registration if email fails - user can request resend
    }

    // Audit log
    await auditLogFromRequest(request, {
      userId: user.id,
      action: 'SYSTEM_EVENT',
      resource: 'user',
      resourceId: user.id,
      details: {
        event: 'USER_REGISTERED',
        email,
        verificationEmailSent: emailResult.success,
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'User created successfully. Please check your email to verify your account.',
        data: { 
          userId: user.id,
          emailVerificationSent: emailResult.success,
        },
      },
      { status: 201 }
    )
  })
)




