'use client';

import React, { useState, useEffect } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
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

  return (
    <RightPanel
      isOpen={!!country}
      onClose={onClose}
      title={`News: ${activeCountry || 'Country'}`}
      subtitle={
        <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400">
          POWERED BY GDELT
        </span>
      }
    >
      <div className="px-5 py-4">
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
        ) : articles.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-xl border border-white/5">
            <p className="text-gray-400">No recent high-impact news found for {activeCountry}.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map((article, index) => (
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
