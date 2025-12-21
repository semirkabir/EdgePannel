export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { UserPreferencesSchema } from '@/lib/api/schemas'
import { withAuth, withErrorHandler } from '@/lib/api/middleware'

export const GET = withErrorHandler(
    withAuth(async (userId: string) => {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { preferences: true } as any
        })

        return NextResponse.json({ preferences: (user as any)?.preferences || {} })
    })
)

export const POST = withErrorHandler(
    withAuth(async (userId: string, request: NextRequest) => {
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
            where: { id: userId },
            data: {
                preferences: validationResult.data
            } as any,
            select: { preferences: true } as any
        })

        return NextResponse.json({ success: true, preferences: (updatedUser as any).preferences })
    })
)
