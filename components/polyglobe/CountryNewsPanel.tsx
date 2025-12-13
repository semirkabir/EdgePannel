'use client';

import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

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
  country: string;
  onClose: () => void;
}

export function CountryNewsPanel({ country, onClose }: CountryNewsPanelProps) {
  const [articles, setArticles] = useState<GDELTArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/gdelt/news?country=${encodeURIComponent(country)}`);
        
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

    if (country) {
      fetchNews();
    }
  }, [country]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />
      <div 
        className="relative w-full max-w-2xl max-h-[80vh] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden pointer-events-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50">
          <div>
            <h2 className="text-xl font-bold text-white">News: {country}</h2>
            <p className="text-sm text-gray-400 mt-1">Powered by GDELT</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              <span className="ml-3 text-gray-400">Loading news...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-400 mb-2">{error}</p>
              <p className="text-sm text-gray-400">Please try again later</p>
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No recent news found for {country}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {articles.map((article, index) => (
                <a
                  key={index}
                  href={article.url || article.url_mobile || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 bg-gray-800/50 border border-gray-700 rounded-lg hover:bg-gray-800 hover:border-blue-500/50 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    {article.socialimage && (
                      <img
                        src={article.socialimage}
                        alt=""
                        className="w-20 h-20 object-cover rounded flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium group-hover:text-blue-400 transition-colors line-clamp-2 mb-2">
                        {article.title}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="truncate">{article.domain}</span>
                        <span>•</span>
                        <span>{new Date(article.seendate).toLocaleDateString()}</span>
                        {article.language && article.language !== 'unknown' && (
                          <>
                            <span>•</span>
                            <span className="uppercase">{article.language}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition-colors flex-shrink-0 mt-1" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

