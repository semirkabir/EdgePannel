'use client'

import { Clock, Activity } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useMemo } from 'react'

interface LatencyTagProps {
  updatedAt?: Date | string | null
  className?: string
  size?: 'sm' | 'md'
}

/**
 * Component to display data freshness/latency indicator
 * Shows "Live", "5m ago", "1h ago", etc. based on updatedAt timestamp
 */
export function LatencyTag({ updatedAt, className, size = 'sm' }: LatencyTagProps) {
  const latencyInfo = useMemo(() => {
    if (!updatedAt) {
      return { text: 'Unknown', status: 'stale' as const }
    }

    const updateTime = new Date(updatedAt)
    const now = new Date()
    const diffMs = now.getTime() - updateTime.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    // Determine status and text
    if (diffSeconds < 60) {
      return { text: 'Live', status: 'live' as const }
    } else if (diffMinutes < 5) {
      return { text: `${diffMinutes}m ago`, status: 'fresh' as const }
    } else if (diffMinutes < 60) {
      return { text: `${diffMinutes}m ago`, status: 'recent' as const }
    } else if (diffHours < 24) {
      return { text: `${diffHours}h ago`, status: 'stale' as const }
    } else {
      return { text: `${diffDays}d ago`, status: 'very-stale' as const }
    }
  }, [updatedAt])

  const sizeClasses = size === 'sm' 
    ? 'text-[9px] px-1.5 py-0.5' 
    : 'text-[10px] px-2 py-1'

  const statusClasses = {
    live: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
    fresh: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    recent: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    stale: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    'very-stale': 'bg-red-500/20 text-red-400 border-red-500/50',
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded border font-semibold uppercase tracking-wide',
        sizeClasses,
        statusClasses[latencyInfo.status],
        className
      )}
      title={`Last updated: ${updatedAt ? new Date(updatedAt).toLocaleString() : 'Unknown'}`}
    >
      {latencyInfo.status === 'live' ? (
        <Activity className="w-2.5 h-2.5 animate-pulse" />
      ) : (
        <Clock className="w-2.5 h-2.5" />
      )}
      <span>{latencyInfo.text}</span>
    </div>
  )
}

