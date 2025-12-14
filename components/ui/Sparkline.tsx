import React from 'react';
import { cn } from '@/lib/utils/cn';

interface SparklineProps {
    data: number[];
    color?: string;
    width?: number;
    height?: number;
    className?: string;
    showChange?: boolean;
}

export function Sparkline({
    data,
    color,
    width = 100,
    height = 30,
    className
}: SparklineProps) {
    if (!data || data.length < 2) return null;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1; // Avoid division by zero

    // SVG points
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * width;
        // Invert Y axis because SVG origin is top-left
        const y = height - ((d - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    // Determine color based on trend if not explicitly provided
    const trendColor = color
        ? color
        : data[data.length - 1] >= data[0]
            ? '#10b981' // emerald-500
            : '#ef4444'; // red-500

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className={cn("overflow-visible", className)}
        >
            <polyline
                points={points}
                fill="none"
                stroke={trendColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
