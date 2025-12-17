import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { AUTH_ENABLED, MOCK_USER_ID } from '@/lib/auth-config'

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

    const { newEmail } = await request.json()

    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return NextResponse.json(
        { error: 'Valid email address is required' },
        { status: 400 }
      )
    }

    // Check if email is already taken
    const existingUser = await prisma.user.findUnique({
      where: { email: newEmail },
    })

    if (existingUser && existingUser.id !== userId) {
      return NextResponse.json(
        { error: 'Email address is already in use' },
        { status: 400 }
      )
    }

    // Update email
    await prisma.user.update({
      where: { id: userId },
      data: { email: newEmail, emailVerified: null },
    })

    return NextResponse.json({ success: true, email: newEmail })
  } catch (error: any) {
    console.error('[update-email] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to update email' },
      { status: 500 }
    )
  }
}

