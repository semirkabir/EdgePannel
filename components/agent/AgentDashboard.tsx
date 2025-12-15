'use client';

import React, { useState, useMemo } from 'react';
import { Brain, TrendingUp, TrendingDown, DollarSign, Activity, Zap, Target, BarChart3, Globe, AlertTriangle, Crown, Flame, ArrowUpRight, ArrowDownRight, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { EnrichedMarket } from '@/lib/markets/enrich';

interface AgentDashboardProps {
  markets?: EnrichedMarket[];
}

// Mock AI insights data
const AI_INSIGHTS = [
  {
    id: 1,
    title: "Fed Rate Decision Momentum Building",
    type: "bullish",
    confidence: 87,
    description: "AI analysis shows strong accumulation pattern in Fed rate cut markets. Institutional activity increased 45% in last 24h.",
    markets: ["Federal Reserve Rate Cut Q1", "Interest Rates"],
    change: "+12%",
    volume: "$4.2M"
  },
  {
    id: 2,
    title: "S&P 500 All-Time High Divergence",
    type: "bearish",
    confidence: 72,
    description: "Price-volume divergence detected. While probability remains high, whale selling pressure increased significantly.",
    markets: ["S&P 500 ATH 2025"],
    change: "-8%",
    volume: "$2.8M"
  },
  {
    id: 3,
    title: "Crypto Market Consolidation Phase",
    type: "neutral",
    confidence: 65,
    description: "Bitcoin markets showing reduced volatility. AI signals potential breakout within 7-14 days based on historical patterns.",
    markets: ["BTC $100K", "ETH $5K"],
    change: "+3%",
    volume: "$1.9M"
  },
  {
    id: 4,
    title: "Election Markets Heating Up",
    type: "opportunity",
    confidence: 91,
    description: "Unusual option flow detected in multiple election markets. Smart money positioning ahead of upcoming debates.",
    markets: ["2024 Presidential Election", "Senate Control"],
    change: "+18%",
    volume: "$6.1M"
  }
];

const WHALE_ACTIVITY = [
  { time: "5m ago", amount: 125000, side: "BUY", market: "Fed Rate Cut Q1", price: 0.67, platform: "Polymarket" },
  { time: "12m ago", amount: 89000, side: "SELL", market: "BTC $100K", price: 0.35, platform: "Kalshi" },
  { time: "18m ago", amount: 67000, side: "BUY", market: "S&P ATH 2025", price: 0.42, platform: "Polymarket" },
  { time: "25m ago", amount: 54000, side: "BUY", market: "Trump Win 2024", price: 0.58, platform: "Kalshi" },
];

const TOP_OPPORTUNITIES = [
  { rank: 1, market: "Fed Rate Decision Q1 2025", probability: 68, aiScore: 94, volume: "$4.2M", momentum: "+15%", edge: "Strong" },
  { rank: 2, market: "Bitcoin $100K by June", probability: 35, aiScore: 82, volume: "$1.9M", momentum: "+8%", edge: "Medium" },
  { rank: 3, market: "S&P 500 New ATH March", probability: 42, aiScore: 76, volume: "$2.8M", momentum: "-3%", edge: "Medium" },
  { rank: 4, market: "Trump Presidential Win", probability: 58, aiScore: 88, volume: "$6.1M", momentum: "+12%", edge: "Strong" },
  { rank: 5, market: "Recession by Q2 2025", probability: 28, aiScore: 71, volume: "$1.2M", momentum: "+5%", edge: "Weak" },
];

const MARKET_SENTIMENT = {
  overall: 62,
  politics: 71,
  finance: 58,
  crypto: 45,
  geopolitics: 67
};

// ... (imports)
import { AgentChat } from './AgentChat';

// ... (previous constants)

// Update AgentDashboard component
export function AgentDashboard({ markets = [] }: AgentDashboardProps) {
  const [selectedInsight, setSelectedInsight] = useState<number | null>(null);

  // Filter actual markets for the chat
  const chatMarkets = useMemo(() => {
    return markets && markets.length > 0 ? markets : [];
  }, [markets]);

  return (
    <div className="absolute inset-0 bg-gray-950 overflow-hidden flex flex-col">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />

      {/* Gradient Overlay */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-emerald-500/10 blur-[150px] pointer-events-none" />

      <div className="relative flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <div className="max-w-[1800px] mx-auto p-8 space-y-6 pb-32"> {/* Added pb-32 for chat spacing if fixed */}

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center">
                  <Brain className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h1 className="text-3xl font-black text-white">EdgePannel Live Intelligence</h1>
                  <p className="text-sm text-gray-400">Real-time market analysis & arbitrage detection</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <div className="text-xs text-gray-400 uppercase tracking-wider font-bold">System Status</div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm font-bold text-emerald-400">Online & Streaming</span>
                </div>
              </div>
            </div>
          </div>

          {/* Market Sentiment Overview */}
          <div className="grid grid-cols-6 gap-4">
            {/* ... (Keep existing sentiment cards) */}
            <SentimentCard title="Overall" score={MARKET_SENTIMENT.overall} trend="up" />
            <SentimentCard title="Politics" score={MARKET_SENTIMENT.politics} trend="up" />
            <SentimentCard title="Finance" score={MARKET_SENTIMENT.finance} trend="neutral" />
            <SentimentCard title="Crypto" score={MARKET_SENTIMENT.crypto} trend="down" />
            <SentimentCard title="Geopolitics" score={MARKET_SENTIMENT.geopolitics} trend="up" />
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/30 rounded-2xl p-4 backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-purple-400" />
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Signals</div>
              </div>
              <div className="text-2xl font-black text-purple-400">24</div>
              <div className="text-xs text-gray-500 mt-1">Active Opportunities</div>
            </div>
          </div>

          {/* AI Insights & Opportunities */}
          <div className="grid grid-cols-12 gap-6">
            {/* Left Column - Insights (Span 5) */}
            <div className="col-span-5 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  Live Market Insights
                </h2>
                <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">Updated just now</span>
              </div>

              {AI_INSIGHTS.map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  isSelected={selectedInsight === insight.id}
                  onClick={() => setSelectedInsight(insight.id)}
                />
              ))}
            </div>

            {/* Middle Column - Opportunities & Whales (Span 4) */}
            <div className="col-span-4 space-y-6">
              {/* Top Opportunities */}
              <div className="bg-[#0e0f11]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                {/* ... (Keep existing opportunities content) */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-emerald-400" />
                    Top Opportunities
                  </h2>
                </div>
                <div className="space-y-2">
                  {TOP_OPPORTUNITIES.slice(0, 5).map((opp) => (
                    <OpportunityRow key={opp.rank} opportunity={opp} />
                  ))}
                </div>
              </div>

              {/* Whale Activity */}
              <div className="bg-[#0e0f11]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                {/* ... (Keep existing whale content) */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-400" />
                    Whale Activity
                  </h2>
                  <span className="text-xs text-amber-400 uppercase tracking-wider font-bold">Live</span>
                </div>
                <div className="space-y-2">
                  {WHALE_ACTIVITY.map((whale, i) => (
                    <WhaleActivityRow key={i} activity={whale} />
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - Agent Chat (Span 3) - Fixed/Sticky or inline */}
            <div className="col-span-3 flex flex-col gap-6">
              {/* Market Stats Grid (Moved here for layout balance) */}
              <div className="space-y-4">
                <AnalysisCard
                  icon={Activity}
                  title="Volume Analysis"
                  value="$42.3M"
                  change="+12%"
                  trend="up"
                  description="24h global volume"
                  color="blue"
                  compact
                />
                <AnalysisCard
                  icon={Target}
                  title="Alpha Score"
                  value="8.4/10"
                  change="+0.7"
                  trend="up"
                  description="Market efficiency"
                  color="purple"
                  compact
                />
              </div>

              {/* The Chat Component */}
              <div className="flex-1 min-h-[400px]">
                <AgentChat markets={chatMarkets} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// Update AnalysisCard to support compact mode
function AnalysisCard({ icon: Icon, title, value, change, trend, description, color, compact }: any) {
  const colorConfig = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400',
    orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30 text-orange-400',
  };

  return (
    <div className={cn(
      "bg-[#0e0f11]/80 backdrop-blur-xl border border-white/10 rounded-2xl",
      compact ? "p-4" : "p-6"
    )}>
      <div className="flex items-start justify-between mb-2">
        <div className={cn(
          "rounded-xl border flex items-center justify-center",
          compact ? "w-8 h-8" : "w-12 h-12",
          `bg-gradient-to-br ${colorConfig[color as keyof typeof colorConfig]}`
        )}>
          <Icon className={cn(compact ? "w-4 h-4" : "w-6 h-6")} />
        </div>
        <span className={cn("text-sm font-bold", trend === 'up' ? 'text-emerald-400' : 'text-red-400')}>
          {change}
        </span>
      </div>
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{title}</h3>
      <div className={cn("font-black text-white mb-0.5", compact ? "text-xl" : "text-3xl")}>{value}</div>
      {!compact && <p className="text-xs text-gray-500">{description}</p>}
    </div>
  );
}

// Sentiment Card Component
function SentimentCard({ title, score, trend }: { title: string; score: number; trend: 'up' | 'down' | 'neutral' }) {
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400';
  const trendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Activity;
  const TrendIcon = trendIcon;

  return (
    <div className="bg-[#0e0f11]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</div>
        <TrendIcon className={cn("w-3.5 h-3.5", trendColor)} />
      </div>
      <div className="text-2xl font-black text-white mb-1">{score}%</div>
      <div className={cn("text-xs font-bold", trendColor)}>
        {trend === 'up' ? 'Bullish' : trend === 'down' ? 'Bearish' : 'Neutral'}
      </div>
    </div>
  );
}

// Insight Card Component
function InsightCard({ insight, isSelected, onClick }: any) {
  const typeConfig = {
    bullish: { color: 'emerald', icon: TrendingUp, label: 'Bullish Signal' },
    bearish: { color: 'red', icon: TrendingDown, label: 'Bearish Signal' },
    neutral: { color: 'gray', icon: Activity, label: 'Neutral' },
    opportunity: { color: 'purple', icon: Sparkles, label: 'Alpha Opportunity' }
  };

  const config = typeConfig[insight.type as keyof typeof typeConfig] || typeConfig.neutral;
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-5 rounded-2xl border backdrop-blur-xl transition-all group",
        isSelected
          ? `bg-${config.color}-500/10 border-${config.color}-500/30`
          : "bg-[#0e0f11]/60 border-white/10 hover:bg-[#0e0f11]/80 hover:border-white/20"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl border flex items-center justify-center",
            `bg-${config.color}-500/10 border-${config.color}-500/30`
          )}>
            <Icon className={cn("w-5 h-5", `text-${config.color}-400`)} />
          </div>
          <div>
            <div className="text-sm font-black text-white mb-1">{insight.title}</div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-lg",
                `bg-${config.color}-500/10 text-${config.color}-400`
              )}>
                {config.label}
              </span>
              <span className="text-xs text-gray-500">•</span>
              <span className="text-xs text-gray-400 font-mono">{insight.confidence}% confidence</span>
            </div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
      </div>

      <p className="text-sm text-gray-400 leading-relaxed mb-3">{insight.description}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <BarChart3 className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-gray-400 font-mono">{insight.volume}</span>
          </div>
          <div className={cn(
            "font-bold font-mono",
            insight.change.startsWith('+') ? 'text-emerald-400' : 'text-red-400'
          )}>
            {insight.change}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {insight.markets.slice(0, 2).map((market: string, i: number) => (
            <span key={i} className="text-[9px] px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-gray-500 uppercase tracking-wider font-bold">
              {market}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

// Opportunity Row Component
function OpportunityRow({ opportunity }: any) {
  const edgeColor = opportunity.edge === 'Strong' ? 'emerald' : opportunity.edge === 'Medium' ? 'blue' : 'gray';

  return (
    <div className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all cursor-pointer group">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 flex items-center justify-center shrink-0">
          <span className="text-xs font-black text-purple-400">#{opportunity.rank}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white line-clamp-1 group-hover:text-purple-400 transition-colors">
            {opportunity.market}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-lg font-bold uppercase tracking-wider",
              `bg-${edgeColor}-500/10 text-${edgeColor}-400`
            )}>
              {opportunity.edge}
            </span>
            <span className="text-xs text-gray-500">•</span>
            <span className="text-xs text-gray-400 font-mono">AI: {opportunity.aiScore}</span>
          </div>
        </div>
      </div>
      <div className="text-right shrink-0 ml-4">
        <div className="text-lg font-black text-emerald-400">{opportunity.probability}%</div>
        <div className="text-xs text-gray-500 font-mono">{opportunity.momentum}</div>
      </div>
    </div>
  );
}

// Whale Activity Row Component
function WhaleActivityRow({ activity }: any) {
  const isBuy = activity.side === 'BUY';

  return (
    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={cn(
          "w-8 h-8 rounded-lg border flex items-center justify-center shrink-0",
          isBuy ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"
        )}>
          {isBuy ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <ArrowDownRight className="w-4 h-4 text-red-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white line-clamp-1">{activity.market}</div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
            <span className="font-mono">${(activity.amount / 1000).toFixed(0)}K</span>
            <span>•</span>
            <span className="text-gray-500">{activity.time}</span>
          </div>
        </div>
      </div>
      <div className="text-right shrink-0 ml-4">
        <div className={cn("text-sm font-bold", isBuy ? "text-emerald-400" : "text-red-400")}>
          {activity.side}
        </div>
        <div className="text-xs text-gray-500 font-mono">@{activity.price}</div>
      </div>
    </div>
  );
}
