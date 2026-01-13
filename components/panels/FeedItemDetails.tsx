'use client';

import { ExternalLink, Flame, Zap, Globe, Briefcase, Landmark, Coins, Factory, Activity, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface FeedItemDetailsProps {
    data: any;
}

const FEED_ICONS: Record<string, any> = {
    'conflict': Flame,
    'tech': Zap,
    'geopolitics': Globe,
    'contracts': Briefcase,
    'policy': Landmark,
    'crypto-whale': Coins,
    'commodities': Factory,
    'layoffs': Activity,
    'money-printer': Banknote
};

const FEED_COLORS: Record<string, string> = {
    'conflict': 'text-red-500',
    'tech': 'text-cyan-400',
    'geopolitics': 'text-blue-400',
    'contracts': 'text-emerald-400',
    'policy': 'text-violet-400',
    'crypto-whale': 'text-indigo-400',
    'commodities': 'text-orange-400',
    'layoffs': 'text-rose-400',
    'money-printer': 'text-green-400'
};

export function FeedItemDetails({ data }: FeedItemDetailsProps) {
    const Icon = FEED_ICONS[data.layer] || Activity;
    const colorClass = FEED_COLORS[data.layer] || 'text-gray-400';

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header Section */}
            <div className="px-4 pt-6 pb-2">
                <div className="flex items-start gap-4 mb-4">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 shrink-0", colorClass)}>
                        <Icon className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-[10px] font-mono opacity-50 uppercase tracking-widest mb-1">
                            {data.layer?.replace('-', ' ') || 'INTELLIGENCE'}
                        </div>
                        <h2 className="text-xl font-bold text-white leading-tight">
                            {data.title || 'Unknown Event'}
                        </h2>
                    </div>
                </div>

                {/* Subtitle / Key Metric */}
                {data.subTitle && (
                    <div className="text-lg text-white/80 font-mono mb-4 border-l-2 border-white/20 pl-3">
                        {data.subTitle}
                    </div>
                )}

                {/* Value Metric (e.g. Contract Amount) */}
                {data.value && (
                    <div className="mb-6">
                        <div className="text-xs text-gray-500 font-mono mb-1">VALUE / AMOUNT</div>
                        <div className={cn("text-3xl font-black tabular-nums", colorClass)}>
                            {data.value}
                        </div>
                    </div>
                )}
            </div>

            {/* Details Scroll Area */}
            <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-6 custom-scrollbar">

                {/* Description */}
                {data.description && (
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Summary</h4>
                        <p className="text-sm text-gray-300 leading-relaxed font-mono">
                            {data.description}
                        </p>
                    </div>
                )}

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-3">
                    {data.agency && (
                        <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                            <div className="text-[10px] text-gray-500 uppercase font-bold text-center">Agency</div>
                            <div className="text-sm text-white text-center font-mono mt-1">{data.agency}</div>
                        </div>
                    )}
                    {data.recipient && (
                        <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                            <div className="text-[10px] text-gray-500 uppercase font-bold text-center">Recipient</div>
                            <div className="text-sm text-white text-center font-mono mt-1">{data.recipient}</div>
                        </div>
                    )}
                    {data.ticker && (
                        <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                            <div className="text-[10px] text-gray-500 uppercase font-bold text-center">Ticker</div>
                            <div className="text-sm text-white text-center font-mono mt-1">{data.ticker}</div>
                        </div>
                    )}
                    {data.employees && (
                        <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                            <div className="text-[10px] text-gray-500 uppercase font-bold text-center">Impact</div>
                            <div className="text-sm text-white text-center font-mono mt-1">{data.employees} Employees</div>
                        </div>
                    )}
                </div>

                {/* Source Link */}
                {(data.url || data.sourceUrl) && (
                    <Button
                        className="w-full h-12 bg-white/10 hover:bg-white/20 text-white font-bold border border-white/10 rounded-xl transition-all group"
                        onClick={() => window.open(data.url || data.sourceUrl, '_blank')}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <span>View Source</span>
                            <ExternalLink className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </Button>
                )}
            </div>
        </div>
    );
}
