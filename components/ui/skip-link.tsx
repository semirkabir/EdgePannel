'use client'

import { cn } from '@/lib/utils/cn'

interface SkipLinkProps {
  href: string
  children: React.ReactNode
  className?: string
}

/**
 * Skip link for keyboard navigation accessibility
 * Hidden until focused, then appears at top of page
 */
export function SkipLink({ href, children, className }: SkipLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        "sr-only focus:not-sr-only",
        "focus:fixed focus:top-4 focus:left-4 focus:z-[100]",
        "focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground",
        "focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring",
        "transition-all duration-200",
        className
      )}
    >
      {children}
    </a>
  )
}

/**
 * Screen reader only text
 */
export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return (
    <span className="sr-only">{children}</span>
  )
}

/**
 * Announce changes to screen readers
 */
export function LiveRegion({ 
  children, 
  politeness = 'polite' 
}: { 
  children: React.ReactNode
  politeness?: 'polite' | 'assertive'
}) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {children}
    </div>
  )
}











