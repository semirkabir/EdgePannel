import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { UserPreferencesSchema } from '@/lib/api/schemas'

export async function GET() {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { preferences: true } as any
        })

        return NextResponse.json({ preferences: (user as any)?.preferences || {} })
    } catch (error) {
        console.error('Error fetching preferences:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { preferences } = body

        if (!preferences) {
            return NextResponse.json({ error: 'Missing preferences' }, { status: 400 })
        }

        // Validate preferences against schema
        const validationResult = UserPreferencesSchema.safeParse(preferences)

        if (!validationResult.success) {
            return NextResponse.json({
                error: 'Invalid preferences format',
                details: validationResult.error.issues.map(issue => ({
                    path: issue.path.join('.'),
                    message: issue.message
                }))
            }, { status: 400 })
        }

        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                preferences: validationResult.data
            } as any,
            select: { preferences: true } as any
        })

        return NextResponse.json({ success: true, preferences: (updatedUser as any).preferences })

    } catch (error) {
        console.error('Error updating preferences:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
