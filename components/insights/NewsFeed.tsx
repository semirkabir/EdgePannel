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
        <div className="flex flex-col h-full bg-white/5 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm">
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-white/5">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Twitter className="w-5 h-5 text-blue-400" />
                        <h2 className="font-bold text-white">Live News Feed</h2>
                        <span className="flex h-2 w-2 relative ml-1">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowInput(!showInput)}
                            className={cn(
                                "p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors",
                                showInput && "bg-white/10 text-white"
                            )}
                        >
                            <span className="text-xs font-bold">+ Add</span>
                        </button>
                        <button
                            onClick={() => fetchTweets(true)}
                            disabled={isRefreshing}
                            className={cn(
                                "p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors",
                                isRefreshing && "animate-spin"
                            )}
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Active Filters */}
                <div className="flex flex-wrap gap-2">
                    {trackedAccounts.map(account => (
                        <div key={account} className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] text-gray-300">
                            <span>{account}</span>
                            <button
                                onClick={() => removeAccount(account)}
                                className="hover:text-red-400"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>

                {/* Add Input */}
                {showInput && (
                    <form onSubmit={handleAddAccount} className="mt-3 flex gap-2">
                        <input
                            type="text"
                            value={newAccount}
                            onChange={(e) => setNewAccount(e.target.value)}
                            placeholder="Add handle (e.g. @ElonMusk)..."
                            className="flex-1 px-3 py-1.5 bg-black/20 border border-white/10 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                            autoFocus
                        />
                        <button
                            type="submit"
                            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded"
                        >
                            Add
                        </button>
                    </form>
                )}
            </div>

            {/* Feed */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {isLoading ? (
                    <div className="p-8 text-center text-gray-500 space-y-3">
                        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
                        <p className="text-xs font-mono">Loading feed...</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {tweets.length > 0 ? (
                            tweets.map((tweet) => (
                                <TweetCard key={tweet.id} tweet={tweet} />
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-500">
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
        <div className="p-4 hover:bg-white/5 transition-colors group">
            <div className="flex gap-3">
                {/* Avatar */}
                <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 p-[1px]">
                        {tweet.avatar ? (
                            <Image
                                src={tweet.avatar}
                                alt={tweet.author}
                                width={40}
                                height={40}
                                className="w-full h-full rounded-full object-cover border-2 border-[#0a0b0d]"
                            />
                        ) : (

                            <div className="w-full h-full rounded-full bg-[#0a0b0d] flex items-center justify-center border-2 border-[#0a0b0d]">
                                <span className="text-xs font-bold text-white">{tweet.author[0]}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="font-bold text-white truncate text-sm">{tweet.author}</span>
                            <span className="text-gray-500 text-xs truncate">{tweet.handle}</span>
                            <span className="text-gray-600 text-[10px]">•</span>
                            <span className="text-gray-500 text-xs whitespace-nowrap">{formatTime(tweet.timestamp)}</span>
                        </div>
                        <a
                            href={tweet.url || `https://twitter.com/${tweet.handle.replace('@', '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>

                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap mb-3">
                        {tweet.content}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center justify-between max-w-[80%] text-gray-500">
                        <button className="flex items-center gap-1.5 group/btn hover:text-blue-400 transition-colors">
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span className="text-xs">Reply</span>
                        </button>
                        <button className="flex items-center gap-1.5 group/btn hover:text-green-400 transition-colors">
                            <Repeat className="w-3.5 h-3.5" />
                            <span className="text-xs">{tweet.retweets}</span>
                        </button>
                        <button className="flex items-center gap-1.5 group/btn hover:text-pink-400 transition-colors">
                            <Heart className="w-3.5 h-3.5" />
                            <span className="text-xs">{tweet.likes}</span>
                        </button>
                        <button className="flex items-center gap-1.5 group/btn hover:text-blue-400 transition-colors">
                            <Share2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
