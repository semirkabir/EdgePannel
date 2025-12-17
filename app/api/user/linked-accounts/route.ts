import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { AUTH_ENABLED, MOCK_USER_ID } from '@/lib/auth-config'

export async function GET() {
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

    const [user, accounts] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, image: true, password: true },
      }),
      prisma.account.findMany({
        where: { userId },
        select: { provider: true, type: true },
      }),
    ])

    const providers = Array.from(
      new Set((accounts ?? []).map(a => a.provider).filter(Boolean))
    ).sort()

    return NextResponse.json({
      user: user
        ? { email: user.email, name: user.name, image: user.image }
        : null,
      providers,
      hasPassword: !!user?.password,
      authEnabled: AUTH_ENABLED,
    })
  } catch (error: any) {
    console.error('[linked-accounts] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch linked accounts' },
      { status: 500 }
    )
  }
}

