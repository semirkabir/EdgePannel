'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

export type TimeFilter = '1h' | '3h' | '6h' | '12h' | '24h' | 'all'

interface FilterBarProps {
  currentFilter: TimeFilter
  onFilterChange: (filter: TimeFilter) => void
  label?: string
  className?: string
}

export function FilterBar({
  currentFilter,
  onFilterChange,
  label = 'Time',
  className,
}: FilterBarProps) {
  const filters: { label: string; value: TimeFilter }[] = [
    { label: '1h', value: '1h' },
    { label: '3h', value: '3h' },
    { label: '6h', value: '6h' },
    { label: '12h', value: '12h' },
    { label: '24h', value: '24h' },
    { label: 'All', value: 'all' },
  ]

  return (
    <div
      className={cn(
        "flex items-center gap-1 bg-background/50 backdrop-blur-sm p-1 rounded-lg border border-border/50",
        className
      )}
      role="group"
      aria-label={`${label} filter`}
    >
      <span className="text-xs text-muted-foreground px-2 font-medium whitespace-nowrap">
        {label}:
      </span>
      {filters.map((filter) => (
        <Button
          key={filter.value}
          variant={currentFilter === filter.value ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onFilterChange(filter.value)}
          className={cn(
            "h-7 px-2.5 text-xs",
            currentFilter === filter.value && "bg-primary/10 text-primary hover:bg-primary/20"
          )}
        >
          {filter.label}
        </Button>
      ))}
    </div>
  )
}
