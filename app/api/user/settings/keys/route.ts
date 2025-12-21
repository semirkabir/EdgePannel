export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { encrypt } from '@/lib/utils/encryption'

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { polymarket, kalshiId, kalshiKey } = body

        // Update Polymarket Key
        if (polymarket) {
            await prisma.apiKey.upsert({
                where: {
                    userId_platform: {
                        userId: session.user.id,
                        platform: 'polymarket'
                    }
                },
                update: {
                    encryptedKey: encrypt(polymarket)
                },
                create: {
                    userId: session.user.id,
                    platform: 'polymarket',
                    encryptedKey: encrypt(polymarket)
                }
            })
        }

        // Update Kalshi Keys
        if (kalshiId && kalshiKey) {
            await prisma.apiKey.upsert({
                where: {
                    userId_platform: {
                        userId: session.user.id,
                        platform: 'kalshi'
                    }
                },
                update: {
                    encryptedKey: encrypt(kalshiId),
                    encryptedKeyData: encrypt(kalshiKey)
                },
                create: {
                    userId: session.user.id,
                    platform: 'kalshi',
                    encryptedKey: encrypt(kalshiId),
                    encryptedKeyData: encrypt(kalshiKey)
                }
            })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error saving keys:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
