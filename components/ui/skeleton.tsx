import { cn } from '@/lib/utils/cn'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted/50',
        className
      )}
      {...props}
    />
  )
}

// Pre-built skeleton components for common UI patterns

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-card p-4 space-y-3', className)}>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex justify-between items-center pt-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-5 w-12" />
      </div>
    </div>
  )
}

export function SkeletonMarketCard() {
  return (
    <div className="m-2 rounded-lg border bg-card p-4 space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="flex justify-between items-center pt-2">
        <div className="flex gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-4 w-10" />
      </div>
    </div>
  )
}

export function SkeletonSidebar() {
  return (
    <div className="w-80 h-full flex flex-col glass-effect border-r border-border">
      {/* Search header */}
      <div className="p-4 border-b border-border space-y-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-3 w-32" />
      </div>
      
      {/* Category tabs */}
      <div className="flex gap-2 px-4 py-2 border-b border-border">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-18" />
        <Skeleton className="h-8 w-14" />
      </div>
      
      {/* Market cards */}
      <div className="flex-1 overflow-hidden p-2 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonMarketCard key={i} />
        ))}
      </div>
    </div>
  )
}

export function SkeletonBreakingNews() {
  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 max-w-4xl w-full px-4">
      <div className="glass-effect rounded-lg p-3 border border-border/50">
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-64 p-3 rounded-lg border border-border/50 space-y-2">
              <div className="flex gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <div className="flex justify-between pt-2 border-t border-border/50">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SkeletonMarketDetails() {
  return (
    <div className="w-96 h-full glass-effect border-l border-border p-4 space-y-4">
      {/* Header */}
      <Skeleton className="h-4 w-16" />
      
      {/* Title card */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4" />
        <div className="space-y-2 pt-2">
          <div className="flex gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <div className="pt-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-20 mt-1" />
          </div>
        </div>
      </div>
      
      {/* Chart */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-[200px] w-full" />
      </div>
      
      {/* Trade interface */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <Skeleton className="h-5 w-12" />
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}

export function SkeletonGlobe() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#0a0e27]">
      <div className="relative">
        {/* Globe outline */}
        <div className="w-64 h-64 rounded-full border-2 border-primary/30 animate-pulse" />
        
        {/* Loading indicator in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Loading globe...</p>
          </div>
        </div>
        
        {/* Orbit rings */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-72 h-72 rounded-full border border-primary/10 animate-pulse" style={{ animationDelay: '0.2s' }} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-80 h-80 rounded-full border border-primary/5 animate-pulse" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    </div>
  )
}

export function SkeletonDashboard() {
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header skeleton */}
      <div className="glass-effect border-b border-border p-4 flex justify-between items-center">
        <Skeleton className="h-8 w-56" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <SkeletonSidebar />
        
        <div className="flex-1 relative">
          <SkeletonBreakingNews />
          <SkeletonGlobe />
        </div>
      </div>
    </div>
  )
}



