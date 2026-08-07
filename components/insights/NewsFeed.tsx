'use client';

import { useState, useEffect, useCallback } from 'react';
import { Twitter, RefreshCw, Heart, Repeat, Share2, ExternalLink, MessageCircle, Flame, TrendingUp, Globe, Coins, Shield, Radio } from 'lucide-react';
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

// News stream channel definitions
const NEWS_CHANNELS = [
    { key: 'ALL',         label: 'All Streams',   icon: Radio,      color: '#00ff7f', glowColor: 'rgba(0,255,127,0.4)' },
    { key: 'BREAKING',    label: 'Breaking',       icon: Flame,      color: '#ff4444', glowColor: 'rgba(255,68,68,0.5)' },
    { key: 'LIVE',        label: 'Live',           icon: Radio,      color: '#ff3b3b', glowColor: 'rgba(255,59,59,0.5)' },
    { key: 'MARKETS',     label: 'Markets',        icon: TrendingUp, color: '#ffb000', glowColor: 'rgba(255,176,0,0.4)' },
    { key: 'GEOPOLITICS', label: 'Geopolitics',    icon: Globe,      color: '#3b82f6', glowColor: 'rgba(59,130,246,0.4)' },
    { key: 'CRYPTO',      label: 'Crypto',         icon: Coins,      color: '#facc15', glowColor: 'rgba(250,204,21,0.4)' },
    { key: 'DEFENSE',     label: 'Defense',        icon: Shield,     color: '#a78bfa', glowColor: 'rgba(167,139,250,0.4)' },
] as const;

export function NewsFeed() {
    const [tweets, setTweets] = useState<Tweet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [trackedAccounts, setTrackedAccounts] = useState<string[]>(['Polymarket', 'Kalshi']);
    const [newAccount, setNewAccount] = useState('');
    const [showInput, setShowInput] = useState(false);
    const [activeChannel, setActiveChannel] = useState('ALL');

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
            {/* Keyframes for pulsing neon ring */}
            <style>{`
                @keyframes neon-pulse {
                    0%, 100% { box-shadow: 0 0 4px var(--neon-color), 0 0 8px var(--neon-color), inset 0 0 6px var(--neon-color); opacity: 1; }
                    50% { box-shadow: 0 0 8px var(--neon-color), 0 0 16px var(--neon-color), inset 0 0 10px var(--neon-color); opacity: 0.85; }
                }
                @keyframes dot-breathe {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.4); opacity: 0.7; }
                }
            `}</style>

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

                {/* ─── News Channel Capsule Track ─── */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                    {NEWS_CHANNELS.map((channel) => {
                        const isActive = activeChannel === channel.key;
                        const Icon = channel.icon;
                        return (
                            <button
                                key={channel.key}
                                onClick={() => setActiveChannel(channel.key)}
                                className={cn(
                                    "relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-300 flex-shrink-0 cursor-pointer select-none",
                                    isActive
                                        ? "bg-white/[0.08] backdrop-blur-md text-white"
                                        : "bg-white/[0.02] backdrop-blur-sm text-gray-500 hover:text-gray-300 hover:bg-white/[0.05] border border-transparent hover:border-white/10"
                                )}
                                style={isActive ? {
                                    ['--neon-color' as string]: channel.glowColor,
                                    borderColor: channel.color + '66',
                                    animation: 'neon-pulse 2s ease-in-out infinite',
                                } : undefined}
                            >
                                {/* Dot indicator */}
                                <span
                                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                    style={{
                                        backgroundColor: isActive ? channel.color : 'rgba(255,255,255,0.2)',
                                        boxShadow: isActive ? `0 0 6px ${channel.glowColor}` : 'none',
                                        animation: isActive ? 'dot-breathe 2s ease-in-out infinite' : 'none',
                                    }}
                                />
                                <Icon className="w-3 h-3" style={{ color: isActive ? channel.color : undefined }} />
                                <span>{channel.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Tracked Accounts */}
                <div className="flex flex-wrap gap-2 pt-3 mt-2 border-t border-white/5">
                    {trackedAccounts.map(account => (
                        <div 
                            key={account} 
                            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-amber-500/40 text-[10px] font-mono text-gray-300 hover:text-amber-400 font-bold transition-all duration-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:shadow-[0_0_8px_rgba(245,158,11,0.25)] group/capsule"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 transition-all shadow-[0_0_4px_rgba(245,158,11,0.6)] group-hover/capsule:scale-110" />
                            <span>{account}</span>
                            <button
                                onClick={() => removeAccount(account)}
                                className="text-gray-500 hover:text-red-400 transition-colors text-xs font-bold pl-1 font-sans"
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
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return 'Recent';

            const now = new Date();
            const diff = (now.getTime() - date.getTime()) / 1000; // seconds

            if (diff < 60) return 'Just now';
            if (diff < 3600) return `${Math.floor(diff / 60)}m`;
            if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
            return date.toLocaleDateString();
        } catch (e) {
            return 'Recent';
        }
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
