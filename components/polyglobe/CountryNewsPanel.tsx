'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ExternalLink, Loader2, ArrowUpDown, Filter } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { RightPanel } from '@/components/ui/RightPanel';
import { Button } from '@/components/ui/button';

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
}

export function CountryNewsPanel({ country, onClose }: CountryNewsPanelProps) {
  const [activeCountry, setActiveCountry] = useState<string | null>(country);
  const [articles, setArticles] = useState<GDELTArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'domain'>('date');
  const [filterDomain, setFilterDomain] = useState<string>('all');

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

  return (
    <RightPanel
      isOpen={!!country}
      onClose={onClose}
      title={`News: ${activeCountry || 'Country'}`}
    >
      <div className="px-5 py-4">
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
        ) : processedArticles.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-xl border border-white/5">
            <p className="text-gray-400">
              {articles.length === 0
                ? `No recent news found for ${activeCountry}.`
                : 'No articles match the selected filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-gray-500 font-mono mb-2">
              Showing {processedArticles.length} article{processedArticles.length !== 1 ? 's' : ''}
            </div>
            {processedArticles.map((article, index) => (
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
                    {/* Abstract/Snippet if available in future */}
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-blue-400 transition-colors flex-shrink-0 mt-0.5" />
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </RightPanel>
  );
}
