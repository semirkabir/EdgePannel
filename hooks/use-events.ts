import useSWR from 'swr'
import { Market } from '@/types/market'
import { useMemo } from 'react'

interface Event {
  id: string | number
  question: string
  description?: string
  slug?: string
  active?: boolean
  closed?: boolean
  startDate?: string
  endDate?: string
  markets?: any[] // Markets nested in the event
  imageUrl?: string
  tags?: string[]
}

interface UseEventsOptions {
  limit?: number
  offset?: number
  closed?: boolean
  enabled?: boolean
}

const fetcher = async (url: string): Promise<Event[]> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch events')
  }
  const data = await response.json()
  return data.events || []
}

export function useEvents(options: UseEventsOptions = {}) {
  const { limit = 100, offset = 0, closed = false, enabled = true } = options

  const { data: events, error, isLoading, mutate } = useSWR<Event[]>(
    enabled ? `/api/markets/events?limit=${limit}&offset=${offset}&closed=${closed}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      refreshInterval: 60000, // Refresh every minute
    }
  )

  // Transform events into markets format for compatibility
  const markets: Market[] = useMemo(() => {
    return events
      ? events.flatMap((event) => {
        if (!event.markets || !Array.isArray(event.markets)) {
          return []
        }

        // Transform each market in the event to Market format
        return event.markets.map((market: any) => {
          // Parse outcome prices
          let price = 0
          let probability = 0
          try {
            const prices = typeof market.outcomePrices === 'string'
              ? JSON.parse(market.outcomePrices)
              : market.outcomePrices
            if (Array.isArray(prices) && prices.length > 0) {
              price = parseFloat(prices[0].toString())
              probability = price
            }
          } catch (e) {
            // Use default price if parsing fails
          }

          return {
            id: market.conditionId || market.id?.toString() || '',
            platform: 'polymarket' as const,
            title: market.question || event.question || '',
            description: market.description || event.description || '',
            category: market.tags?.[0] || event.tags?.[0] || undefined,
            tags: market.tags || event.tags || [],
            probability,
            price,
            volume24h: parseFloat(market.volume24hr?.toString() || '0'),
            liquidity: parseFloat(market.liquidityNum?.toString() || '0'),
            endDate: market.endDateIso ? new Date(market.endDateIso) : (event.endDate ? new Date(event.endDate) : undefined),
            slug: market.slug || event.slug,
            imageUrl: market.image || market.image || undefined,
            rawData: {
              ...market,
              // Normalize eventId to string for consistent grouping
              eventId: String(event.id),
              eventQuestion: event.question,
              events: [{ id: String(event.id), question: event.question }],
            },
          } as Market
        })
      })
      : []
  }, [events]);

  return {
    events: events || [],
    markets, // Flattened markets from all events
    isLoading,
    error,
    mutate,
  }
}
