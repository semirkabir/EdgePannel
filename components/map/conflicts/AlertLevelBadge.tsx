'use client';

import { AlertLevel } from '@/types/conflicts';
import { cn } from '@/lib/utils/cn';
import { AlertTriangle, ShieldAlert, Shield, ShieldCheck, ShieldOff } from 'lucide-react';

interface AlertLevelBadgeProps {
    level: AlertLevel;
    regionName?: string;
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const ALERT_CONFIG: Record<AlertLevel, {
    label: string;
    shortLabel: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: React.ElementType;
    pulse: boolean;
}> = {
    defcon1: {
        label: 'DEFCON 1 - Maximum',
        shortLabel: 'DEFCON 1',
        color: 'text-red-100',
        bgColor: 'bg-red-600',
        borderColor: 'border-red-500',
        icon: ShieldAlert,
        pulse: true,
    },
    critical: {
        label: 'Critical',
        shortLabel: 'CRITICAL',
        color: 'text-red-100',
        bgColor: 'bg-red-500',
        borderColor: 'border-red-400',
        icon: AlertTriangle,
        pulse: true,
    },
    elevated: {
        label: 'Elevated',
        shortLabel: 'ELEVATED',
        color: 'text-orange-100',
        bgColor: 'bg-orange-500',
        borderColor: 'border-orange-400',
        icon: Shield,
        pulse: false,
    },
    guarded: {
        label: 'Guarded',
        shortLabel: 'GUARDED',
        color: 'text-yellow-100',
        bgColor: 'bg-yellow-500',
        borderColor: 'border-yellow-400',
        icon: ShieldCheck,
        pulse: false,
    },
    low: {
        label: 'Low',
        shortLabel: 'LOW',
        color: 'text-green-100',
        bgColor: 'bg-green-500',
        borderColor: 'border-green-400',
        icon: ShieldOff,
        pulse: false,
    },
};

export function AlertLevelBadge({
    level,
    regionName,
    showLabel = true,
    size = 'md',
    className,
}: AlertLevelBadgeProps) {
    const config = ALERT_CONFIG[level];
    const Icon = config.icon;

    const sizeClasses = {
        sm: 'px-1.5 py-0.5 text-[9px]',
        md: 'px-2 py-1 text-[10px]',
        lg: 'px-3 py-1.5 text-xs',
    };

    const iconSizes = {
        sm: 'w-2.5 h-2.5',
        md: 'w-3 h-3',
        lg: 'w-4 h-4',
    };

    return (
        <div
            className={cn(
                'inline-flex items-center gap-1.5 rounded font-bold uppercase tracking-wide border',
                sizeClasses[size],
                config.bgColor,
                config.borderColor,
                config.color,
                config.pulse && 'animate-pulse',
                className
            )}
        >
            <Icon className={iconSizes[size]} />
            {showLabel && (
                <span>
                    {regionName ? `${regionName}: ` : ''}
                    {config.shortLabel}
                </span>
            )}
        </div>
    );
}

export function AlertLevelIndicator({ level }: { level: AlertLevel }) {
    const config = ALERT_CONFIG[level];

    return (
        <div
            className={cn(
                'w-2 h-2 rounded-full',
                config.bgColor,
                config.pulse && 'animate-pulse'
            )}
            title={config.label}
        />
    );
}
