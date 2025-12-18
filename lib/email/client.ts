import { Resend } from 'resend'

// Initialize Resend client
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// Email configuration
export const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM || 'noreply@edgepannel.com',
  fromName: process.env.EMAIL_FROM_NAME || 'EdgePannel',
  baseUrl: process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
}

/**
 * Send an email using Resend
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string
  subject: string
  html: string
  text?: string
}) {
  try {
    if (!resend) {
      console.warn('[Email] RESEND_API_KEY not configured. Email not sent.')
      console.log('[Email] Would send:', { to, subject })
      return { success: false, error: 'Email service not configured' }
    }

    const { data, error } = await resend.emails.send({
      from: `${EMAIL_CONFIG.fromName} <${EMAIL_CONFIG.from}>`,
      to: [to],
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    })

    if (error) {
      console.error('[Email] Error sending email:', error)
      return { success: false, error }
    }

    console.log('[Email] Email sent successfully:', data?.id)
    return { success: true, id: data?.id }
  } catch (error: any) {
    console.error('[Email] Exception sending email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Generate email verification token
 */
export function generateVerificationToken(): string {
  return require('crypto').randomBytes(32).toString('hex')
}

/**
 * Generate password reset token
 */
export function generateResetToken(): string {
  return require('crypto').randomBytes(32).toString('hex')
}
