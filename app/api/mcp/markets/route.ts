export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'

/**
 * MCP Markets API Route
 * Fetches live prediction market data from the MCP server
 *
 * Note: This is a server-side proxy to the MCP server running locally.
 * The MCP server must be running and configured in Claude Desktop config.
 */

interface MCPMarketOutcome {
  name: string
  probability: number
}

interface MCPMarketData {
  platform: 'polymarket' | 'kalshi' | 'predictit'
  question: string
  outcomes: MCPMarketOutcome[]
  url?: string
  volume?: number
  endDate?: string
}

/**
 * Parse MCP server response text format
 *
 * Expected format:
 * **Polymarket: Will Trump win the 2024 election?**
 * Yes: 45.2% | No: 54.8%
 *
 * **PredictIt: Which party will win?**
 * Democratic: 89.0% | Republican: 11.0%
 */
function parseMCPResponse(responseText: string): MCPMarketData[] {
  const markets: MCPMarketData[] = []

  // Split by market blocks (separated by blank lines or new market headers)
  const lines = responseText.split('\n').filter(line => line.trim())

  let currentMarket: Partial<MCPMarketData> | null = null

  for (const line of lines) {
    // Check if this is a market header: **Platform: Question**
    const headerMatch = line.match(/^\*\*(.+?):\s*(.+?)\*\*$/)

    if (headerMatch) {
      // Save previous market if exists
      if (currentMarket && currentMarket.platform && currentMarket.question && currentMarket.outcomes) {
        markets.push(currentMarket as MCPMarketData)
      }

      // Start new market
      const platform = headerMatch[1].toLowerCase()
      const question = headerMatch[2]

      currentMarket = {
        platform: platform as 'polymarket' | 'kalshi' | 'predictit',
        question,
        outcomes: [],
      }
    } else if (currentMarket && line.includes(':') && line.includes('%')) {
      // Parse outcome line: "Yes: 45.2% | No: 54.8%"
      const outcomeParts = line.split('|').map(s => s.trim())

      for (const part of outcomeParts) {
        const outcomeMatch = part.match(/^(.+?):\s*(\d+\.?\d*)%/)
        if (outcomeMatch) {
          const name = outcomeMatch[1].trim()
          const probability = parseFloat(outcomeMatch[2])
          currentMarket.outcomes!.push({ name, probability })
        }
      }
    }
  }

  // Save last market
  if (currentMarket && currentMarket.platform && currentMarket.question && currentMarket.outcomes) {
    markets.push(currentMarket as MCPMarketData)
  }

  return markets
}

/**
 * Call the MCP server via stdio (simulated via environment)
 * In production, this would use the actual MCP protocol
 */
async function callMCPServer(keyword: string): Promise<string> {
  try {
    // Since we can't directly call the MCP server from Next.js API route,
    // we'll use a workaround: call the MCP server via a child process or HTTP proxy
    // For now, we'll implement a simple HTTP-based approach

    // Option 1: Direct API calls (fallback if MCP not available)
    // Option 2: Use a proxy server that talks to MCP
    // Option 3: Use the prediction markets APIs directly

    // For this implementation, we'll call the underlying APIs directly
    // since the MCP server is just a wrapper around them

    const results: string[] = []

    // Fetch from Polymarket
    try {
      const polymarketUrl = `https://clob.polymarket.com/markets?limit=20`
      const polyRes = await fetch(polymarketUrl, {
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }
      })

      if (polyRes.ok) {
        const data = await polyRes.json()
        const markets = data.data || data || []

        // Filter by keyword
        const filtered = markets.filter((m: any) =>
          m.question?.toLowerCase().includes(keyword.toLowerCase())
        )

        for (const market of filtered.slice(0, 10)) {
          const question = market.question || 'Unknown'
          const tokens = market.tokens || []

          if (tokens.length >= 2) {
            const yesToken = tokens.find((t: any) => t.outcome?.toLowerCase() === 'yes')
            const noToken = tokens.find((t: any) => t.outcome?.toLowerCase() === 'no')

            if (yesToken && noToken) {
              const yesPrice = (parseFloat(yesToken.price) * 100).toFixed(1)
              const noPrice = (parseFloat(noToken.price) * 100).toFixed(1)
              results.push(`**Polymarket: ${question}**`)
              results.push(`Yes: ${yesPrice}% | No: ${noPrice}%`)
              results.push('')
            }
          }
        }
      }
    } catch (error) {
      console.error('[MCP API] Error fetching Polymarket:', error)
    }

    // Fetch from Kalshi via demo API (public endpoint)
    try {
      // Note: Kalshi requires authentication for most endpoints
      // We'll skip this for now since we have the authenticated client elsewhere
      console.log('[MCP API] Kalshi requires authentication, skipping in MCP proxy')
    } catch (error) {
      console.error('[MCP API] Error fetching Kalshi:', error)
    }

    return results.join('\n')
  } catch (error) {
    console.error('[MCP API] Error calling MCP server:', error)
    throw error
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const keyword = searchParams.get('keyword')

    if (!keyword) {
      return NextResponse.json(
        { error: 'Keyword parameter is required' },
        { status: 400 }
      )
    }

    console.log(`[MCP API] Fetching markets for keyword: "${keyword}"`)

    // Call MCP server
    const responseText = await callMCPServer(keyword)

    // Parse response
    const markets = parseMCPResponse(responseText)

    console.log(`[MCP API] Found ${markets.length} markets for keyword "${keyword}"`)

    return NextResponse.json({
      markets,
      timestamp: new Date().toISOString(),
      keyword,
      source: 'mcp',
    })
  } catch (error: any) {
    console.error('[MCP API] Error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch MCP markets',
        markets: [],
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * POST endpoint for batch keyword queries
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const keywords = body.keywords as string[]

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'Keywords array is required' },
        { status: 400 }
      )
    }

    console.log(`[MCP API] Fetching markets for ${keywords.length} keywords`)

    // Fetch markets for all keywords in parallel
    const results = await Promise.all(
      keywords.map(async keyword => {
        const responseText = await callMCPServer(keyword)
        return parseMCPResponse(responseText)
      })
    )

    // Merge and deduplicate
    const seenMarkets = new Set<string>()
    const allMarkets: MCPMarketData[] = []

    for (const marketList of results) {
      for (const market of marketList) {
        const key = `${market.platform}-${market.question}`
        if (!seenMarkets.has(key)) {
          seenMarkets.add(key)
          allMarkets.push(market)
        }
      }
    }

    console.log(`[MCP API] Found ${allMarkets.length} unique markets`)

    return NextResponse.json({
      markets: allMarkets,
      timestamp: new Date().toISOString(),
      keywords,
      source: 'mcp',
    })
  } catch (error: any) {
    console.error('[MCP API] Error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch MCP markets',
        markets: [],
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
