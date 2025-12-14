import { NextResponse } from 'next/server'
import { PolymarketClient } from '@/lib/api/polymarket'
import { KalshiClient } from '@/lib/api/kalshi'

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
            const client = new PolymarketClient({ apiKey: '' }) // Public API doesn't need key for reading

            let tokenId = assetId

            // If we don't have the assetId (token_id), we need to fetch it from the market details
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

            if (!tokenId) {
                return NextResponse.json({ error: 'Could not find token ID for market' }, { status: 404 })
            }

            console.log(`[History API] Fetching history for token ${tokenId} (interval: ${interval})`)
            const history = await client.getPriceHistory(tokenId, interval)

            return NextResponse.json({ history })
        }

        if (platform === 'kalshi') {
            try {
                // Initialize Kalshi client with credentials from env
                const accessKeyId = process.env.KALSHI_API_KEY_ID || ''
                const privateKey = process.env.KALSHI_PRIVATE_KEY || ''

                if (!accessKeyId || !privateKey) {
                    console.warn('[History API] Kalshi credentials not configured')
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
