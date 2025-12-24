import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useExchangeMovers } from '@/hooks/use-exchange-movers';
import { StockMover } from '@/types/exchange';

interface ExchangePopupProps {
  exchangeId: string;
  exchangeName: string;
  shortName: string;
  isOpen: boolean;
  city?: string;
  country?: string;
  onViewDetails: () => void;
}

export function ExchangePopup({
  exchangeId,
  exchangeName,
  shortName,
  isOpen,
  city,
  country,
  onViewDetails,
}: ExchangePopupProps) {
  const [activeTab, setActiveTab] = useState<'gainers' | 'losers' | 'volume'>('gainers');
  const { gainers, losers, mostActive, isLoading } = useExchangeMovers(exchangeId, true);
  const [logoError, setLogoError] = useState(false);

  const currentData = activeTab === 'gainers' ? gainers : activeTab === 'losers' ? losers : mostActive;

  // Exchange logo URLs - using Clearbit Logo API (works with domains)
  const domainMap: Record<string, string> = {
    'nyse': 'nyse.com',
    'nasdaq': 'nasdaq.com',
    'lse': 'londonstockexchange.com',
    'jpx': 'jpx.co.jp',
    'hkex': 'hkex.com.hk',
    'xetra': 'deutsche-boerse.com',
    'sse': 'sse.com.cn',
    'szse': 'szse.cn',
    'six': 'six-group.com',
    'tsx': 'tsx.com',
    'b3': 'b3.com.br',
    'euronext_paris': 'euronext.com',
    'nse': 'nseindia.com',
    'bse': 'bseindia.com',
    'sgx': 'sgx.com',
    'krx': 'krx.co.kr',
    'asx': 'asx.com.au',
    'tadawul': 'saudiexchange.sa',
    'tase': 'tase.co.il',
  };

  const domain = domainMap[exchangeId];
  // Use Clearbit Logo API - provides high quality logos
  const logoUrl = domain ? `https://logo.clearbit.com/${domain}` : null;

  return (
    <div className="w-[320px] bg-gradient-to-br from-gray-900/98 via-gray-900/95 to-gray-950/98 border border-gray-700/50 rounded-lg p-3 text-white shadow-2xl backdrop-blur-xl">
      {/* Header with Logo */}
      <div className="mb-3">
        <div className="flex items-start gap-3 mb-2">
          {/* Exchange Logo */}
          <div className="w-12 h-12 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center shrink-0 p-1.5">
            {logoUrl && !logoError ? (
              <img
                src={logoUrl}
                alt={shortName}
                className="w-full h-full object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="text-base font-black text-emerald-400/90">{shortName.substring(0, 3)}</div>
            )}
          </div>

          {/* Exchange Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="font-bold text-sm text-white truncate">{shortName}</h3>
              <span
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-semibold shrink-0',
                  isOpen
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    : 'bg-gray-500/20 text-gray-300 border border-gray-400/30'
                )}
              >
                {isOpen ? '● OPEN' : '● CLOSED'}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 truncate mb-0.5">{exchangeName}</p>
            {city && country && (
              <p className="text-[9px] text-gray-500">{city}, {country}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3 bg-gray-800/40 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('gainers')}
          className={cn(
            'flex-1 px-2 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-1',
            activeTab === 'gainers'
              ? 'bg-emerald-600 text-white'
              : 'text-gray-400 hover:text-gray-200'
          )}
        >
          <TrendingUp className="w-3 h-3" />
          Gainers
        </button>
        <button
          onClick={() => setActiveTab('losers')}
          className={cn(
            'flex-1 px-2 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-1',
            activeTab === 'losers'
              ? 'bg-red-600 text-white'
              : 'text-gray-400 hover:text-gray-200'
          )}
        >
          <TrendingDown className="w-3 h-3" />
          Losers
        </button>
        <button
          onClick={() => setActiveTab('volume')}
          className={cn(
            'flex-1 px-2 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-1',
            activeTab === 'volume'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-gray-200'
          )}
        >
          <Activity className="w-3 h-3" />
          Volume
        </button>
      </div>

      {/* Content */}
      <div className="space-y-1.5 mb-3 max-h-[240px] overflow-y-auto scrollbar-hide">
        {isLoading ? (
          <div className="text-center py-4 text-xs text-gray-400">Loading...</div>
        ) : currentData.length === 0 ? (
          <div className="text-center py-4 text-xs text-gray-400">No data available</div>
        ) : (
          currentData.map((stock, idx) => (
            <StockMoverRow key={idx} stock={stock} rank={idx + 1} />
          ))
        )}
      </div>

      {/* View Details Button */}
      <button
        onClick={onViewDetails}
        className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-bold py-2 px-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-emerald-500/30"
      >
        VIEW FULL DETAILS →
      </button>
    </div>
  );
}

function StockMoverRow({ stock, rank }: { stock: StockMover; rank: number }) {
  const isPositive = stock.changePercent >= 0;

  return (
    <div className="flex items-center gap-2 bg-gray-800/30 rounded-lg p-2 border border-gray-700/20">
      {/* Rank */}
      <div className="w-5 h-5 flex items-center justify-center bg-gray-700/40 rounded text-[9px] font-bold text-gray-400 shrink-0">
        {rank}
      </div>

      {/* Stock Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-[11px] text-white">{stock.ticker}</span>
          <span
            className={cn(
              'text-[10px] font-bold',
              isPositive ? 'text-emerald-400' : 'text-red-400'
            )}
          >
            {isPositive ? '+' : ''}
            {stock.changePercent.toFixed(2)}%
          </span>
        </div>
        <div className="text-[9px] text-gray-400 truncate">{stock.name}</div>
      </div>

      {/* Price */}
      <div className="text-right shrink-0">
        <div className="text-[11px] font-semibold text-white">
          ${stock.price.toFixed(2)}
        </div>
        <div className="text-[9px] text-gray-500">
          {formatVolume(stock.volume)}
        </div>
      </div>
    </div>
  );
}

function formatVolume(volume: number): string {
  if (volume >= 1e9) return `${(volume / 1e9).toFixed(1)}B`;
  if (volume >= 1e6) return `${(volume / 1e6).toFixed(1)}M`;
  if (volume >= 1e3) return `${(volume / 1e3).toFixed(1)}K`;
  return volume.toString();
}
