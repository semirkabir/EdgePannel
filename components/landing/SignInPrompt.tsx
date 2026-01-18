'use client';

import { Button } from '@/components/ui/button';
import { LogIn, UserPlus, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useCallback } from 'react';

interface SignInPromptProps {
    isOpen: boolean;
    onClose: () => void;
    marketTitle?: string;
}

export function SignInPrompt({ isOpen, onClose, marketTitle }: SignInPromptProps) {
    // Close on escape key
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-black border border-white/20 p-6 sm:p-8 max-w-md w-full mx-4 shadow-2xl">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 text-white/40 hover:text-white transition-colors"
                >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* Content */}
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#00ff7f]/10 border border-[#00ff7f]/30 mb-4 sm:mb-6">
                        <LogIn className="w-6 h-6 sm:w-8 sm:h-8 text-[#00ff7f]" />
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">
                        UNLOCK FULL ACCESS
                    </h2>

                    {marketTitle && (
                        <p className="text-xs sm:text-sm text-white/60 font-mono mb-3 sm:mb-4 line-clamp-2">
                            {marketTitle}
                        </p>
                    )}

                    <p className="text-xs sm:text-sm text-white/50 font-mono mb-6 sm:mb-8">
                        Sign in to explore full market details, track positions, and get real-time alerts.
                    </p>

                    {/* CTAs */}
                    <div className="space-y-3">
                        <Link href="/login" className="block">
                            <Button className="w-full text-xs font-black bg-[#00ff7f] hover:bg-white text-black py-3 border border-[#00ff7f] hover:border-white transition-all">
                                <LogIn className="w-4 h-4 mr-2" />
                                SIGN IN
                            </Button>
                        </Link>

                        <Link href="/register" className="block">
                            <Button variant="outline" className="w-full text-xs font-black border border-white/30 text-white hover:border-[#00ff7f] hover:text-[#00ff7f] bg-transparent py-3 transition-all">
                                <UserPlus className="w-4 h-4 mr-2" />
                                CREATE ACCOUNT
                            </Button>
                        </Link>
                    </div>

                    <p className="text-[10px] text-white/30 font-mono mt-4 sm:mt-6">
                        No credit card required • Free to start
                    </p>
                </div>
            </div>
        </div>
    );
}
