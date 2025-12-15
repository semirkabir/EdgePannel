'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { EnrichedMarket } from '@/lib/markets/enrich';

interface AgentChatProps {
    markets: EnrichedMarket[];
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    relatedMarkets?: EnrichedMarket[];
}

export function AgentChat({ markets }: AgentChatProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: "Hello! I'm your EdgePannel AI agent. I can help you find specific markets, analyze trends, or spot arbitrage opportunities across Kalshi and Polymarket. What are you looking for today?",
            timestamp: new Date()
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async () => {
        if (!inputValue.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsTyping(true);

        // Simulate AI processing
        setTimeout(() => {
            const query = userMessage.content.toLowerCase();
            let responseContent = '';
            let relatedMarkets: EnrichedMarket[] = [];

            // Simple keyword matching for demo purposes
            // In a real implementation, this would call an LLM endpoint
            if (query.includes('ufc') || query.includes('fight') || query.includes('mma')) {
                relatedMarkets = markets.filter(m =>
                    m.category?.toLowerCase()?.includes('sports') ||
                    m.title.toLowerCase().includes('ufc') ||
                    m.title.toLowerCase().includes('fight')
                ).slice(0, 3);

                if (relatedMarkets.length > 0) {
                    responseContent = `I found ${relatedMarkets.length} active UFC markets that might interest you. The volume is looking strong on the main card fights. Here are the top ones:`;
                } else {
                    responseContent = "I currently don't see any active UFC markets in the live feed, but typically new fight markets open 5-7 days before the event.";
                }
            } else if (query.includes('politics') || query.includes('election') || query.includes('trump') || query.includes('biden')) {
                relatedMarkets = markets.filter(m =>
                    m.category?.toLowerCase()?.includes('politics')
                ).slice(0, 3);
                responseContent = "Political markets are highly active right now. I've pulled the top trending election contracts based on recent volume spikes.";
            } else if (query.includes('crypto') || query.includes('btc') || query.includes('bitcoin')) {
                relatedMarkets = markets.filter(m =>
                    m.category?.toLowerCase()?.includes('crypto')
                ).slice(0, 3);
                responseContent = "Crypto prediction markets are showing increased volatility. Here are the most liquid Bitcoin contracts currently trading.";
            } else {
                responseContent = "I understand you're looking for market insights. Could you specify a category like Sports, Politics, or Crypto? I can also help you find specific events.";
            }

            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: responseContent,
                timestamp: new Date(),
                relatedMarkets
            };

            setMessages(prev => [...prev, aiMessage]);
            setIsTyping(false);
        }, 1500);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className="flex flex-col h-[500px] bg-[#0e0f11]/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white">Agent Chat</h3>
                        <p className="text-xs text-indigo-300">Ask about any market</p>
                    </div>
                </div>
                <div className="px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-bold text-green-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Live
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={cn(
                            "flex gap-4 max-w-[85%]",
                            message.role === 'user' ? "ml-auto flex-row-reverse" : ""
                        )}
                    >
                        {/* Avatar */}
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
                            message.role === 'assistant'
                                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                                : "bg-gray-700/50 border-gray-600/30 text-gray-300"
                        )}>
                            {message.role === 'assistant' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        </div>

                        {/* Content */}
                        <div className="space-y-4">
                            <div className={cn(
                                "p-4 rounded-2xl text-sm leading-relaxed",
                                message.role === 'assistant'
                                    ? "bg-white/5 border border-white/10 text-gray-200"
                                    : "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                            )}>
                                {message.content}
                            </div>

                            {/* Related Markets (if any) */}
                            {message.relatedMarkets && message.relatedMarkets.length > 0 && (
                                <div className="grid gap-2">
                                    {message.relatedMarkets.map(market => (
                                        <div key={market.id} className="group flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl transition-all cursor-pointer">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className={cn(
                                                    "w-1 h-8 rounded-full shrink-0",
                                                    market.platform === 'polymarket' ? "bg-blue-500" : "bg-green-500"
                                                )} />
                                                <div className="min-w-0">
                                                    <h4 className="text-sm font-medium text-white truncate">{market.title}</h4>
                                                    <p className="text-xs text-gray-500 flex items-center gap-2">
                                                        <span className="uppercase tracking-wider font-bold text-[10px]">{market.platform}</span>
                                                        <span>•</span>
                                                        <span>${(market.volume24h || 0).toLocaleString()} vol</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors shrink-0 ml-4" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div className="flex gap-4 max-w-[85%]">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                            <Bot className="w-4 h-4" />
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/5 bg-black/20">
                <div className="relative flex items-center">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about markets, trends, or specific events..."
                        className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 focus:border-indigo-500/50 rounded-xl pl-4 pr-12 py-3.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-all"
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || isTyping}
                        className="absolute right-2 p-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
                    >
                        {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
}

