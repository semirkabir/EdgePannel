import { NextResponse } from 'next/server'
import { PolymarketClient } from '@/lib/api/polymarket'
import { KalshiClient } from '@/lib/api/kalshi'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { decrypt } from '@/lib/utils/encryption'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        const platform = searchParams.get('platform')
        const interval = searchParams.get('interval') || '1d'
        const assetId = searchParams.get('assetId')

        if (!id || !platform) {
            return NextResponse.json({ error: 'Missing id or platform' }, { status: 400 })
        }

        if (platform === 'polymarket') {
            const client = new PolymarketClient({ apiKey: '' })
            
            console.log('[History API] Polymarket request:', { id, interval, assetId })

            let tokenId = assetId

            // If we don't have the assetId (token_id), we need to fetch it
            if (!tokenId) {
                console.log('[History API] No assetId provided, attempting to resolve from id:', id)
                // If ID is a slug (doesn't start with 0x), try Gamma API first
                if (!id.startsWith('0x')) {
                    try {
                        const gammaResponse = await fetch(`https://gamma-api.polymarket.com/markets?slug=${id}`)
                        if (gammaResponse.ok) {
                            const markets = await gammaResponse.json()
                            if (Array.isArray(markets) && markets.length > 0) {
                                const market = markets[0]
                                console.log('[History API] Market data:', { 
                                    clobTokenIds: market.clobTokenIds, 
                                    outcomes: market.outcomes 
                                })
                                
                                // Try to find "Yes" token or default to first
                                if (market.clobTokenIds) {
                                    let tokenIds = market.clobTokenIds
                                    
                                    // Parse if it's a string
                                    if (typeof tokenIds === 'string') {
                                        try {
                                            tokenIds = JSON.parse(tokenIds)
                                        } catch (e) {
                                            console.error('[History API] Failed to parse clobTokenIds:', e)
                                        }
                                    }
                                    
                                    if (Array.isArray(tokenIds) && tokenIds.length > 0) {
                                        let outcomes = market.outcomes || []
                                        if (typeof outcomes === 'string') {
                                            try {
                                                outcomes = JSON.parse(outcomes)
                                            } catch (e) {
                                                outcomes = []
                                            }
                                        }

                                        const yesIndex = outcomes.findIndex((o: string) => o.toLowerCase() === 'yes')
                                        tokenId = yesIndex >= 0 ? tokenIds[yesIndex] : tokenIds[0]
                                        console.log('[History API] Resolved tokenId:', tokenId)
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.error('[History API] Error resolving slug:', e)
                    }
                }

                // If still no token ID, try CLOB API (assumes ID is condition ID)
                if (!tokenId) {
                    try {
                        // Fetch market details from CLOB API to get the token ID
                        // The ID passed is usually the conditionId
                        const marketResponse = await fetch(`https://clob.polymarket.com/markets/${id}`)

                        if (marketResponse.ok) {
                            const marketData = await marketResponse.json()

                            // Find the "Yes" token
                            if (marketData.tokens && Array.isArray(marketData.tokens)) {
                                const yesToken = marketData.tokens.find((t: any) =>
                                    t.outcome === 'Yes' || t.outcome === 'YES' || t.outcome === 'True'
                                )

                                if (yesToken) {
                                    tokenId = yesToken.token_id
                                } else if (marketData.tokens.length > 0) {
                                    // Fallback to first token if Yes not found
                                    tokenId = marketData.tokens[0].token_id
                                }
                            }
                        }
                    } catch (error) {
                        console.error('[History API] Error fetching market details:', error)
                    }
                }
            }

            if (!tokenId) {
                return NextResponse.json({ error: 'Could not find token ID for market' }, { status: 404 })
            }

            console.log(`[History API] Fetching history for token ${tokenId} (interval: ${interval})`)
            const history = await client.getPriceHistory(tokenId, interval)

            return NextResponse.json({ history })
        }

        if (platform === 'kalshi') {
            try {
                // Try to get user's API keys if authenticated
                const session = await getServerSession(authOptions)
                let accessKeyId: string | undefined
                let privateKey: string | undefined

                if (session?.user?.id) {
                    const apiKeyRecord = await prisma.apiKey.findUnique({
                        where: {
                            userId_platform: {
                                userId: session.user.id,
                                platform: 'kalshi',
                            },
                        },
                    })

                    if (apiKeyRecord?.encryptedKeyData) {
                        accessKeyId = decrypt(apiKeyRecord.encryptedKey)
                        privateKey = decrypt(apiKeyRecord.encryptedKeyData)
                    }
                }

                if (!accessKeyId || !privateKey) {
                    console.warn('[History API] Kalshi credentials not configured. User must be authenticated and have API keys set up.')
                    return NextResponse.json({ history: [] })
                }

                const client = new KalshiClient({
                    accessKeyId,
                    privateKey,
                })

                console.log(`[History API] Fetching Kalshi history for ticker ${id} (interval: ${interval})`)
                const history = await client.getPriceHistory(id, interval)

                return NextResponse.json({ history })
            } catch (error: any) {
                console.error('[History API] Kalshi error:', error)
                return NextResponse.json({ history: [] })
            }
        }

        return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 })

    } catch (error: any) {
        console.error('[History API] Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
