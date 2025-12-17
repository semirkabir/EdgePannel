'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X } from 'lucide-react';

interface RightPanelProps {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    headerContent?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    widthClass?: string;
}

export function RightPanel({
    isOpen,
    onClose,
    title,
    subtitle,
    headerContent,
    children,
    className,
    widthClass = "w-full sm:w-[420px]"
}: RightPanelProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            // Small delay to trigger animation
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsVisible(true);
                });
            });
        } else {
            setIsVisible(false);
            // Wait for animation to complete before unmounting
            const timeout = setTimeout(() => {
                setShouldRender(false);
            }, 300);
            return () => clearTimeout(timeout);
        }
    }, [isOpen]);

    if (!shouldRender) return null;

    return (
        <>
            {/* Backdrop for mobile */}
            <div
                className={cn(
                    "fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300",
                    isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Panel */}
            <div
                className={cn(
                    "fixed right-4 top-[88px] bottom-6 z-[2000] rounded-2xl overflow-hidden",
                    "bg-[#0e0f11] border border-white/10 shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)] flex flex-col",
                    "transform transition-transform duration-300 cubic-bezier(0.16, 1, 0.3, 1)", // Smooth easeOutExpoish
                    widthClass,
                    isVisible ? "translate-x-0" : "translate-x-[120%]",
                    className
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-4 border-b border-white/5 bg-[#0e0f11] shrink-0">
                    <div className="flex flex-col min-w-0 mr-4">
                        {title && (
                            <h2 className="text-base font-bold text-gray-100 line-clamp-1">{title}</h2>
                        )}
                        {subtitle && (
                            <div className="mt-0.5">{subtitle}</div>
                        )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {headerContent}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/5 rounded-full"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Main Scrollable Content */}
                <ScrollArea className="flex-1 bg-[#0e0f11] overflow-x-hidden">
                    <div className="flex flex-col min-h-full pb-6 w-full max-w-full overflow-x-hidden">
                        <div className="w-full max-w-full overflow-x-hidden">
                        {children}
                        </div>
                    </div>
                </ScrollArea>
            </div>
        </>
    );
}
