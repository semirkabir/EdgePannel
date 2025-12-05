'use client'

import { useEffect, useState } from 'react'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface LoadingScreenProps {
  message?: string
  showProgress?: boolean
}

export function LoadingScreen({ 
  message = 'Loading EdgePannel...', 
  showProgress = true 
}: LoadingScreenProps) {
  const [progress, setProgress] = useState(0)
  const [dots, setDots] = useState('')

  useEffect(() => {
    // Animate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev
        return prev + Math.random() * 15
      })
    }, 200)

    // Animate dots
    const dotsInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 400)

    return () => {
      clearInterval(progressInterval)
      clearInterval(dotsInterval)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo with animation */}
        <div className="relative mb-8">
          <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center animate-pulse">
            <Globe className="h-10 w-10 text-primary-foreground" />
          </div>
          {/* Orbiting ring */}
          <div className="absolute inset-0 -m-4 border-2 border-primary/20 rounded-full animate-spin" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-0 -m-8 border border-primary/10 rounded-full animate-spin" style={{ animationDuration: '5s', animationDirection: 'reverse' }} />
        </div>

        {/* Brand name */}
        <h1 className="text-2xl font-bold mb-2">EdgePannel</h1>
        
        {/* Loading message */}
        <p className="text-muted-foreground mb-6">
          {message}{dots}
        </p>

        {/* Progress bar */}
        {showProgress && (
          <div className="w-64 h-1 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-blue-400 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// Inline loading spinner
export function LoadingSpinner({ 
  size = 'default',
  className 
}: { 
  size?: 'sm' | 'default' | 'lg'
  className?: string 
}) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    default: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
  }

  return (
    <div 
      className={cn(
        "rounded-full border-primary/30 border-t-primary animate-spin",
        sizeClasses[size],
        className
      )}
    />
  )
}

// Loading overlay for sections
export function LoadingOverlay({ message }: { message?: string }) {
  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
      <LoadingSpinner size="lg" />
      {message && (
        <p className="mt-4 text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  )
}

