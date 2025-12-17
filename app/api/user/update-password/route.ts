import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { AUTH_ENABLED, MOCK_USER_ID } from '@/lib/auth-config'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    let userId: string | null = null

    if (AUTH_ENABLED) {
      const session = await getServerSession(authOptions)
      userId = session?.user?.id ?? null
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } else {
      userId = MOCK_USER_ID
    }

    const { currentPassword, newPassword } = await request.json()

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Get user to verify current password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // If user has a password, verify current password
    if (user.password) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required' },
          { status: 400 }
        )
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password)
      if (!isPasswordValid) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 401 }
        )
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[update-password] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to update password' },
      { status: 500 }
    )
  }
}

