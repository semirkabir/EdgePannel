/**
 * MCP Client for fetching live prediction market data
 * Integrates with the prediction-markets-mcp server
 */

import { Market } from '@/types/market'

export interface MCPMarketData {
  platform: 'polymarket' | 'kalshi' | 'predictit'
  question: string
  outcomes: Array<{
    name: string
    probability: number
  }>
  url?: string
  volume?: number
  endDate?: string
}

export interface MCPResponse {
  markets: MCPMarketData[]
  timestamp: Date
}

/**
 * Client for interacting with the MCP prediction markets server
 */
export class MCPClient {
  private baseUrl: string

  constructor(baseUrl: string = '/api/mcp') {
    this.baseUrl = baseUrl
  }

  /**
   * Fetch markets from MCP server by keyword
   */
  async getMarkets(keyword: string): Promise<MCPResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/markets?keyword=${encodeURIComponent(keyword)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Always get fresh data
      })

      if (!response.ok) {
        throw new Error(`MCP API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return {
        markets: data.markets || [],
        timestamp: new Date(data.timestamp || Date.now()),
      }
    } catch (error) {
      console.error('[MCP Client] Error fetching markets:', error)
      return { markets: [], timestamp: new Date() }
    }
  }

  /**
   * Fetch markets for multiple keywords in parallel
   */
  async getMarketsBatch(keywords: string[]): Promise<MCPResponse> {
    try {
      const results = await Promise.all(
        keywords.map(keyword => this.getMarkets(keyword))
      )

      // Merge results and deduplicate by platform + question
      const seenMarkets = new Set<string>()
      const allMarkets: MCPMarketData[] = []

      for (const result of results) {
        for (const market of result.markets) {
          const key = `${market.platform}-${market.question}`
          if (!seenMarkets.has(key)) {
            seenMarkets.add(key)
            allMarkets.push(market)
          }
        }
      }

      return {
        markets: allMarkets,
        timestamp: new Date(),
      }
    } catch (error) {
      console.error('[MCP Client] Error fetching batch markets:', error)
      return { markets: [], timestamp: new Date() }
    }
  }

  /**
   * Transform MCP market data to internal Market format
   */
  transformToMarket(mcpMarket: MCPMarketData): Market | null {
    try {
      // Get the primary outcome (usually "Yes" or first outcome)
      const primaryOutcome = mcpMarket.outcomes.find(o =>
        o.name.toLowerCase() === 'yes' || o.name.toLowerCase() === 'true'
      ) || mcpMarket.outcomes[0]

      if (!primaryOutcome) return null

      // Generate a unique ID based on platform and question
      const id = this.generateMarketId(mcpMarket.platform, mcpMarket.question)

      return {
        id,
        platform: mcpMarket.platform === 'predictit' ? 'kalshi' : mcpMarket.platform, // Map predictit to kalshi type
        title: mcpMarket.question,
        description: '', // MCP doesn't provide descriptions
        probability: primaryOutcome.probability / 100, // Convert from percentage to 0-1
        price: primaryOutcome.probability / 100,
        volume24h: mcpMarket.volume,
        endDate: mcpMarket.endDate ? new Date(mcpMarket.endDate) : undefined,
        rawData: {
          source: 'mcp',
          outcomes: mcpMarket.outcomes,
          url: mcpMarket.url,
        },
      }
    } catch (error) {
      console.error('[MCP Client] Error transforming market:', error)
      return null
    }
  }

  /**
   * Generate a consistent market ID from platform and question
   */
  private generateMarketId(platform: string, question: string): string {
    // Create a simple hash of the question for consistent IDs
    const hash = question
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .substring(0, 50)
    return `${platform}-mcp-${hash}`
  }

  /**
   * Batch transform MCP markets to internal Market format
   */
  transformMarkets(mcpMarkets: MCPMarketData[]): Market[] {
    return mcpMarkets
      .map(m => this.transformToMarket(m))
      .filter((m): m is Market => m !== null)
  }
}

/**
 * Singleton instance for convenience
 */
export const mcpClient = new MCPClient()
