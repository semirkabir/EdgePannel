'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ExternalLink, Loader2, ArrowUpDown, Filter, TrendingUp, DollarSign, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { RightPanel } from '@/components/ui/RightPanel';
import { Button } from '@/components/ui/button';
import { useGeotaggedMarkets } from '@/hooks/use-geotagged-markets';
import { EnrichedMarket } from '@/lib/markets/enrich';

interface GDELTArticle {
  url: string;
  url_mobile?: string;
  title: string;
  seendate: string;
  socialimage?: string;
  domain: string;
  language: string;
  sourcecountry: string;
}

interface CountryNewsPanelProps {
  country: string | null;
  onClose: () => void;
  onMarketSelect?: (market: EnrichedMarket) => void;
}

export function CountryNewsPanel({ country, onClose, onMarketSelect }: CountryNewsPanelProps) {
  const [activeCountry, setActiveCountry] = useState<string | null>(country);
  const [articles, setArticles] = useState<GDELTArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'domain'>('date');
  const [filterDomain, setFilterDomain] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'markets' | 'news'>('markets');

  // Fetch markets for this country (sorted by volume)
  const { markets, isLoading: marketsLoading, total: marketsTotal } = useGeotaggedMarkets({
    country: activeCountry || undefined,
    limit: 10, // Top 10 markets by volume
    enabled: !!activeCountry,
  });

  // Cache the country for animation
  useEffect(() => {
    if (country) {
      setActiveCountry(country);
    }
  }, [country]);

  // Fetch news when activeCountry changes (and is truthy)
  useEffect(() => {
    const fetchNews = async () => {
      if (!activeCountry) return;

      setLoading(true);
      setError(null);
      setArticles([]); // Clear previous articles while loading

      try {
        const response = await fetch(`/api/gdelt/news?country=${encodeURIComponent(activeCountry)}`);

        if (!response.ok) {
          throw new Error('Failed to fetch news');
        }

        const data = await response.json();
        setArticles(data.articles || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load news');
        console.error('Error fetching GDELT news:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [activeCountry]);

  // Get unique domains for filter
  const domains = useMemo(() => {
    const uniqueDomains = Array.from(new Set(articles.map(a => a.domain))).sort();
    return ['all', ...uniqueDomains];
  }, [articles]);

  // Sort and filter articles
  const processedArticles = useMemo(() => {
    let filtered = articles;

    // Filter by domain
    if (filterDomain !== 'all') {
      filtered = filtered.filter(a => a.domain === filterDomain);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.seendate).getTime() - new Date(a.seendate).getTime();
      } else {
        return a.domain.localeCompare(b.domain);
      }
    });

    return sorted;
  }, [articles, sortBy, filterDomain]);

  // Filter news to be relevant to markets (check if article title/domain contains market keywords)
  const relevantArticles = useMemo(() => {
    if (markets.length === 0 || articles.length === 0) return processedArticles;

    // Extract keywords from market titles
    const marketKeywords = new Set<string>();
    markets.forEach(market => {
      const words = market.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      words.forEach(w => marketKeywords.add(w));
    });

    // Score articles based on keyword matches
    const scoredArticles = processedArticles.map(article => {
      const titleWords = article.title.toLowerCase().split(/\s+/);
      const matchCount = titleWords.filter(w => marketKeywords.has(w)).length;
      return { article, score: matchCount };
    });

    // Return all articles, but sorted by relevance
    return scoredArticles
      .sort((a, b) => b.score - a.score)
      .map(item => item.article);
  }, [markets, articles, processedArticles]);

  const formatVolume = (volume: number | null | undefined) => {
    if (!volume) return 'N/A';
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
    return `$${volume.toFixed(0)}`;
  };

  const formatProbability = (prob: number | null | undefined) => {
    if (prob == null) return 'N/A';
    return `${(prob * 100).toFixed(0)}%`;
  };

  return (
    <RightPanel
      isOpen={!!country}
      onClose={onClose}
      title={activeCountry || 'Country'}
    >
      <div className="flex flex-col h-full">
        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-[#0e0f11]/50 sticky top-0 z-10">
          <button
            onClick={() => setActiveTab('markets')}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium transition-all relative",
              activeTab === 'markets'
                ? "text-blue-400"
                : "text-gray-400 hover:text-gray-300"
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span>Markets</span>
              {marketsTotal > 0 && (
                <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">
                  {marketsTotal}
                </span>
              )}
            </div>
            {activeTab === 'markets' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('news')}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium transition-all relative",
              activeTab === 'news'
                ? "text-blue-400"
                : "text-gray-400 hover:text-gray-300"
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span>News</span>
              {articles.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">
                  {articles.length}
                </span>
              )}
            </div>
            {activeTab === 'news' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
            )}
          </button>
        </div>

        {/* Markets Tab */}
        {activeTab === 'markets' && (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {marketsLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <span className="text-gray-400 text-sm animate-pulse">Loading markets...</span>
              </div>
            ) : markets.length === 0 ? (
              <div className="text-center py-12 bg-white/5 rounded-xl border border-white/5">
                <p className="text-gray-400">No markets found for {activeCountry}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-gray-500 font-mono mb-2 flex items-center justify-between">
                  <span>Top {markets.length} by Volume</span>
                  <span className="text-blue-400">Total: {marketsTotal}</span>
                </div>
                {markets.map((market, index) => (
                  <button
                    key={market.id}
                    onClick={() => {
                      if (onMarketSelect) {
                        onMarketSelect(market as EnrichedMarket);
                        onClose();
                      }
                    }}
                    className="w-full text-left p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-blue-500/50 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      {/* Rank Badge */}
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0",
                        index === 0 ? "bg-yellow-500/20 text-yellow-400" :
                        index === 1 ? "bg-gray-400/20 text-gray-300" :
                        index === 2 ? "bg-orange-500/20 text-orange-400" :
                        "bg-white/5 text-gray-500"
                      )}>
                        {index + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-200 group-hover:text-blue-400 transition-colors line-clamp-2 leading-tight mb-2">
                          {market.title}
                        </h3>

                        {/* Market Stats */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Volume</span>
                            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {formatVolume(market.volume24h)}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Probability</span>
                            <span className="text-xs font-bold text-blue-400">
                              {formatProbability(market.probability)}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Platform</span>
                            <span className={cn(
                              "text-xs font-medium uppercase",
                              market.platform === 'polymarket' ? "text-purple-400" : "text-orange-400"
                            )}>
                              {market.platform}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* News Tab */}
        {activeTab === 'news' && (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {/* Sort and Filter Controls */}
            {!loading && !error && articles.length > 0 && (
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2 flex-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'date' | 'domain')}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-200 font-mono outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="date">Newest First</option>
                    <option value="domain">By Source</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <Filter className="w-3.5 h-3.5 text-gray-400" />
                  <select
                    value={filterDomain}
                    onChange={(e) => setFilterDomain(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-200 font-mono outline-none focus:border-blue-500 transition-colors"
                  >
                    {domains.map(domain => (
                      <option key={domain} value={domain}>
                        {domain === 'all' ? 'All Sources' : domain}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <span className="text-gray-400 text-sm animate-pulse">Scanning global news feeds...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12 bg-red-500/10 rounded-xl border border-red-500/20">
                <p className="text-red-400 mb-2 font-medium">{error}</p>
                <p className="text-xs text-gray-400">Please try again later</p>
              </div>
            ) : relevantArticles.length === 0 ? (
              <div className="text-center py-12 bg-white/5 rounded-xl border border-white/5">
                <p className="text-gray-400">
                  {articles.length === 0
                    ? `No recent news found for ${activeCountry}.`
                    : 'No articles match the selected filter.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-gray-500 font-mono mb-2 flex items-center justify-between">
                  <span>Showing {relevantArticles.length} article{relevantArticles.length !== 1 ? 's' : ''}</span>
                  {markets.length > 0 && (
                    <span className="text-blue-400">Sorted by relevance</span>
                  )}
                </div>
                {relevantArticles.map((article, index) => (
                  <a
                    key={index}
                    href={article.url || article.url_mobile || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group relative overflow-hidden"
                  >
                    <div className="flex items-start gap-3">
                      {article.socialimage && (
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                          <img
                            src={article.socialimage}
                            alt=""
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-200 group-hover:text-blue-400 transition-colors line-clamp-2 leading-tight mb-1.5">
                          {article.title}
                        </h3>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono uppercase tracking-wide">
                          <span className="truncate max-w-[100px]">{article.domain}</span>
                          <span>•</span>
                          <span>{new Date(article.seendate).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-blue-400 transition-colors flex-shrink-0 mt-0.5" />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </RightPanel>
  );
}

