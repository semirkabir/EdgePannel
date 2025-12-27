'use client'

import { useState, useMemo } from 'react'
import { Search, TrendingUp, TrendingDown, RefreshCw, ArrowRightLeft, Info } from 'lucide-react'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts'
import { cn } from '@/lib/utils/cn'

// Mock data for demonstration
const MOCK_FINANCIAL_ASSETS = [
    { symbol: 'SPY', name: 'S&P 500 ETF', type: 'ETF' },
    { symbol: 'QQQ', name: 'Invesco QQQ', type: 'ETF' },
    { symbol: 'GLD', name: 'SPDR Gold Shares', type: 'Commodity' },
    { symbol: 'US10Y', name: 'US 10Y Treasury', type: 'Bond' },
    { symbol: 'NVDA', name: 'NVIDIA Corp', type: 'Stock' },
    { symbol: 'BTC', name: 'Bitcoin', type: 'Crypto' },
]

const MOCK_CORRELATION_DATA = Array.from({ length: 30 }).map((_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
    predictionPrice: 0.45 + Math.random() * 0.1, // 0-1 probability
    assetPrice: 100 + Math.random() * 20 + i * 2, // Normalized or raw price
}))

interface MarketRelatorProps {
    initialMarket?: {
        title: string
        id: string
        currentPrice: number
    } | null
}

export function MarketRelator({ initialMarket }: MarketRelatorProps) {
    const [selectedAsset, setSelectedAsset] = useState<typeof MOCK_FINANCIAL_ASSETS[0] | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [isSearching, setIsSearching] = useState(false)
    const [currentMarket, setCurrentMarket] = useState(initialMarket || {
        title: 'Fed Rate Cut in March?',
        id: 'mock-market-1',
        currentPrice: 0.65
    })

    // Simulated search
    const filteredAssets = useMemo(() => {
        if (!searchQuery) return MOCK_FINANCIAL_ASSETS
        return MOCK_FINANCIAL_ASSETS.filter(a =>
            a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
    }, [searchQuery])

    const calculateCorrelation = () => {
        // Mock correlation calculation
        // In a real app, this would verify arrays logic
        return (Math.random() * 2 - 1).toFixed(2) // -1 to 1
    }

    const correlationScore = useMemo(() => calculateCorrelation(), [selectedAsset, currentMarket])

    return (
        <div className="w-full h-full flex flex-col bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                        <ArrowRightLeft className="w-6 h-6 text-blue-400" />
                        Market Relator
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                        Analyze correlations between prediction markets and financial assets
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
                        <Info className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold text-blue-300">Beta Feature</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                {/* Left Control Panel */}
                <div className="w-full lg:w-80 border-r border-white/10 p-4 flex flex-col gap-6 bg-black/20">

                    {/* Prediction Market Selection */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Prediction Market (Variable A)
                        </label>
                        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                            <div className="text-sm font-bold text-white mb-2 line-clamp-2">
                                {currentMarket.title}
                            </div>
                            <div className="flex justify-between items-end">
                                <div className="text-xs text-gray-400">Current Probability</div>
                                <div className="text-lg font-black text-blue-400">
                                    {(currentMarket.currentPrice * 100).toFixed(0)}%
                                </div>
                            </div>
                        </div>
                        <button className="w-full py-2 text-xs font-bold text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors border border-dashed border-blue-500/30 hover:border-blue-500/50">
                            Select Different Market
                        </button>
                    </div>

                    {/* Financial Asset Selection */}
                    <div className="space-y-3 flex-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Financial Asset (Variable B)
                        </label>

                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search symbol (e.g. SPY, BTC)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => setIsSearching(true)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>

                        <div className="space-y-2 overflow-y-auto max-h-[300px] scrollbar-thin scrollbar-thumb-white/10">
                            {filteredAssets.map(asset => (
                                <button
                                    key={asset.symbol}
                                    onClick={() => setSelectedAsset(asset)}
                                    className={cn(
                                        "w-full p-3 rounded-lg flex items-center justify-between transition-all",
                                        selectedAsset?.symbol === asset.symbol
                                            ? "bg-blue-600/20 border border-blue-500/50"
                                            : "bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20"
                                    )}
                                >
                                    <div className="text-left">
                                        <div className="font-bold text-white">{asset.symbol}</div>
                                        <div className="text-xs text-gray-400">{asset.name}</div>
                                    </div>
                                    <div className="text-[10px] font-mono bg-white/10 px-2 py-1 rounded text-gray-300">
                                        {asset.type}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Chart Area */}
                <div className="flex-1 p-6 flex flex-col">
                    {selectedAsset ? (
                        <>
                            {/* Stats Bar */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                    <div className="text-xs text-gray-400 mb-1">Correlation Coefficient</div>
                                    <div className={cn(
                                        "text-2xl font-black",
                                        Number(correlationScore) > 0.5 ? "text-green-400" :
                                            Number(correlationScore) < -0.5 ? "text-red-400" : "text-yellow-400"
                                    )}>
                                        {correlationScore}
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                    <div className="text-xs text-gray-400 mb-1">Lookback Period</div>
                                    <div className="text-2xl font-black text-white">30 Days</div>
                                </div>
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                    <div className="text-xs text-gray-400 mb-1">Confidence Score</div>
                                    <div className="text-2xl font-black text-blue-400">High</div>
                                </div>
                            </div>

                            {/* Chart */}
                            <div className="flex-1 bg-black/20 rounded-xl border border-white/5 p-4 min-h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={MOCK_CORRELATION_DATA}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#666"
                                            fontSize={10}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis
                                            yAxisId="left"
                                            stroke="#3b82f6"
                                            fontSize={10}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                                            domain={['auto', 'auto']}
                                        />
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            stroke="#a855f7"
                                            fontSize={10}
                                            tickLine={false}
                                            axisLine={false}
                                            domain={['auto', 'auto']}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#000000dd',
                                                borderColor: '#333',
                                                borderRadius: '8px',
                                                backdropFilter: 'blur(10px)'
                                            }}
                                            itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                        />
                                        <Legend />
                                        <Line
                                            yAxisId="left"
                                            type="monotone"
                                            dataKey="predictionPrice"
                                            name="Prediction Probability"
                                            stroke="#3b82f6"
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                        <Line
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey="assetPrice"
                                            name={`${selectedAsset.symbol} Price`}
                                            stroke="#a855f7"
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex gap-4 items-center">
                                <div className="p-2 bg-blue-500/20 rounded-lg">
                                    <TrendingUp className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white">Strategy Insight</h4>
                                    <p className="text-xs text-gray-300 mt-1">
                                        Strong correlation detected. {selectedAsset.symbol} often moves
                                        <span className="font-bold text-white"> {Number(correlationScore) > 0 ? "in sync with" : "inversely to"} </span>
                                        prediction probabilities. Consider hedging with OTM options.
                                    </p>
                                </div>
                                <button className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors">
                                    View Hedging Options
                                </button>
                            </div>

                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-50">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                                <ArrowRightLeft className="w-8 h-8 text-gray-500" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Select an Asset</h3>
                            <p className="text-sm text-gray-400 max-w-md">
                                Choose a financial asset from the list to analyze its correlation with the selected prediction market.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
