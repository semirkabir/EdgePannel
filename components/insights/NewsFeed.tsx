'use client';

import { useState, useEffect, useCallback } from 'react';
import { Twitter, RefreshCw, Heart, Repeat, Share2, ExternalLink, MessageCircle } from 'lucide-react';
import Image from 'next/image';

import { cn } from '@/lib/utils/cn';

interface Tweet {
    id: string;
    author: string;
    handle: string;
    avatar?: string;
    content: string;
    timestamp: string;
    platform: 'twitter' | 'internal' | 'news';
    likes: number;
    retweets: number;
    url?: string;
}

export function NewsFeed() {
    const [tweets, setTweets] = useState<Tweet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [trackedAccounts, setTrackedAccounts] = useState<string[]>(['Polymarket', 'Kalshi']);
    const [newAccount, setNewAccount] = useState('');
    const [showInput, setShowInput] = useState(false);

    const fetchTweets = useCallback(async (refresh = false) => {
        if (refresh) setIsRefreshing(true);
        try {
            const accountsParam = trackedAccounts.map(a => a.replace('@', '')).join(',');
            const res = await fetch(`/api/tweets?accounts=${encodeURIComponent(accountsParam)}`);
            const data = await res.json();
            setTweets(data.tweets);
        } catch (error) {
            console.error('Failed to fetch tweets:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [trackedAccounts]);

    useEffect(() => {
        fetchTweets();
        const interval = setInterval(() => fetchTweets(true), 60000);
        return () => clearInterval(interval);
    }, [fetchTweets]); // Refetch when fetchTweets changes (which happens when trackedAccounts change)

    const handleAddAccount = (e: React.FormEvent) => {
        e.preventDefault();
        if (newAccount.trim()) {
            // Add if not already present
            if (!trackedAccounts.includes(newAccount.trim())) {
                setTrackedAccounts(prev => [...prev, newAccount.trim()]);
            }
            setNewAccount('');
            setShowInput(false);
        }
    };

    const removeAccount = (account: string) => {
        setTrackedAccounts(prev => prev.filter(a => a !== account));
    };

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-white/5 to-white/10 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm shadow-lg shadow-blue-500/5">
            {/* Header */}
            <div className="p-5 border-b border-white/10 bg-gradient-to-r from-white/5 to-white/10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/10">
                            <Twitter className="w-5 h-5 text-blue-400" />
                        </div>
                        <h2 className="font-bold text-white text-lg">Live News Feed</h2>
                        <span className="flex h-2.5 w-2.5 relative ml-1">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500 shadow-lg shadow-green-500/50"></span>
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowInput(!showInput)}
                            className={cn(
                                "px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 active:scale-95",
                                showInput
                                    ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30"
                                    : "bg-white/10 text-gray-300 hover:bg-white/20 border border-white/10"
                            )}
                        >
                            <span>+ Add</span>
                        </button>
                        <button
                            onClick={() => fetchTweets(true)}
                            disabled={isRefreshing}
                            className={cn(
                                "p-2.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all duration-200 border border-white/10",
                                isRefreshing && "animate-spin bg-white/10 text-blue-400"
                            )}
                            title="Refresh news feed"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Active Filters */}
                <div className="flex flex-wrap gap-2">
                    {trackedAccounts.map(account => (
                        <div key={account} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500/20 to-blue-600/10 border border-blue-500/30 text-[10px] text-blue-300 font-medium transition-all hover:from-blue-500/30 hover:to-blue-600/20">
                            <span>{account}</span>
                            <button
                                onClick={() => removeAccount(account)}
                                className="hover:text-red-400 transition-colors font-bold text-xs"
                                title="Remove account"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>

                {/* Add Input */}
                {showInput && (
                    <form onSubmit={handleAddAccount} className="mt-4 flex gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <input
                            type="text"
                            value={newAccount}
                            onChange={(e) => setNewAccount(e.target.value)}
                            placeholder="Add handle (e.g. @ElonMusk)..."
                            className="flex-1 px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            autoFocus
                        />
                        <button
                            type="submit"
                            className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-xs font-bold rounded-lg transition-all duration-200 active:scale-95 shadow-lg shadow-blue-500/30"
                        >
                            Add
                        </button>
                    </form>
                )}
            </div>

            {/* Feed */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {isLoading ? (
                    <div className="p-8 text-center text-gray-500 space-y-3 flex flex-col items-center justify-center h-full">
                        <div className="relative w-8 h-8">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-lg animate-pulse" />
                            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                        </div>
                        <p className="text-xs font-mono">Loading feed...</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/10">
                        {tweets.length > 0 ? (
                            tweets.map((tweet) => (
                                <TweetCard key={tweet.id} tweet={tweet} />
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center h-full">
                                <p className="text-xs">No updates found for these accounts.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function TweetCard({ tweet }: { tweet: Tweet }) {
    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = (now.getTime() - date.getTime()) / 1000; // seconds

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
        return date.toLocaleDateString();
    };

    return (
        <div className="p-4 hover:bg-white/10 transition-all duration-300 group border-white/5 hover:border-white/10 hover:border-l-4 hover:border-l-blue-500/50">
            <div className="flex gap-3.5">
                {/* Avatar */}
                <div className="flex-shrink-0 mt-0.5">
                    <div className="relative w-11 h-11">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md" />
                        <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 p-[2px] shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all duration-300">
                            {tweet.avatar ? (
                                <Image
                                    src={tweet.avatar}
                                    alt={tweet.author}
                                    width={44}
                                    height={44}
                                    className="w-full h-full rounded-full object-cover border-2 border-[#0a0b0d]"
                                />
                            ) : (
                                <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border-2 border-[#0a0b0d]">
                                    <span className="text-sm font-bold text-white">{tweet.author[0]}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <span className="font-bold text-white truncate text-sm group-hover:text-blue-300 transition-colors">{tweet.author}</span>
                            <span className="text-gray-500 text-xs truncate group-hover:text-gray-400 transition-colors">{tweet.handle}</span>
                            <span className="text-gray-600 text-[10px]">•</span>
                            <span className="text-gray-500 text-xs whitespace-nowrap group-hover:text-gray-400 transition-colors">{formatTime(tweet.timestamp)}</span>
                        </div>
                        <a
                            href={tweet.url || `https://twitter.com/${tweet.handle.replace('@', '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all duration-300 p-1.5 hover:bg-white/10 rounded-lg"
                            title="Open on Twitter"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </div>

                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap mb-3 group-hover:text-gray-100 transition-colors">
                        {tweet.content}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-4 text-gray-500 opacity-70 group-hover:opacity-100 transition-opacity">
                        <button className="flex items-center gap-1.5 group/btn hover:text-blue-400 hover:bg-white/10 px-2 py-1.5 rounded-lg transition-all duration-200" title="Reply">
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">Reply</span>
                        </button>
                        <button className="flex items-center gap-1.5 group/btn hover:text-green-400 hover:bg-white/10 px-2 py-1.5 rounded-lg transition-all duration-200" title="Retweet">
                            <Repeat className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">{tweet.retweets}</span>
                        </button>
                        <button className="flex items-center gap-1.5 group/btn hover:text-pink-400 hover:bg-white/10 px-2 py-1.5 rounded-lg transition-all duration-200" title="Like">
                            <Heart className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">{tweet.likes}</span>
                        </button>
                        <button className="flex items-center gap-1.5 group/btn hover:text-blue-400 hover:bg-white/10 px-2 py-1.5 rounded-lg transition-all duration-200" title="Share">
                            <Share2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
