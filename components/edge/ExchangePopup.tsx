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
  status?: string;
  nextStatusText?: string;
  timeUntilNextStatus?: string;
  exchangeTime?: string;
  localOpenTime?: string;
  localCloseTime?: string;
  userTimezone?: string;
  onViewDetails: () => void;
}

export function ExchangePopup({
  exchangeId,
  exchangeName,
  shortName,
  isOpen,
  status,
  nextStatusText,
  timeUntilNextStatus,
  exchangeTime,
  localOpenTime,
  localCloseTime,
  userTimezone,
  city,
  country,
  onViewDetails,
}: ExchangePopupProps) {
  const [activeTab, setActiveTab] = useState<'gainers' | 'losers' | 'volume'>('gainers');
  const { gainers, losers, mostActive, isLoading } = useExchangeMovers(exchangeId, true);
  const [logoError, setLogoError] = useState(false);

  const currentData = activeTab === 'gainers' ? gainers : activeTab === 'losers' ? losers : mostActive;

  const parseMinutes = (time?: string) => {
    if (!time) return null;
    const [h, m] = time.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

  const currentMinutes = parseMinutes(exchangeTime);
  const openMinutes = parseMinutes(localOpenTime);
  const closeMinutes = parseMinutes(localCloseTime);

  // Progress across regular session (0-1)
  let sessionProgress: number | null = null;
  if (currentMinutes != null && openMinutes != null && closeMinutes != null) {
    const wraps = closeMinutes < openMinutes;
    const total = wraps ? (1440 - openMinutes + closeMinutes) : (closeMinutes - openMinutes);
    const elapsed = wraps
      ? (currentMinutes >= openMinutes ? currentMinutes - openMinutes : 1440 - openMinutes + currentMinutes)
      : (currentMinutes - openMinutes);
    sessionProgress = clamp(elapsed / total, 0, 1);
  }

  const statusLine = (() => {
    if (isOpen) {
      if (nextStatusText && timeUntilNextStatus) return `${nextStatusText} ${timeUntilNextStatus}`;
      return 'Session in progress';
    }
    if (nextStatusText && timeUntilNextStatus) return `${nextStatusText} ${timeUntilNextStatus}`;
    return 'Market closed';
  })();

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
          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shrink-0 p-1.5 shadow-[0_0_15px_rgba(255,255,255,0.1)] border border-white/20">
            {logoUrl && !logoError ? (
              <img
                src={logoUrl}
                alt={shortName}
                className="w-full h-full object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="text-base font-black text-emerald-600">{shortName.substring(0, 3)}</div>
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
            <div className="mt-1 text-[10px] text-gray-400">
              {isOpen
                ? (nextStatusText ? `${nextStatusText} ${timeUntilNextStatus || ''}`.trim() : 'Market hours in session')
                : (timeUntilNextStatus ? `${nextStatusText || 'Opens in'} ${timeUntilNextStatus}` : 'Market closed')}
            </div>
            {(localOpenTime || localCloseTime) && (
              <div className="text-[9px] text-gray-500 mt-0.5">
                Hours: {localOpenTime || '—'} – {localCloseTime || '—'} {userTimezone ? `(${userTimezone})` : ''}
              </div>
            )}
            {exchangeTime && (
              <div className="text-[9px] text-gray-500">
                Local exchange time: {exchangeTime}
              </div>
            )}
          </div>
        </div>

        {/* Status pill inspired by design */}
        <div className="mt-2 bg-gray-800/70 border border-gray-700/50 rounded-lg p-2.5">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                isOpen ? 'bg-emerald-400' : 'bg-gray-500'
              )}
            />
            <div className="text-xs font-semibold text-white">
              {isOpen ? 'Market open' : 'Market closed'}
            </div>
          </div>
          <div className="text-[11px] text-gray-200 font-semibold mb-1">
            {statusLine}
          </div>
          {(localOpenTime || localCloseTime) && (
            <div className="text-[10px] text-gray-400 mb-2">
              {isOpen ? 'Closes' : 'Opens'}: {isOpen ? localCloseTime || '—' : localOpenTime || '—'} {userTimezone ? `(${userTimezone})` : ''}
            </div>
          )}
          {sessionProgress != null && (
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <span>{localOpenTime || 'Open'}</span>
              <div className="flex-1 h-2.5 bg-gray-900/80 rounded-full overflow-hidden border border-gray-700/70">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    isOpen ? 'bg-emerald-500' : 'bg-gray-600'
                  )}
                  style={{ width: `${sessionProgress * 100}%` }}
                />
              </div>
              <span>{localCloseTime || 'Close'}</span>
            </div>
          )}
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
  const [imgError, setImgError] = useState(false);

  // Common ticker to domain mapping for better logo fetching via Clearbit
  const tickerDomains: Record<string, string> = {
    'AAPL': 'apple.com',
    'MSFT': 'microsoft.com',
    'GOOGL': 'google.com',
    'GOOG': 'google.com',
    'AMZN': 'amazon.com',
    'META': 'meta.com',
    'TSLA': 'tesla.com',
    'NVDA': 'nvidia.com',
    'NFLX': 'netflix.com',
    'DIS': 'disney.com',
    'BABA': 'alibaba.com',
    'TCEHY': 'tencent.com',
    'V': 'visa.com',
    'MA': 'mastercard.com',
    'JPM': 'jpmorganchase.com',
    'WMT': 'walmart.com',
    'KO': 'cocacola.com',
    'PEP': 'pepsico.com',
    'BAC': 'bankofamerica.com',
    'XOM': 'exxonmobil.com',
    'CVX': 'chevron.com',
  };

  const domain = tickerDomains[stock.ticker.toUpperCase()];
  const logoUrl = domain
    ? `https://logo.clearbit.com/${domain}`
    : `https://images.financialmodelingprep.com/symbol/${stock.ticker.toUpperCase()}.png`;

  return (
    <div className="flex items-center gap-2 bg-gray-800/30 rounded-lg p-2 border border-gray-700/20 hover:bg-gray-800/50 transition-colors group">
      {/* Rank or Logo */}
      <div className="w-8 h-8 flex items-center justify-center bg-gray-700/40 rounded overflow-hidden shrink-0 border border-gray-700/30">
        {!imgError ? (
          <img
            src={logoUrl}
            alt={stock.ticker}
            className="w-full h-full object-contain p-1"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="text-[10px] font-bold text-gray-500">{stock.ticker.substring(0, 2)}</div>
        )}
      </div>

      {/* Stock Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-[11px] text-white">{stock.ticker}</span>
          <span
            className={cn(
              'text-[10px] font-bold',
              isPositive ? 'text-emerald-400' : 'text-rose-400'
            )}
          >
            {isPositive ? '+' : ''}
            {stock.changePercent.toFixed(2)}%
          </span>
        </div>
        <div className="text-[9px] text-gray-400 truncate group-hover:text-gray-200 transition-colors">{stock.name}</div>
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
