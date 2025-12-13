'use client'

import { useEffect, useState } from 'react'
import { MarketDetails as MarketDetailsType } from '@/types/market'
import { Button } from '@/components/ui/button'
import { MarketChart } from '@/components/charts/MarketChart'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingUp, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { RightPanel } from '@/components/ui/RightPanel'

interface MarketDetailsProps {
  market: MarketDetailsType | null
  onClose: () => void
}

export function MarketDetails({ market, onClose }: MarketDetailsProps) {
  // Cache the market so we can display it while the panel is animating out
  const [activeMarket, setActiveMarket] = useState<MarketDetailsType | null>(market)
  const [timeRange, setTimeRange] = useState('24H')

  useEffect(() => {
    if (market) {
      setActiveMarket(market)
    }
  }, [market])

  // Helper to safely get date string
  const getEndDateString = () => {
    if (!activeMarket?.endDate) return 'N/A';
    try {
      const date = activeMarket.endDate instanceof Date ? activeMarket.endDate : new Date(activeMarket.endDate);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
      return 'Invalid Date';
    }
  }

  // Mock tweets
  const mockTweets = [
    { id: 1, user: 'MarketAnalyst', handle: '@analyst_top', text: `Huge movement on "${activeMarket?.title}" today! Volume spiking. #predictionmarkets`, time: '2m ago' },
    { id: 2, user: 'CryptoTrader', handle: '@cryptotrader', text: 'Buying YES on this one. The odds are too good to pass up.', time: '15m ago' },
    { id: 3, user: 'NewsBreaker', handle: '@newsbreaker', text: 'Breaking: New developments might affect the outcome of this market significantly.', time: '1h ago' },
    { id: 4, user: 'PolymarketWhale', handle: '@polywhale', text: 'Just saw a massive buy order come in. Someone knows something.', time: '3h ago' },
  ]

  return (
    <RightPanel
      isOpen={!!market}
      onClose={onClose}
      title={activeMarket?.title || 'Market'}
      subtitle={
        <span className={cn(
          "text-[10px] font-mono uppercase tracking-wider",
          activeMarket?.platform === 'polymarket' ? "text-blue-400" : "text-green-400"
        )}>
          {activeMarket?.platform}
        </span>
      }
    >
      {/* 1. Hero / Price Section (Gamified) */}
      {activeMarket && (
        <div className="px-5 pt-8 pb-4 text-center relative">
          <div className="inline-flex flex-col items-center">
            <span className="text-sm font-medium text-gray-400 mb-1 tracking-wide">CHANCE</span>
            <div className={cn(
              "text-6xl font-black tracking-tighter tabular-nums mb-2",
              (activeMarket.price || 0) >= 0.5 ? "text-[#00ff7f]" : "text-[#ff4d4d]" // Neon Green / Red
            )}>
              {Math.round((activeMarket.price || 0) * 100)}%
            </div>

            {/* Price Change (Mocked for now or calc from history) */}
            <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+2.4% Today</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Chart Section */}
      <div className="w-full h-[220px] mb-4 relative group">
        {/* Time Filters Bubble */}
        <div className="absolute top-2 right-4 flex gap-1 p-0.5 bg-white/5 rounded-lg border border-white/5 backdrop-blur-sm z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          {['1H', '1D', '1W', 'ALL'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                "px-2 py-1 text-[10px] font-bold rounded-md transition-all",
                timeRange === range ? "bg-white/20 text-white" : "text-gray-500 hover:text-gray-300"
              )}
            >
              {range}
            </button>
          ))}
        </div>

        {activeMarket?.priceHistory && activeMarket.priceHistory.length > 0 ? (
          <MarketChart
            data={activeMarket.priceHistory}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs tracking-wider">
            Waiting for chart data...
          </div>
        )}
      </div>

      {/* 3. Action Buttons (Gamified) */}
      {activeMarket && (
        <div className="px-5 mb-8">
          <div className="grid grid-cols-2 gap-3">
            <Button
              className="h-12 bg-[#00ff7f] hover:bg-[#00cc66] text-black font-bold text-lg rounded-xl shadow-[0_0_20px_rgba(0,255,127,0.2)] border-0"
              onClick={() => {
                const url = activeMarket.rawData?.url || (activeMarket.platform === 'polymarket' ? `https://polymarket.com/market/${activeMarket.slug || activeMarket.id}` : `https://kalshi.com/markets/${activeMarket.ticker || activeMarket.id}`);
                window.open(url, '_blank');
              }}
            >
              BET YES
            </Button>
            <Button
              className="h-12 bg-[#ff4d4d] hover:bg-[#cc0000] text-white font-bold text-lg rounded-xl shadow-[0_0_20px_rgba(255,77,77,0.2)] border-0"
              onClick={() => {
                const url = activeMarket.rawData?.url || (activeMarket.platform === 'polymarket' ? `https://polymarket.com/market/${activeMarket.slug || activeMarket.id}` : `https://kalshi.com/markets/${activeMarket.ticker || activeMarket.id}`);
                window.open(url, '_blank');
              }}
            >
              BET NO
            </Button>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 text-xs font-mono text-gray-500">
            <div className="flex flex-col items-center">
              <span className="text-gray-300 font-bold mb-0.5">${(activeMarket.volume24h || 0).toLocaleString(undefined, { notation: 'compact' })}</span>
              <span>VOL</span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex flex-col items-center">
              <span className="text-gray-300 font-bold mb-0.5">${(activeMarket.liquidity || 0).toLocaleString(undefined, { notation: 'compact' })}</span>
              <span>LIQ</span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex flex-col items-center">
              <span className="text-gray-300 font-bold mb-0.5">
                {getEndDateString()}
              </span>
              <span>ENDS</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Details / Tweets Tabs */}
      {activeMarket && (
        <div className="px-5">
          <Tabs defaultValue="tweets" className="w-full">
            <TabsList className="w-full bg-white/5 p-1 rounded-xl mb-4 border border-white/5">
              <TabsTrigger value="tweets" className="flex-1 rounded-lg text-xs font-bold data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-500">
                LATEST NEWS
              </TabsTrigger>
              <TabsTrigger value="info" className="flex-1 rounded-lg text-xs font-bold data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-500">
                MARKET INFO
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tweets" className="mt-0 space-y-3">
              {mockTweets.map((tweet) => (
                <div key={tweet.id} className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[8px] text-white font-black">
                      {tweet.user[0]}
                    </div>
                    <span className="text-xs font-bold text-gray-200">{tweet.user}</span>
                    <span className="text-[10px] text-gray-500 ml-auto">{tweet.time}</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {tweet.text}
                  </p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="info" className="mt-0">
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <h4 className="text-xs font-bold text-gray-300 mb-2 uppercase tracking-wide">Description</h4>
                <p className="text-xs text-gray-400 leading-relaxed mb-4">
                  {activeMarket.description || 'No description available for this market.'}
                </p>

                <h4 className="text-xs font-bold text-gray-300 mb-2 uppercase tracking-wide">Resolution Source</h4>
                <a
                  href={activeMarket.rawData?.url || '#'}
                  target="_blank"
                  className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  {activeMarket.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'} Source
                </a>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </RightPanel>
  )
}
