import { useState, useEffect, useCallback } from 'react'
import useSWR from 'swr'

interface KalshiPosition {
  ticker: string
  position: number
  totalTraded: number
  marketExposure: number
  realizedPnl: number
  feesPaid: number
}

interface PolymarketPosition {
  market: string
  asset: string
  size: number
  currentValue: number
  initialValue: number
  cashPnl: number
  percentPnl: number
  avgEntryPrice: number
}

interface PortfolioData {
  kalshi: {
    positions: KalshiPosition[]
    totalPnl: number
    totalExposure: number
    loading: boolean
    error: Error | null
  }
  polymarket: {
    positions: PolymarketPosition[]
    totalValue: number
    totalPnl: number
    loading: boolean
    error: Error | null
  }
  combined: {
    totalPnl: number
    totalValue: number
    positionCount: number
  }
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface UsePortfolioApiOptions {
  polymarketAddress?: string
  refreshInterval?: number
}

export function usePortfolioApi(options: UsePortfolioApiOptions = {}) {
  const { polymarketAddress, refreshInterval = 30000 } = options

  // Fetch Kalshi positions
  const { data: kalshiData, error: kalshiError, mutate: mutateKalshi } = useSWR(
    '/api/portfolio/kalshi/positions',
    fetcher,
    { refreshInterval }
  )

  // Fetch Polymarket positions
  const { data: polymarketPositionsData, error: polymarketPositionsError, mutate: mutatePolymarketPositions } = useSWR(
    polymarketAddress ? `/api/portfolio/polymarket/positions?address=${polymarketAddress}` : null,
    fetcher,
    { refreshInterval }
  )

  // Fetch Polymarket portfolio value
  const { data: polymarketValueData, error: polymarketValueError, mutate: mutatePolymarketValue } = useSWR(
    polymarketAddress ? `/api/portfolio/polymarket/value?address=${polymarketAddress}` : null,
    fetcher,
    { refreshInterval }
  )

  const [portfolio, setPortfolio] = useState<PortfolioData>({
    kalshi: {
      positions: [],
      totalPnl: 0,
      totalExposure: 0,
      loading: true,
      error: null
    },
    polymarket: {
      positions: [],
      totalValue: 0,
      totalPnl: 0,
      loading: true,
      error: null
    },
    combined: {
      totalPnl: 0,
      totalValue: 0,
      positionCount: 0
    }
  })

  // Update portfolio data
  useEffect(() => {
    const kalshiPositions = kalshiData?.marketPositions || []
    const polymarketPositions = polymarketPositionsData?.positions || []

    const kalshiTotalPnl = kalshiPositions.reduce((sum: number, p: KalshiPosition) =>
      sum + p.realizedPnl, 0
    )
    const kalshiTotalExposure = kalshiPositions.reduce((sum: number, p: KalshiPosition) =>
      sum + p.marketExposure, 0
    )

    const polymarketTotalValue = polymarketValueData?.value || 0
    const polymarketTotalPnl = polymarketPositions.reduce((sum: number, p: PolymarketPosition) =>
      sum + p.cashPnl, 0
    )

    setPortfolio({
      kalshi: {
        positions: kalshiPositions,
        totalPnl: kalshiTotalPnl,
        totalExposure: kalshiTotalExposure,
        loading: !kalshiData && !kalshiError,
        error: kalshiError || null
      },
      polymarket: {
        positions: polymarketPositions,
        totalValue: polymarketTotalValue,
        totalPnl: polymarketTotalPnl,
        loading: (!polymarketPositionsData && !polymarketPositionsError) ||
                 (!polymarketValueData && !polymarketValueError),
        error: polymarketPositionsError || polymarketValueError || null
      },
      combined: {
        totalPnl: kalshiTotalPnl + polymarketTotalPnl,
        totalValue: kalshiTotalExposure + polymarketTotalValue,
        positionCount: kalshiPositions.length + polymarketPositions.length
      }
    })
  }, [kalshiData, kalshiError, polymarketPositionsData, polymarketPositionsError, polymarketValueData, polymarketValueError])

  const refresh = useCallback(async () => {
    await Promise.all([
      mutateKalshi(),
      mutatePolymarketPositions(),
      mutatePolymarketValue()
    ])
  }, [mutateKalshi, mutatePolymarketPositions, mutatePolymarketValue])

  return {
    ...portfolio,
    refresh,
    loading: portfolio.kalshi.loading || portfolio.polymarket.loading
  }
}
